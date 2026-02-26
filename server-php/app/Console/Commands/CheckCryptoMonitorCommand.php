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
    private int $maxOnDemandPerExchange = 2000;
    private int $onDemandPriceTtlSec = 90;

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
                        if ($sym && is_numeric($bid) && is_numeric($ask)) {
                            $result['Binance'][$sym] = ['bid' => (float) $bid, 'ask' => (float) $ask];
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
                    if ($inst && is_numeric($bid) && is_numeric($ask)) {
                        $result['OKX'][$inst] = ['bid' => (float) $bid, 'ask' => (float) $ask];
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
                    if ($sym && is_numeric($bid) && is_numeric($ask)) {
                        $result['Bybit'][$sym] = ['bid' => (float) $bid, 'ask' => (float) $ask];
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
                    if ($sym && is_numeric($bid) && is_numeric($ask)) {
                        $result['KuCoin'][$sym] = ['bid' => (float) $bid, 'ask' => (float) $ask];
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
                    if ($pair && is_numeric($bid) && is_numeric($ask)) {
                        $result['Gate'][$pair] = ['bid' => (float) $bid, 'ask' => (float) $ask];
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
                        if (is_string($pair) && $pair !== '' && is_numeric($bid) && is_numeric($ask)) {
                            $result['Exmo'][$pair] = ['bid' => (float) $bid, 'ask' => (float) $ask];
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
                        if (is_string($pair) && $pair !== '' && is_numeric($bid) && is_numeric($ask)) {
                            $result['HitBTC'][$pair] = ['bid' => (float) $bid, 'ask' => (float) $ask];
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
            $this->logError('fetch hitbtc failed', ['e' => $e->getMessage()]);
        }

        return $result;
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

        $onDemandLimit = min($tokensToScan, $this->maxOnDemandPerExchange);
        $onDemandCounts = [];

        $bulkExchanges = array_values(array_filter($exchanges, function ($ex) {
            return $this->isBulkSupportedExchange((string) $ex);
        }));

        $baseCounts = [];
        foreach ($bulkExchanges as $ex) {
            $exC = $this->canonicalizeExchange((string) $ex);
            $data = $allTickers[$exC] ?? [];
            if (!is_array($data) || empty($data)) {
                continue;
            }

            foreach ($data as $pair => $ba) {
                if (!is_string($pair) || $pair === '') {
                    continue;
                }

                $p = strtoupper($pair);
                $base = '';
                if (str_contains($p, '-') && str_ends_with($p, '-' . $quote)) {
                    $base = substr($p, 0, -1 * (strlen($quote) + 1));
                } elseif (str_contains($p, '_') && str_ends_with($p, '_' . $quote)) {
                    $base = substr($p, 0, -1 * (strlen($quote) + 1));
                } elseif (str_ends_with($p, $quote)) {
                    $base = substr($p, 0, -1 * strlen($quote));
                }

                $base = trim($base);
                if ($base === '') {
                    continue;
                }

                if (!isset($baseCounts[$base])) {
                    $baseCounts[$base] = 0;
                }
                $baseCounts[$base]++;
            }
        }

        arsort($baseCounts);
        $bases = [];
        foreach ($baseCounts as $base => $cnt) {
            if ($cnt < 2) {
                continue;
            }
            $bases[] = $base;
            if (count($bases) >= $tokensToScan) {
                break;
            }
        }

        if (count($bases) < $tokensToScan) {
            $binanceTickers = $allTickers['Binance'] ?? [];
            foreach ($binanceTickers as $symbol => $_price) {
                if (!is_string($symbol) || $symbol === '') {
                    continue;
                }
                $s = strtoupper($symbol);
                if (!str_ends_with($s, strtoupper($quote))) {
                    continue;
                }
                $base = substr($s, 0, -1 * strlen($quote));
                $base = trim($base);
                if ($base === '') {
                    continue;
                }
                if (!in_array($base, $bases, true)) {
                    $bases[] = $base;
                    if (count($bases) >= $tokensToScan) {
                        break;
                    }
                }
            }
        }

        $this->logError('candidate bases', [
            'quote' => $quote,
            'bases' => count($bases),
            'bulk_exchanges' => count($bulkExchanges),
        ]);

        foreach ($bases as $base) {
            $prices = [];
            foreach ($exchanges as $ex) {
                $p = $this->getPriceFromCache($allTickers, $ex, $base, $quote);
                if (!$p && $ticker && !$this->isBulkSupportedExchange((string) $ex)) {
                    $exKey = (string) $ex;
                    $pairKey = strtoupper($base . '/' . $quote);
                    if (!isset($onDemandCounts[$exKey])) {
                        $onDemandCounts[$exKey] = 0;
                    }

                    if ($onDemandCounts[$exKey] < $onDemandLimit && !$this->isTimeout(2)) {
                        $onDemandCounts[$exKey]++;
                        $p = $this->getBidAskCached($ticker, $exKey, $pairKey);
                    } else {
                        $p = null;
                    }
                }
                if ($p) {
                    $prices[$ex] = $p;
                }
            }

            if (count($prices) < 2) continue;

            $minAsk = null; $minAskEx = '';
            $maxBid = null; $maxBidEx = '';

            foreach ($prices as $ex => $pa) {
                $ask = $pa['ask'];
                $bid = $pa['bid'];
                if ($minAsk === null || $ask < $minAsk) {
                    $minAsk = $ask;
                    $minAskEx = $ex;
                }
                if ($maxBid === null || $bid > $maxBid) {
                    $maxBid = $bid;
                    $maxBidEx = $ex;
                }
            }

            if (!$minAsk || !$maxBid || $minAsk <= 0) continue;

            $spreadPct = ($maxBid - $minAsk) / $minAsk * 100;
            if ($spreadPct <= 0) continue;

            $rows[] = [
                'symbol' => $base . '/' . $quote,
                'spread_pct' => $spreadPct,
                'min_ex' => $minAskEx,
                'min_price' => $minAsk,
                'max_ex' => $maxBidEx,
                'max_price' => $maxBid,
            ];
        }

        usort($rows, fn($a, $b) => $b['spread_pct'] <=> $a['spread_pct']);
        return array_slice($rows, 0, $maxRows);
    }

    private function getPriceFromCache(array $allTickers, string $exchange, string $base, string $quote): ?array
    {
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
        if ($thresholdMax <= 0) {
            $thresholdMax = 100.0;
        }
        if ($thresholdMax < $threshold) {
            $thresholdMax = $threshold;
        }

        $rowsBefore = is_array($rows) ? count($rows) : 0;
        $rows = array_values(array_filter($rows, function ($r) use ($threshold, $thresholdMax) {
            $sp = (float) ($r['spread_pct'] ?? 0);
            return $sp >= $threshold && $sp <= $thresholdMax;
        }));

        try {
            $this->logError('notify filter', [
                'user_id' => $user->id,
                'rows_before' => $rowsBefore,
                'rows_after' => count($rows),
                'top_n' => (int) ($user->crypto_monitor_top_n ?? 0),
            ]);
        } catch (\Throwable $e) {
        }

        if (count($rows) === 0) {
            return;
        }

        $settings = $this->resolveSettings($user);
        $userTopN = (int) ($settings['top_n'] ?? 30);
        $userTopN = max(1, min(100, $userTopN));

        $notifyN = min(10, $userTopN);
        $rows = array_slice($rows, 0, $notifyN);
        $total = count($rows);

        try {
            $this->logError('notify slice', ['user_id' => $user->id, 'top_n' => $notifyN, 'rows_sent' => $total]);
        } catch (\Throwable $e) {
        }

        try {
            $cacheKey = 'cm_notify_last_ts_user_' . (string) $user->id;
            $lastTs = (int) (Cache::get($cacheKey) ?: 0);
            $nowTs = time();
            $force = (bool) $this->option('force');
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
    }
}
