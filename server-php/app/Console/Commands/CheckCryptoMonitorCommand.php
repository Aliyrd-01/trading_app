<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\ExchangeTickerService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;

class CheckCryptoMonitorCommand extends Command
{
    protected $signature = 'crypto_monitor:check {--user_id=} {--force}';
    protected $description = 'Server-side CryptoMonitor: bulk fetch all tickers, compute spreads, notify.';

    private float $startTime;
    private float $maxRuntime = 50;
    private int $cacheTtl = 180;
    private int $notifyCooldownSec = 600;
    private int $notifySignalCooldownSec = 1800;
    private int $notifyMessageDedupSec = 1800;
    private int $maxOnDemandPerExchange = 2000;
    private int $onDemandPriceTtlSec = 90;
    private int $pairListTtlSec = 21600;
    private int $coingeckoTtlSec = 3600;

    private function makeSignalKey(array $row): string
    {
        $sym = strtoupper(trim((string) ($row['symbol'] ?? '')));
        $minEx = $this->canonicalizeExchange((string) ($row['min_ex'] ?? ''));
        $maxEx = $this->canonicalizeExchange((string) ($row['max_ex'] ?? ''));
        if ($sym === '' || $minEx === '' || $maxEx === '') {
            return '';
        }
        return $sym . '|' . $minEx . '|' . $maxEx;
    }

    private function buildMessageDedupHash(array $rows, float $threshold, float $thresholdMax, string $quote): string
    {
        $parts = [];
        foreach ($rows as $r) {
            if (!is_array($r)) {
                continue;
            }
            $k = $this->makeSignalKey($r);
            if ($k === '') {
                continue;
            }
            $sp = is_numeric($r['spread_pct'] ?? null) ? (float) $r['spread_pct'] : 0.0;
            $parts[] = $k . '|' . number_format($sp, 2, '.', '');
        }
        $base = strtoupper(trim($quote)) . '|' . number_format($threshold, 2, '.', '') . '|' . number_format($thresholdMax, 2, '.', '') . '|' . implode(';', $parts);
        return md5($base);
    }

    private function filterRowsBySignalCooldown(User $user, array $rows, bool $force): array
    {
        if ($force) {
            return $rows;
        }
        $out = [];
        $nowTs = time();
        foreach ($rows as $r) {
            if (!is_array($r)) {
                continue;
            }
            $sig = $this->makeSignalKey($r);
            if ($sig === '') {
                continue;
            }
            $cacheKey = 'cm_notify_last_ts_sig_' . (string) $user->id . '_' . md5($sig);
            $lastTs = (int) (Cache::get($cacheKey) ?: 0);
            if ($lastTs > 0 && ($nowTs - $lastTs) < $this->notifySignalCooldownSec) {
                continue;
            }
            $out[] = $r;
        }
        return $out;
    }

    private function isBulkSupportedExchange(string $exchange): bool
    {
        $ex = $this->canonicalizeExchange($exchange);
        return in_array($ex, ['Binance', 'OKX', 'Bybit', 'KuCoin', 'Gate', 'Exmo', 'HitBTC'], true);
    }

    private function getBidAskCached(ExchangeTickerService $ticker, string $exchange, string $pair): ?array
    {
        $ex = $this->canonicalizeExchange($exchange);
        $pairKey = strtoupper(trim($pair));
        if ($ex === '' || $pairKey === '') {
            return null;
        }

        $cacheKey = 'cm_ba_' . md5($ex . '|' . $pairKey);
        try {
            $ba = Cache::remember($cacheKey, $this->onDemandPriceTtlSec, function () use ($ticker, $ex, $pairKey) {
                $res = $ticker->getBidAsk($ex, $pairKey);
                if (!is_array($res) || !isset($res['bid']) || !isset($res['ask'])) {
                    return null;
                }
                if (!is_numeric($res['bid']) || !is_numeric($res['ask'])) {
                    return null;
                }
                return ['bid' => (float) $res['bid'], 'ask' => (float) $res['ask']];
            });
            return is_array($ba) ? $ba : null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function getLastPriceCached(ExchangeTickerService $ticker, string $exchange, string $pair): ?float
    {
        $ex = $this->canonicalizeExchange($exchange);
        $pairKey = strtoupper(trim($pair));
        if ($ex === '' || $pairKey === '') {
            return null;
        }

        $cacheKey = 'cm_lp_' . md5($ex . '|' . $pairKey);
        try {
            $p = Cache::remember($cacheKey, $this->onDemandPriceTtlSec, function () use ($ticker, $ex, $pairKey) {
                $res = $ticker->getLastPrice($ex, $pairKey);
                return is_numeric($res) ? (float) $res : null;
            });
            return is_numeric($p) ? (float) $p : null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    public function handle(): int
    {
        try {
            Log::info('crypto_monitor:check source', ['file' => __FILE__]);
        } catch (\Throwable $e) {
        }
        $this->startTime = microtime(true);
        $userId = $this->option('user_id');
        $force = (bool) $this->option('force');
        $explicit = (bool) $userId || $force;

        $this->logError('run start', ['user_id' => $userId, 'force' => $force]);

        if ($explicit) {
            $this->info('crypto_monitor:check started');
        }

        $now = Carbon::now();

        $allTickers = $this->getAllTickersCached();
        $ticker = null;
        try {
            $ticker = new ExchangeTickerService();
        } catch (\Throwable $e) {
            $ticker = null;
        }
        if (empty($allTickers)) {
            $this->logError('no tickers data');
            return self::FAILURE;
        }

        $this->logError('tickers loaded', ['exchanges' => count($allTickers), 'time_sec' => round(microtime(true) - $this->startTime, 2)]);

        $query = User::query();
        if ($userId) {
            $query->where('id', $userId);
        }

        $processed = 0;
        $query->orderBy('id')->chunkById(200, function ($users) use ($now, $force, $explicit, $allTickers, $ticker, &$processed) {
            foreach ($users as $user) {
                if ($this->isTimeout(8)) {
                    $this->logError('global timeout break', ['processed' => $processed]);
                    return false;
                }

                try {
                    $this->processUser($user, $now, $force, $explicit, $allTickers, $ticker);
                    $processed++;
                } catch (\Throwable $e) {
                    $this->logError('user failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
                }
            }
        });

        $this->logError('done', ['processed' => $processed, 'total_sec' => round(microtime(true) - $this->startTime, 2)]);
        return self::SUCCESS;
    }

    private function isTimeout(int $bufferSec): bool
    {
        return (microtime(true) - $this->startTime) > ($this->maxRuntime - $bufferSec);
    }

    private function logError(string $msg, array $ctx = []): void
    {
        try {
            Log::error('crypto_monitor:check ' . $msg, $ctx);
        } catch (\Throwable $e) {
        }
    }

    private function canonicalizeExchange(string $exchange): string
    {
        $ex = trim($exchange);
        if ($ex === '') {
            return '';
        }

        $key = strtolower($ex);
        $key = str_replace([' ', "\t", "\n", "\r"], '', $key);
        $key = str_replace(['.', '-', '_'], '', $key);

        $map = [
            'binance' => 'Binance',
            'okx' => 'OKX',
            'okex' => 'OKX',
            'bybit' => 'Bybit',
            'kucoin' => 'KuCoin',
            'gate' => 'Gate',
            'gateio' => 'Gate',
            'huobi' => 'Huobi',
            'bitfinex' => 'Bitfinex',
            'bitstamp' => 'Bitstamp',
            'kraken' => 'Kraken',
            'coinbase' => 'Coinbase',
            'coinbaseexchange' => 'Coinbase',
            'poloniex' => 'Poloniex',
            'exmo' => 'Exmo',
            'cexio' => 'CEX.IO',
            'hitbtc' => 'HitBTC',
            'bitmex' => 'BitMEX',
        ];

        return $map[$key] ?? $ex;
    }

    private function normalizeExchanges($value): array
    {
        if (is_array($value)) {
            $out = [];
            foreach ($value as $v) {
                $s = $this->canonicalizeExchange((string) $v);
                if (trim($s) !== '') {
                    $out[] = $s;
                }
            }
            return array_values(array_unique(array_values($out)));
        }

        if (is_string($value)) {
            $raw = trim($value);
            if ($raw === '') {
                return [];
            }
            try {
                $decoded = json_decode($raw, true);
                if (is_array($decoded)) {
                    return $this->normalizeExchanges($decoded);
                }
            } catch (\Throwable $e) {
            }

            $parts = array_values(array_filter(array_map('trim', explode(',', $raw)), function ($v) {
                return $v !== '';
            }));
            return $this->normalizeExchanges($parts);
        }

        return [];
    }

    private function getAllTickersCached(): array
    {
        $key = 'cm_all_tickers_v1';
        $cached = Cache::get($key);
        if ($cached) {
            return $cached;
        }

        $data = $this->fetchAllTickers();
        if (!empty($data)) {
            Cache::put($key, $data, $this->cacheTtl);
        }
        return $data;
    }

    private function fetchAllTickers(): array
    {
        $http = new \GuzzleHttp\Client(['timeout' => 10, 'connect_timeout' => 5, 'http_errors' => false]);
        $result = [];

        try {
            $resp = $http->get('https://api.binance.com/api/v3/ticker/24hr');
            if ($resp->getStatusCode() === 200) {
                $data = json_decode((string) $resp->getBody(), true);
                if (is_array($data)) {
                    foreach ($data as $t) {
                        $sym = $t['symbol'] ?? '';
                        $bid = $t['bidPrice'] ?? null;
                        $ask = $t['askPrice'] ?? null;
                        $last = $t['lastPrice'] ?? $t['last_price'] ?? null;
                        if ($sym && is_numeric($bid) && is_numeric($ask)) {
                            $row = ['bid' => (float) $bid, 'ask' => (float) $ask];
                            if (is_numeric($last)) {
                                $row['last'] = (float) $last;
                            }
                            $result['Binance'][$sym] = $row;
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
            $this->logError('fetch binance failed', ['e' => $e->getMessage()]);
        }

        try {
            $resp = $http->get('https://www.okx.com/api/v5/market/tickers?instType=SPOT');
            if ($resp->getStatusCode() === 200) {
                $data = json_decode((string) $resp->getBody(), true);
                $list = $data['data'] ?? [];
                foreach ($list as $t) {
                    $inst = $t['instId'] ?? '';
                    $bid = $t['bidPx'] ?? null;
                    $ask = $t['askPx'] ?? null;
                    $last = $t['last'] ?? null;
                    if ($inst && is_numeric($bid) && is_numeric($ask)) {
                        $row = ['bid' => (float) $bid, 'ask' => (float) $ask];
                        if (is_numeric($last)) {
                            $row['last'] = (float) $last;
                        }
                        $result['OKX'][$inst] = $row;
                    }
                }
            }
        } catch (\Throwable $e) {
            $this->logError('fetch okx failed', ['e' => $e->getMessage()]);
        }

        try {
            $resp = $http->get('https://api.bybit.com/v5/market/tickers?category=spot');
            if ($resp->getStatusCode() === 200) {
                $data = json_decode((string) $resp->getBody(), true);
                $list = $data['result']['list'] ?? [];
                foreach ($list as $t) {
                    $sym = $t['symbol'] ?? '';
                    $bid = $t['bid1Price'] ?? null;
                    $ask = $t['ask1Price'] ?? null;
                    $last = $t['lastPrice'] ?? null;
                    if ($sym && is_numeric($bid) && is_numeric($ask)) {
                        $row = ['bid' => (float) $bid, 'ask' => (float) $ask];
                        if (is_numeric($last)) {
                            $row['last'] = (float) $last;
                        }
                        $result['Bybit'][$sym] = $row;
                    }
                }
            }
        } catch (\Throwable $e) {
            $this->logError('fetch bybit failed', ['e' => $e->getMessage()]);
        }

        try {
            $resp = $http->get('https://api.kucoin.com/api/v1/market/allTickers');
            if ($resp->getStatusCode() === 200) {
                $data = json_decode((string) $resp->getBody(), true);
                $list = $data['data']['ticker'] ?? [];
                foreach ($list as $t) {
                    $sym = $t['symbol'] ?? '';
                    $bid = $t['buy'] ?? $t['bestBid'] ?? null;
                    $ask = $t['sell'] ?? $t['bestAsk'] ?? null;
                    $last = $t['last'] ?? null;
                    if ($sym && is_numeric($bid) && is_numeric($ask)) {
                        $row = ['bid' => (float) $bid, 'ask' => (float) $ask];
                        if (is_numeric($last)) {
                            $row['last'] = (float) $last;
                        }
                        $result['KuCoin'][$sym] = $row;
                    }
                }
            }
        } catch (\Throwable $e) {
            $this->logError('fetch kucoin failed', ['e' => $e->getMessage()]);
        }

        try {
            $resp = $http->get('https://api.gateio.ws/api/v4/spot/tickers');
            if ($resp->getStatusCode() === 200) {
                $data = json_decode((string) $resp->getBody(), true);
                foreach ($data as $t) {
                    $pair = $t['currency_pair'] ?? '';
                    $bid = $t['highest_bid'] ?? null;
                    $ask = $t['lowest_ask'] ?? null;
                    $last = $t['last'] ?? null;
                    if ($pair && is_numeric($bid) && is_numeric($ask)) {
                        $row = ['bid' => (float) $bid, 'ask' => (float) $ask];
                        if (is_numeric($last)) {
                            $row['last'] = (float) $last;
                        }
                        $result['Gate'][$pair] = $row;
                    }
                }
            }
        } catch (\Throwable $e) {
            $this->logError('fetch gate failed', ['e' => $e->getMessage()]);
        }

        try {
            $resp = $http->get('https://api.exmo.com/v1.1/ticker');
            if ($resp->getStatusCode() === 200) {
                $data = json_decode((string) $resp->getBody(), true);
                if (is_array($data)) {
                    foreach ($data as $pair => $row) {
                        if (!is_array($row)) {
                            continue;
                        }
                        $bid = $row['buy_price'] ?? null;
                        $ask = $row['sell_price'] ?? null;
                        $last = $row['last_trade'] ?? null;
                        if (is_string($pair) && $pair !== '' && is_numeric($bid) && is_numeric($ask)) {
                            $out = ['bid' => (float) $bid, 'ask' => (float) $ask];
                            if (is_numeric($last)) {
                                $out['last'] = (float) $last;
                            }
                            $result['Exmo'][$pair] = $out;
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
            $this->logError('fetch exmo failed', ['e' => $e->getMessage()]);
        }

        try {
            $resp = $http->get('https://api.hitbtc.com/api/3/public/ticker');
            if ($resp->getStatusCode() === 200) {
                $data = json_decode((string) $resp->getBody(), true);
                if (is_array($data)) {
                    foreach ($data as $pair => $row) {
                        if (!is_array($row)) {
                            continue;
                        }
                        $bid = $row['bid'] ?? null;
                        $ask = $row['ask'] ?? null;
                        $last = $row['last'] ?? null;
                        if (is_string($pair) && $pair !== '' && is_numeric($bid) && is_numeric($ask)) {
                            $out = ['bid' => (float) $bid, 'ask' => (float) $ask];
                            if (is_numeric($last)) {
                                $out['last'] = (float) $last;
                            }
                            $result['HitBTC'][$pair] = $out;
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
            $this->logError('fetch hitbtc failed', ['e' => $e->getMessage()]);
        }

        return $result;
    }

    private function getTopCoinSymbolsCached(int $limit): array
    {
        $limit = max(1, min(5000, $limit));
        $cacheKey = 'cm_cg_top_symbols_' . (string) $limit;
        try {
            $out = Cache::remember($cacheKey, $this->coingeckoTtlSec, function () use ($limit) {
                $http = new \GuzzleHttp\Client(['timeout' => 12, 'connect_timeout' => 5, 'http_errors' => false]);
                $symbols = [];
                $page = 1;
                $perPage = 250;
                while (count($symbols) < $limit) {
                    $resp = $http->get('https://api.coingecko.com/api/v3/coins/markets', [
                        'query' => [
                            'vs_currency' => 'usd',
                            'order' => 'market_cap_desc',
                            'per_page' => $perPage,
                            'page' => $page,
                            'sparkline' => 'false',
                        ],
                    ]);
                    if ($resp->getStatusCode() !== 200) {
                        break;
                    }
                    $data = json_decode((string) $resp->getBody(), true);
                    if (!is_array($data) || empty($data)) {
                        break;
                    }
                    foreach ($data as $row) {
                        $sym = is_array($row) ? ($row['symbol'] ?? '') : '';
                        if (is_string($sym) && trim($sym) !== '') {
                            $symbols[] = strtoupper(trim($sym));
                            if (count($symbols) >= $limit) {
                                break;
                            }
                        }
                    }
                    if (count($data) < $perPage) {
                        break;
                    }
                    $page++;
                    if ($page > 20) {
                        break;
                    }
                }
                return $symbols;
            });
            return is_array($out) ? $out : [];
        } catch (\Throwable $e) {
            $this->logError('coingecko failed', ['e' => $e->getMessage()]);
            return [];
        }
    }

    private function getExchangeBasesForQuoteCached(string $exchange, string $quote): array
    {
        $exchange = $this->canonicalizeExchange($exchange);
        $quote = strtoupper(trim($quote));
        if ($exchange === '' || $quote === '') {
            return [];
        }

        $cacheKey = 'cm_pairs_bases_' . md5($exchange . '|' . $quote);
        try {
            $bases = Cache::remember($cacheKey, $this->pairListTtlSec, function () use ($exchange, $quote) {
                $http = new \GuzzleHttp\Client(['timeout' => 12, 'connect_timeout' => 5, 'http_errors' => false]);
                $out = [];

                if ($exchange === 'Binance') {
                    $resp = $http->get('https://api.binance.com/api/v3/exchangeInfo');
                    if ($resp->getStatusCode() === 200) {
                        $data = json_decode((string) $resp->getBody(), true);
                        $symbols = $data['symbols'] ?? [];
                        foreach ($symbols as $s) {
                            if (!is_array($s)) {
                                continue;
                            }
                            if (($s['status'] ?? '') !== 'TRADING') {
                                continue;
                            }
                            $q = strtoupper((string) ($s['quoteAsset'] ?? ''));
                            $b = strtoupper((string) ($s['baseAsset'] ?? ''));
                            if ($q === $quote && $b !== '') {
                                $out[$b] = true;
                            }
                        }
                    }
                    return array_keys($out);
                }

                if ($exchange === 'OKX') {
                    $resp = $http->get('https://www.okx.com/api/v5/public/instruments', ['query' => ['instType' => 'SPOT']]);
                    if ($resp->getStatusCode() === 200) {
                        $data = json_decode((string) $resp->getBody(), true);
                        $list = $data['data'] ?? [];
                        foreach ($list as $row) {
                            if (!is_array($row)) {
                                continue;
                            }
                            $inst = strtoupper((string) ($row['instId'] ?? ''));
                            if ($inst === '' || !str_contains($inst, '-')) {
                                continue;
                            }
                            $parts = explode('-', $inst);
                            if (count($parts) === 2 && strtoupper($parts[1]) === $quote) {
                                $b = strtoupper($parts[0]);
                                if ($b !== '') {
                                    $out[$b] = true;
                                }
                            }
                        }
                    }
                    return array_keys($out);
                }

                if ($exchange === 'Exmo') {
                    $resp = $http->get('https://api.exmo.com/v1.1/ticker');
                    if ($resp->getStatusCode() === 200) {
                        $data = json_decode((string) $resp->getBody(), true);
                        if (is_array($data)) {
                            foreach ($data as $pair => $_row) {
                                if (!is_string($pair)) {
                                    continue;
                                }
                                $p = strtoupper($pair);
                                if (str_contains($p, '_') && str_ends_with($p, '_' . $quote)) {
                                    $b = substr($p, 0, -1 * (strlen($quote) + 1));
                                    $b = trim($b);
                                    if ($b !== '') {
                                        $out[$b] = true;
                                    }
                                }
                            }
                        }
                    }
                    return array_keys($out);
                }

                if ($exchange === 'KuCoin') {
                    $resp = $http->get('https://api.kucoin.com/api/v1/symbols');
                    if ($resp->getStatusCode() === 200) {
                        $data = json_decode((string) $resp->getBody(), true);
                        $list = $data['data'] ?? [];
                        foreach ($list as $row) {
                            if (!is_array($row)) {
                                continue;
                            }
                            if (($row['enableTrading'] ?? false) !== true) {
                                continue;
                            }
                            $q = strtoupper((string) ($row['quoteCurrency'] ?? ''));
                            $b = strtoupper((string) ($row['baseCurrency'] ?? ''));
                            if ($q === $quote && $b !== '') {
                                $out[$b] = true;
                            }
                        }
                    }
                    return array_keys($out);
                }

                if ($exchange === 'HitBTC') {
                    $resp = $http->get('https://api.hitbtc.com/api/2/public/symbol');
                    if ($resp->getStatusCode() === 200) {
                        $data = json_decode((string) $resp->getBody(), true);
                        if (is_array($data)) {
                            foreach ($data as $row) {
                                if (!is_array($row)) {
                                    continue;
                                }
                                $q = strtoupper((string) ($row['quoteCurrency'] ?? ''));
                                $b = strtoupper((string) ($row['baseCurrency'] ?? ''));
                                if ($q === $quote && $b !== '') {
                                    $out[$b] = true;
                                }
                            }
                        }
                    }
                    return array_keys($out);
                }

                if ($exchange === 'BitMEX') {
                    $resp = $http->get('https://www.bitmex.com/api/v1/instrument/active');
                    if ($resp->getStatusCode() === 200) {
                        $data = json_decode((string) $resp->getBody(), true);
                        if (is_array($data)) {
                            foreach ($data as $row) {
                                if (!is_array($row)) {
                                    continue;
                                }
                                $sym = strtoupper((string) ($row['symbol'] ?? ''));
                                if ($sym === '' || !str_ends_with($sym, $quote)) {
                                    continue;
                                }
                                $b = substr($sym, 0, -1 * strlen($quote));
                                $b = trim($b);
                                if ($b !== '') {
                                    if ($b === 'XBT') {
                                        $b = 'BTC';
                                    }
                                    $out[$b] = true;
                                }
                            }
                        }
                    }
                    return array_keys($out);
                }

                if ($exchange === 'CEX.IO') {
                    $resp = $http->get('https://cex.io/api/currency_limits');
                    if ($resp->getStatusCode() === 200) {
                        $data = json_decode((string) $resp->getBody(), true);
                        $pairs = $data['data']['pairs'] ?? [];
                        foreach ($pairs as $row) {
                            if (!is_array($row)) {
                                continue;
                            }
                            $q = strtoupper((string) ($row['symbol2'] ?? ''));
                            $b = strtoupper((string) ($row['symbol1'] ?? ''));
                            if ($q === $quote && $b !== '') {
                                $out[$b] = true;
                            }
                        }
                    }
                    return array_keys($out);
                }

                if ($exchange === 'Bitfinex') {
                    $resp = $http->get('https://api.bitfinex.com/v1/symbols');
                    if ($resp->getStatusCode() === 200) {
                        $data = json_decode((string) $resp->getBody(), true);
                        if (is_array($data)) {
                            foreach ($data as $sym) {
                                if (!is_string($sym)) {
                                    continue;
                                }
                                $p = strtoupper(trim($sym));
                                if ($p !== '' && str_ends_with($p, $quote)) {
                                    $b = substr($p, 0, -1 * strlen($quote));
                                    $b = trim($b);
                                    if ($b !== '') {
                                        $out[$b] = true;
                                    }
                                }
                            }
                        }
                    }
                    return array_keys($out);
                }

                if ($exchange === 'Huobi') {
                    $resp = $http->get('https://api.huobi.pro/v1/common/symbols');
                    if ($resp->getStatusCode() === 200) {
                        $data = json_decode((string) $resp->getBody(), true);
                        $list = $data['data'] ?? [];
                        foreach ($list as $row) {
                            if (!is_array($row)) {
                                continue;
                            }
                            $q = strtoupper((string) ($row['quote-currency'] ?? ''));
                            $b = strtoupper((string) ($row['base-currency'] ?? ''));
                            if ($q === $quote && $b !== '') {
                                $out[$b] = true;
                            }
                        }
                    }
                    return array_keys($out);
                }

                if ($exchange === 'Gate') {
                    $resp = $http->get('https://api.gateio.ws/api/v4/spot/currency_pairs');
                    if ($resp->getStatusCode() === 200) {
                        $data = json_decode((string) $resp->getBody(), true);
                        if (is_array($data)) {
                            foreach ($data as $row) {
                                if (!is_array($row)) {
                                    continue;
                                }
                                $q = strtoupper((string) ($row['quote'] ?? ''));
                                $b = strtoupper((string) ($row['base'] ?? ''));
                                if ($q === $quote && $b !== '') {
                                    $out[$b] = true;
                                }
                            }
                        }
                    }
                    return array_keys($out);
                }

                if ($exchange === 'Bybit') {
                    $resp = $http->get('https://api.bybit.com/v2/public/symbols');
                    if ($resp->getStatusCode() === 200) {
                        $data = json_decode((string) $resp->getBody(), true);
                        $list = $data['result'] ?? [];
                        if (is_array($list)) {
                            foreach ($list as $row) {
                                if (!is_array($row)) {
                                    continue;
                                }
                                $q = strtoupper((string) ($row['quote_currency'] ?? ''));
                                $b = strtoupper((string) ($row['base_currency'] ?? ''));
                                if ($q === $quote && $b !== '') {
                                    $out[$b] = true;
                                }
                            }
                        }
                    }
                    return array_keys($out);
                }

                if ($exchange === 'Poloniex') {
                    $resp = $http->get('https://poloniex.com/public', ['query' => ['command' => 'returnTicker']]);
                    if ($resp->getStatusCode() === 200) {
                        $data = json_decode((string) $resp->getBody(), true);
                        if (is_array($data)) {
                            foreach ($data as $pair => $_row) {
                                if (!is_string($pair)) {
                                    continue;
                                }
                                $p = strtoupper($pair);
                                if (str_contains($p, '_')) {
                                    $parts = explode('_', $p);
                                    if (count($parts) === 2 && $parts[0] === $quote && $parts[1] !== '') {
                                        $out[$parts[1]] = true;
                                    }
                                }
                            }
                        }
                    }
                    return array_keys($out);
                }

                if ($exchange === 'Bitstamp') {
                    $resp = $http->get('https://www.bitstamp.net/api/v2/trading-pairs-info/');
                    if ($resp->getStatusCode() === 200) {
                        $data = json_decode((string) $resp->getBody(), true);
                        if (is_array($data)) {
                            foreach ($data as $row) {
                                if (!is_array($row)) {
                                    continue;
                                }
                                $name = strtoupper((string) ($row['name'] ?? ''));
                                if ($name !== '' && str_contains($name, '/')) {
                                    $parts = explode('/', $name);
                                    if (count($parts) === 2 && strtoupper($parts[1]) === $quote) {
                                        $b = strtoupper(trim($parts[0]));
                                        if ($b !== '') {
                                            $out[$b] = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    return array_keys($out);
                }

                if ($exchange === 'Kraken') {
                    $resp = $http->get('https://api.kraken.com/0/public/AssetPairs');
                    if ($resp->getStatusCode() === 200) {
                        $data = json_decode((string) $resp->getBody(), true);
                        $pairs = $data['result'] ?? [];
                        if (is_array($pairs)) {
                            foreach ($pairs as $_k => $row) {
                                if (!is_array($row)) {
                                    continue;
                                }
                                $ws = strtoupper((string) ($row['wsname'] ?? ''));
                                if ($ws === '' || !str_contains($ws, '/')) {
                                    continue;
                                }
                                $parts = explode('/', $ws);
                                if (count($parts) === 2 && strtoupper(trim($parts[1])) === $quote) {
                                    $b = strtoupper(trim($parts[0]));
                                    if ($b === 'XBT') {
                                        $b = 'BTC';
                                    }
                                    if ($b !== '') {
                                        $out[$b] = true;
                                    }
                                }
                            }
                        }
                    }
                    return array_keys($out);
                }

                if ($exchange === 'Coinbase') {
                    $resp = $http->get('https://api.exchange.coinbase.com/products', ['headers' => ['Accept' => 'application/json']]);
                    if ($resp->getStatusCode() === 200) {
                        $data = json_decode((string) $resp->getBody(), true);
                        if (is_array($data)) {
                            foreach ($data as $row) {
                                if (!is_array($row)) {
                                    continue;
                                }
                                $q = strtoupper((string) ($row['quote_currency'] ?? ''));
                                $b = strtoupper((string) ($row['base_currency'] ?? ''));
                                if ($q === $quote && $b !== '') {
                                    $out[$b] = true;
                                }
                            }
                        }
                    }
                    return array_keys($out);
                }

                return [];
            });
            return is_array($bases) ? $bases : [];
        } catch (\Throwable $e) {
            $this->logError('pairs fetch failed', ['exchange' => $exchange, 'e' => $e->getMessage()]);
            return [];
        }
    }

    private function getBulkLastPriceFromCache(array $allTickers, string $exchange, string $base, string $quote): ?float
    {
        $exchange = $this->canonicalizeExchange($exchange);
        $data = $allTickers[$exchange] ?? [];
        if (!is_array($data) || empty($data)) {
            return null;
        }

        $base = strtoupper($base);
        $quote = strtoupper($quote);

        $keys = [
            $base . $quote,
            $base . '-' . $quote,
            $base . '_' . $quote,
        ];

        foreach ($keys as $k) {
            $row = $data[$k] ?? null;
            if (is_array($row) && isset($row['last']) && is_numeric($row['last'])) {
                return (float) $row['last'];
            }
        }

        return null;
    }

    private function processUser(User $user, Carbon $now, bool $force, bool $explicit, array $allTickers, ?ExchangeTickerService $ticker): void
    {
        if ($this->isTimeout(5)) {
            $this->logError('user timeout skip', ['user_id' => $user->id]);
            return;
        }

        $this->ensureFreeTrialStarted($user, $now);
        if (!$this->userHasAccess($user, $now)) {
            return;
        }

        $settings = $this->resolveSettings($user);
        $interval = $settings['interval_sec'];
        $quote = $settings['quote'];
        $tokensToScan = (int) ($settings['tokens_to_scan'] ?? 1000);
        $topN = $settings['top_n'];
        $threshold = $settings['alert_percent_min'];
        $thresholdMax = $settings['alert_percent_max'];
        $exchanges = $settings['selected_exchanges'];

        $this->logError('user start', [
            'user_id' => $user->id,
            'quote' => $quote,
            'tokens_to_scan' => $tokensToScan,
            'top_n' => $topN,
            'threshold' => $threshold,
            'exchanges' => count($exchanges),
        ]);

        if (count($exchanges) < 2) {
            return;
        }

        $lastCheck = $user->crypto_monitor_last_check_at ? Carbon::parse($user->crypto_monitor_last_check_at) : null;
        if (!$force && $lastCheck && $lastCheck->diffInSeconds($now) < $interval) {
            $this->logError('skip interval', ['user_id' => $user->id, 'delta' => $lastCheck->diffInSeconds($now)]);
            return;
        }

        $rows = $this->computeSpreads($quote, $exchanges, $allTickers, $topN, $tokensToScan, $ticker);

        if ($explicit) {
            $dump = [];
            $slice = array_slice($rows, 0, 10);
            foreach ($slice as $r) {
                $dump[] = [
                    'symbol' => (string) ($r['symbol'] ?? ''),
                    'spread_pct' => isset($r['spread_pct']) ? round((float) $r['spread_pct'], 4) : null,
                    'min_ex' => (string) ($r['min_ex'] ?? ''),
                    'max_ex' => (string) ($r['max_ex'] ?? ''),
                ];
            }
            $this->logError('top10 dump', [
                'user_id' => $user->id,
                'quote' => $quote,
                'exchanges' => $exchanges,
                'tokens_to_scan' => $tokensToScan,
                'top_n' => $topN,
                'rows' => $dump,
            ]);
        }

        if (empty($rows)) {
            $this->touchLastCheck($user, $now);
            $this->logError('done no rows', ['user_id' => $user->id]);
            return;
        }

        $this->touchLastCheck($user, $now);

        $hasTrigger = false;
        foreach ($rows as $r) {
            $sp = (float) ($r['spread_pct'] ?? 0);
            if ($sp >= $threshold && $sp <= $thresholdMax) {
                $hasTrigger = true;
                break;
            }
        }

        $this->logError('computed', [
            'user_id' => $user->id,
            'rows' => count($rows),
            'has_trigger' => $hasTrigger,
            'threshold' => $threshold,
        ]);

        if (!$hasTrigger) {
            return;
        }

        $this->sendNotifications($user, $rows, $quote, $threshold, $now);
    }

    private function computeSpreads(string $quote, array $exchanges, array $allTickers, int $topN, int $tokensToScan, ?ExchangeTickerService $ticker): array
    {
        $rows = [];
        $maxRows = min(1000, max(200, $topN * 50));
        $tokensToScan = max(1, min(5000, $tokensToScan));
        $quoteU = strtoupper($quote);

        $symbols = $this->getTopCoinSymbolsCached($tokensToScan);
        if (empty($symbols)) {
            $this->logError('no coingecko symbols', ['quote' => $quoteU]);
            return [];
        }

        $basesMap = [];
        foreach ($exchanges as $ex) {
            if ($this->isTimeout(6)) {
                break;
            }
            $exC = $this->canonicalizeExchange((string) $ex);
            $basesMap[$exC] = array_fill_keys($this->getExchangeBasesForQuoteCached($exC, $quoteU), true);
        }

        $candidateSymbols = [];
        foreach ($symbols as $sym) {
            $present = 0;
            foreach ($exchanges as $ex) {
                $exC = $this->canonicalizeExchange((string) $ex);
                if (isset($basesMap[$exC][$sym])) {
                    $present++;
                }
            }
            if ($present >= 2) {
                $candidateSymbols[] = $sym;
            }
        }

        $bulkExchanges = array_values(array_filter($exchanges, function ($ex) {
            return $this->isBulkSupportedExchange((string) $ex);
        }));

        $this->logError('candidate bases', [
            'quote' => $quoteU,
            'bases' => count($candidateSymbols),
            'bulk_exchanges' => count($bulkExchanges),
        ]);

        $onDemandLimit = min($tokensToScan, $this->maxOnDemandPerExchange);
        $onDemandCounts = [];

        foreach ($candidateSymbols as $base) {
            if ($this->isTimeout(3)) {
                break;
            }

            $prices = [];
            foreach ($exchanges as $ex) {
                $exC = $this->canonicalizeExchange((string) $ex);
                if (!isset($basesMap[$exC][$base])) {
                    continue;
                }

                $p = $this->getBulkLastPriceFromCache($allTickers, $exC, $base, $quoteU);
                if ($p === null && $ticker) {
                    $exKey = (string) $ex;
                    $pairKey = strtoupper($base . '/' . $quoteU);
                    if (!isset($onDemandCounts[$exKey])) {
                        $onDemandCounts[$exKey] = 0;
                    }
                    if ($onDemandCounts[$exKey] < $onDemandLimit && !$this->isTimeout(2)) {
                        $onDemandCounts[$exKey]++;
                        $p = $this->getLastPriceCached($ticker, $exKey, $pairKey);
                    }
                }

                if (is_numeric($p) && (float) $p > 0) {
                    $prices[$exC !== '' ? $exC : (string) $ex] = (float) $p;
                }
            }

            if (count($prices) < 2) {
                continue;
            }

            $items = [];
            foreach ($prices as $exName => $val) {
                $items[] = [$exName, $val];
            }

            $min = null;
            $max = null;
            $minEx = '';
            $maxEx = '';
            foreach ($items as $it) {
                $exName = $it[0];
                $val = (float) $it[1];
                if ($min === null || $val < $min) {
                    $min = $val;
                    $minEx = $exName;
                }
                if ($max === null || $val > $max) {
                    $max = $val;
                    $maxEx = $exName;
                }
            }

            if ($min === null || $max === null || $min <= 0) {
                continue;
            }

            $spreadPct = ($max - $min) / $min * 100;
            if ($spreadPct <= 0) {
                continue;
            }

            $rows[] = [
                'symbol' => $base . '/' . $quoteU,
                'spread_pct' => $spreadPct,
                'min_ex' => $minEx,
                'min_price' => $min,
                'max_ex' => $maxEx,
                'max_price' => $max,
            ];
        }

        usort($rows, fn($a, $b) => $b['spread_pct'] <=> $a['spread_pct']);
        return array_slice($rows, 0, $maxRows);
    }

    private function getPriceFromCache(array $allTickers, string $exchange, string $base, string $quote): ?array
    {
        $exchange = $this->canonicalizeExchange($exchange);
        $data = $allTickers[$exchange] ?? [];
        if (empty($data)) return null;

        $base = strtoupper($base);
        $quote = strtoupper($quote);

        $keys = [
            $base . $quote,
            $base . '-' . $quote,
            $base . '_' . $quote,
        ];

        foreach ($keys as $key) {
            if (isset($data[$key])) {
                return $data[$key];
            }
        }
        return null;
    }

    private function touchLastCheck(User $user, Carbon $now): void
    {
        try {
            if (Schema::hasColumn('users', 'crypto_monitor_last_check_at')) {
                $user->crypto_monitor_last_check_at = $now->toDateTimeString();
                $user->save();
                $this->logError('last_check_at updated', ['user_id' => $user->id]);
            }
        } catch (\Throwable $e) {
            $this->logError('last_check_at failed', ['user_id' => $user->id, 'e' => $e->getMessage()]);
        }
    }

    private function resolveSettings(User $user): array
    {
        $interval = is_numeric($user->crypto_monitor_interval_sec) ? (int) $user->crypto_monitor_interval_sec : 300;
        $quote = strtoupper(trim($user->crypto_monitor_quote ?? 'USDT'));
        if (!in_array($quote, ['USDT', 'USDC', 'BTC', 'ETH', 'USD'], true)) {
            $quote = 'USDT';
        }
        $tokensToScan = is_numeric($user->crypto_monitor_tokens_to_scan) ? (int) $user->crypto_monitor_tokens_to_scan : 1000;
        $tokensToScan = max(1, min(5000, $tokensToScan));
        $topN = is_numeric($user->crypto_monitor_top_n) ? (int) $user->crypto_monitor_top_n : 30;
        $topN = max(1, min(100, $topN));
        $threshold = is_numeric($user->crypto_monitor_alert_percent_min) ? (float) $user->crypto_monitor_alert_percent_min : 1.0;
        $thresholdMax = is_numeric($user->crypto_monitor_alert_percent_max) ? (float) $user->crypto_monitor_alert_percent_max : 100.0;
        $threshold = max(0.0, min(100.0, $threshold));
        $thresholdMax = max(0.0, min(100.0, $thresholdMax));
        if ($thresholdMax <= 0) {
            $thresholdMax = 100.0;
        }
        if ($thresholdMax < $threshold) {
            $thresholdMax = $threshold;
        }

        $ex = $user->crypto_monitor_selected_exchanges ?? [];
        $filtered = $this->normalizeExchanges($ex);

        return [
            'interval_sec' => max(60, $interval),
            'quote' => $quote,
            'tokens_to_scan' => $tokensToScan,
            'top_n' => $topN,
            'alert_percent_min' => $threshold,
            'alert_percent_max' => $thresholdMax,
            'selected_exchanges' => $filtered,
        ];
    }

    private function ensureFreeTrialStarted(User $user, Carbon $now): void
    {
        if (!Schema::hasColumn('users', 'trial_expires_at')) return;
        if ((string) ($user->plan ?? 'free') !== 'free') return;
        if ($user->trial_expires_at) return;
        $user->trial_expires_at = ($user->created_at ? Carbon::parse($user->created_at) : $now)->copy()->addDays(7);
        $user->save();
    }

    private function userHasAccess(User $user, Carbon $now): bool
    {
        if (!Schema::hasColumn('users', 'trial_expires_at')) return true;
        if ((string) ($user->plan ?? 'free') !== 'free') return true;
        if (!$user->trial_expires_at) return true;
        return Carbon::parse($user->trial_expires_at)->greaterThan($now);
    }

    private function sendNotifications(User $user, array $rows, string $quote, float $threshold, Carbon $now): void
    {
        $lang = strtolower(substr(trim($user->language ?? 'ru'), 0, 2));
        if (!in_array($lang, ['ru', 'en', 'uk'], true)) $lang = 'ru';

        $thresholdMax = is_numeric($user->crypto_monitor_alert_percent_max) ? (float) $user->crypto_monitor_alert_percent_max : 100.0;
        $threshold = max(0.0, min(100.0, $threshold));
        $thresholdMax = max(0.0, min(100.0, $thresholdMax));
        if ($thresholdMax <= 0) {
            $thresholdMax = 100.0;
        }
        if ($thresholdMax < $threshold) {
            $thresholdMax = $threshold;
        }

        $rowsBefore = is_array($rows) ? count($rows) : 0;
        $rowsFiltered = [];
        foreach ($rows as $r) {
            $sp = (float) ($r['spread_pct'] ?? 0);
            if ($sp >= $threshold && $sp <= $thresholdMax) {
                $rowsFiltered[] = $r;
            }
        }
        $triggeredCount = count($rowsFiltered);

        try {
            $this->logError('notify filter', [
                'user_id' => $user->id,
                'rows_before' => $rowsBefore,
                'rows_after' => $triggeredCount,
                'top_n' => (int) ($user->crypto_monitor_top_n ?? 0),
                'threshold_max_effective' => $thresholdMax,
            ]);
        } catch (\Throwable $e) {
        }

        if (count($rowsFiltered) === 0) {
            return;
        }

        $settings = $this->resolveSettings($user);
        $userTopN = (int) ($settings['top_n'] ?? 30);
        $userTopN = max(1, min(100, $userTopN));

        $notifyN = min(10, $userTopN);
        $rows = array_slice($rowsFiltered, 0, $notifyN);
        $total = count($rows);

        $force = (bool) $this->option('force');

        $rows = $this->filterRowsBySignalCooldown($user, $rows, $force);
        $total = count($rows);
        if ($total === 0) {
            return;
        }

        try {
            $hashKey = 'cm_notify_last_hash_user_' . (string) $user->id;
            $hashTsKey = 'cm_notify_last_hash_ts_user_' . (string) $user->id;
            $prevHash = (string) (Cache::get($hashKey) ?: '');
            $prevTs = (int) (Cache::get($hashTsKey) ?: 0);
            $nowTs = time();
            $curHash = $this->buildMessageDedupHash($rows, $threshold, $thresholdMax, $quote);
            if (!$force && $prevHash !== '' && $prevHash === $curHash && $prevTs > 0 && ($nowTs - $prevTs) < $this->notifyMessageDedupSec) {
                $this->logError('notify dedup skip', ['user_id' => $user->id, 'delta_sec' => ($nowTs - $prevTs)]);
                return;
            }
        } catch (\Throwable $e) {
        }

        try {
            $this->logError('notify slice', ['user_id' => $user->id, 'top_n' => $notifyN, 'rows_sent' => $total]);
        } catch (\Throwable $e) {
        }

        try {
            $cacheKey = 'cm_notify_last_ts_user_' . (string) $user->id;
            $lastTs = (int) (Cache::get($cacheKey) ?: 0);
            $nowTs = time();
            if (!$force && $lastTs > 0 && ($nowTs - $lastTs) < $this->notifyCooldownSec) {
                $this->logError('notify cooldown skip', ['user_id' => $user->id, 'delta_sec' => ($nowTs - $lastTs)]);
                return;
            }
        } catch (\Throwable $e) {
        }

        if ($lang === 'en') {
            $header = "🚨 Crypto Monitor сигналов: {$total}\n\n";
        } elseif ($lang === 'uk') {
            $header = "🚨 Crypto Monitor сигналів: {$total}\n\n";
        } else {
            $header = "🚨 Crypto Monitor сигналов: {$total}\n\n";
        }

        $timeText = $now->toDateTimeString();

        $blocks = [];
        foreach ($rows as $r) {
            $spreadStr = number_format($r['spread_pct'], 2, '.', '');
            $thresholdStr = number_format($threshold, 2, '.', '');
            $pair = $r['symbol'];

            if ($lang === 'en') {
                $blocks[] = "📊 Pair: {$pair}\nSpread: {$spreadStr}% (threshold {$thresholdStr}%)\nBuy (min ask): {$r['min_ex']} @ {$r['min_price']}\nSell (max bid): {$r['max_ex']} @ {$r['max_price']}";
            } elseif ($lang === 'uk') {
                $blocks[] = "📊 Пара: {$pair}\nСпред: {$spreadStr}% (поріг {$thresholdStr}%)\nКупівля (min ask): {$r['min_ex']} @ {$r['min_price']}\nПродаж (max bid): {$r['max_ex']} @ {$r['max_price']}";
            } else {
                $blocks[] = "📊 Пара: {$pair}\nСпред: {$spreadStr}% (порог {$thresholdStr}%)\nПокупка (min ask): {$r['min_ex']} @ {$r['min_price']}\nПродажа (max bid): {$r['max_ex']} @ {$r['max_price']}";
            }
        }

        if (empty($blocks)) return;

        $subjectPrefix = $lang === 'en' ? '🚨 Crypto Monitor. ' : ($lang === 'uk' ? '🚨 Crypto Monitor. ' : '🚨 Crypto Monitor. ');

        $subject = '';
        if (count($blocks) === 1 && isset($rows[0]) && is_array($rows[0])) {
            $pair = (string) ($rows[0]['symbol'] ?? '');
            $spreadStr = number_format((float) ($rows[0]['spread_pct'] ?? 0), 2, '.', '');
            if ($lang === 'en') {
                $subject = $subjectPrefix . "New trading signal! {$pair}: {$spreadStr}%";
            } elseif ($lang === 'uk') {
                $subject = $subjectPrefix . "Новий торговий сигнал! {$pair}: {$spreadStr}%";
            } else {
                $subject = $subjectPrefix . "Новый торговый сигнал! {$pair}: {$spreadStr}%";
            }
        } else {
            if ($lang === 'en') {
                $subject = $subjectPrefix . 'New trading signal!';
            } elseif ($lang === 'uk') {
                $subject = $subjectPrefix . 'Новий торговий сигнал!';
            } else {
                $subject = $subjectPrefix . 'Новый торговый сигнал!';
            }
        }

        $message = $header . implode("\n\n----------------\n\n", $blocks) . "\n\n";
        if ($lang === 'en') {
            $message .= "⏰ Time: {$timeText}";
        } elseif ($lang === 'uk') {
            $message .= "⏰ Час: {$timeText}";
        } else {
            $message .= "⏰ Время: {$timeText}";
        }

        $this->logError('sending notifications', ['user_id' => $user->id, 'rows' => count($rows)]);

        if ((int) ($user->enable_email_notifications ?? 0) === 1 && $user->email) {
            try {
                Mail::raw($message, fn($m) => $m->to($user->email)->subject($subject));
            } catch (\Throwable $e) {
                $this->logError('email failed', ['user_id' => $user->id, 'e' => $e->getMessage()]);
            }
        }

        if ((int) ($user->enable_telegram_notifications ?? 0) === 1) {
            $token = trim((string) env('TELEGRAM_BOT_TOKEN', ''));
            $chatId = trim((string) ($user->telegram_chat_id ?? ''));
            if ($token && $chatId) {
                try {
                    $http = new \GuzzleHttp\Client(['timeout' => 10, 'http_errors' => false]);
                    $http->post("https://api.telegram.org/bot{$token}/sendMessage", [
                        'form_params' => [
                            'chat_id' => $chatId,
                            'text' => $message,
                            'disable_web_page_preview' => true,
                        ],
                    ]);
                } catch (\Throwable $e) {
                    $this->logError('telegram failed', ['user_id' => $user->id, 'e' => $e->getMessage()]);
                }
            }
        }

        try {
            $cacheKey = 'cm_notify_last_ts_user_' . (string) $user->id;
            Cache::put($cacheKey, time(), max(120, $this->notifyCooldownSec + 30));
        } catch (\Throwable $e) {
        }

        try {
            $nowTs = time();
            foreach ($rows as $r) {
                if (!is_array($r)) {
                    continue;
                }
                $sig = $this->makeSignalKey($r);
                if ($sig === '') {
                    continue;
                }
                $cacheKey = 'cm_notify_last_ts_sig_' . (string) $user->id . '_' . md5($sig);
                Cache::put($cacheKey, $nowTs, max(120, $this->notifySignalCooldownSec + 30));
            }
        } catch (\Throwable $e) {
        }

        try {
            $curHash = $this->buildMessageDedupHash($rows, $threshold, $thresholdMax, $quote);
            Cache::put('cm_notify_last_hash_user_' . (string) $user->id, $curHash, max(120, $this->notifyMessageDedupSec + 30));
            Cache::put('cm_notify_last_hash_ts_user_' . (string) $user->id, time(), max(120, $this->notifyMessageDedupSec + 30));
        } catch (\Throwable $e) {
        }
    }
}
