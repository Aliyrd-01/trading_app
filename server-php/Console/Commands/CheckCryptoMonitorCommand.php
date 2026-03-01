<?php

namespace App\Console\Commands\Legacy;

use App\Models\User;
use App\Services\ExchangeTickerService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

class CheckCryptoMonitorCommandLegacy extends Command
{
    protected $signature = 'crypto_monitor:check_legacy {--user_id=} {--force}';

    protected $description = 'Server-side CryptoMonitor scan for users (multi-exchange spreads) and send notifications.';

    public function handle(): int
    {
        try {
            Log::info('crypto_monitor:check source', ['file' => __FILE__]);
        } catch (\Throwable $e) {
        }
        $userId = $this->option('user_id');
        $force = (bool) $this->option('force');
        $explicitRun = (bool) $userId || $force;

        $query = User::query();
        if ($userId) {
            $query->where('id', $userId);
        }

        if ($explicitRun) {
            $this->info('crypto_monitor:check started');
            $count = (int) $query->count();
            $this->line("users: {$count}");
            if ($count === 0) {
                $this->warn('No users matched query');
                return self::SUCCESS;
            }
        }

        $ticker = new ExchangeTickerService();
        $now = Carbon::now();

        $query->orderBy('id')->chunkById(200, function ($users) use ($ticker, $now, $force, $explicitRun) {
            foreach ($users as $user) {
                try {
                    $this->ensureFreeTrialStarted($user, $now);
                    if (!$this->userHasCryptoMonitorAccess($user, $now)) {
                        if ($explicitRun) {
                            $this->warn("SKIP no access user_id={$user->id}");
                        }
                        continue;
                    }

                    $this->processUser($user, $ticker, $now, $force, $explicitRun);
                } catch (\Throwable $e) {
                    Log::error('crypto_monitor:check user failed', [
                        'user_id' => $user->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        });

        return self::SUCCESS;
    }

    private function ensureFreeTrialStarted(User $user, Carbon $now): void
    {
        if (!Schema::hasColumn('users', 'trial_expires_at')) {
            return;
        }

        $plan = (string) ($user->plan ?? 'free');
        if ($plan !== 'free') {
            return;
        }

        if ($user->trial_expires_at) {
            return;
        }

        $base = $user->created_at ? Carbon::parse($user->created_at) : $now;
        $user->trial_expires_at = $base->copy()->addDays(7);
        $user->save();
    }

    private function userHasCryptoMonitorAccess(User $user, Carbon $now): bool
    {
        if (!Schema::hasColumn('users', 'trial_expires_at')) {
            return true;
        }

        $plan = (string) ($user->plan ?? 'free');
        if ($plan !== 'free') {
            return true;
        }

        if (!$user->trial_expires_at) {
            return true;
        }

        return Carbon::parse($user->trial_expires_at)->greaterThan($now);
    }

    private function canonicalizeExchange(string $exchange): string
    {
        $ex = trim($exchange);
        if ($ex === '') {
            return '';
        }

        $key = strtolower($ex);
        $key = str_replace([' ', '\t', '\n', '\r'], '', $key);
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

    private function buildExchangePairSymbol(string $exchange, string $base, string $quote): string
    {
        $b = strtoupper(trim($base));
        $q = strtoupper(trim($quote));
        $ex = $this->canonicalizeExchange($exchange);

        if ($ex === 'OKX') {
            return $b . '-' . $q;
        }
        if ($ex === 'KuCoin') {
            return $b . '-' . $q;
        }
        if ($ex === 'Gate') {
            return $b . '_' . $q;
        }
        if ($ex === 'Binance' || $ex === 'Bybit') {
            return $b . $q;
        }
        return $b . '/' . $q;
    }

    private function getAllTickersCachedForExchanges(array $exchanges): array
    {
        $exchanges = $this->normalizeExchanges($exchanges);
        sort($exchanges);
        $key = 'cm_all_tickers_v2_' . md5(json_encode($exchanges));

        $cached = Cache::get($key);
        if (is_array($cached)) {
            return $cached;
        }

        $data = $this->fetchAllTickersForExchanges($exchanges);
        Cache::put($key, $data, 60);
        return $data;
    }

    private function fetchAllTickersForExchanges(array $exchanges): array
    {
        $http = new \GuzzleHttp\Client(['timeout' => 15, 'connect_timeout' => 5, 'http_errors' => false]);
        $result = [];

        foreach ($exchanges as $ex) {
            $exC = $this->canonicalizeExchange((string) $ex);

            if ($exC === 'Binance') {
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
                }
                continue;
            }

            if ($exC === 'OKX') {
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
                }
                continue;
            }

            if ($exC === 'Bybit') {
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
                }
                continue;
            }

            if ($exC === 'KuCoin') {
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
                }
                continue;
            }

            if ($exC === 'Gate') {
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
                }
                continue;
            }
        }

        return $result;
    }

    private function getPriceFromBulkCache(array $allTickers, string $exchange, string $base, string $quote): ?array
    {
        $ex = $this->canonicalizeExchange($exchange);
        $pair = $this->buildExchangePairSymbol($ex, $base, $quote);
        $row = $allTickers[$ex][$pair] ?? null;
        if (!is_array($row)) {
            return null;
        }
        if (!isset($row['bid']) || !isset($row['ask'])) {
            return null;
        }
        if (!is_numeric($row['bid']) || !is_numeric($row['ask'])) {
            return null;
        }
        return ['bid' => (float) $row['bid'], 'ask' => (float) $row['ask']];
    }

    private function isBulkSupportedExchange(string $exchange): bool
    {
        $ex = $this->canonicalizeExchange($exchange);
        return in_array($ex, ['Binance', 'OKX', 'Bybit', 'KuCoin', 'Gate'], true);
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

    private function resolveSettings(User $user): array
    {
        $intervalSec = $user->crypto_monitor_interval_sec;
        if (!is_numeric($intervalSec) || (int) $intervalSec <= 0) {
            $intervalSec = 300;
        }

        $quote = $user->crypto_monitor_quote;
        if (!is_string($quote) || trim($quote) === '') {
            $quote = 'USDT';
        }
        $quote = strtoupper(trim($quote));
        $allowedQuotes = ['USDT', 'USDC', 'BTC', 'ETH', 'USD'];
        if (!in_array($quote, $allowedQuotes, true)) {
            $quote = 'USDT';
        }

        $tokens = $user->crypto_monitor_tokens_to_scan;
        if (!is_numeric($tokens) || (int) $tokens <= 0) {
            $tokens = 1000;
        }
        $tokens = min(10000, (int) $tokens);

        $topN = $user->crypto_monitor_top_n;
        if (!is_numeric($topN) || (int) $topN <= 0) {
            $topN = 30;
        }
        $topN = max(1, min(100, (int) $topN));

        $threshold = $user->crypto_monitor_alert_percent_min;
        if (!is_numeric($threshold) || (float) $threshold < 0) {
            $threshold = 1.0;
        }
        $threshold = max(0.0, min(100.0, (float) $threshold));

        $exchanges = $user->crypto_monitor_selected_exchanges;
        if (is_string($exchanges)) {
            try {
                $decoded = json_decode($exchanges, true);
                $exchanges = $decoded;
            } catch (\Throwable $e) {
            }
        }
        $exchanges = $this->normalizeExchanges($exchanges);

        return [
            'interval_sec' => (int) $intervalSec,
            'quote' => $quote,
            'tokens_to_scan' => $tokens,
            'top_n' => $topN,
            'alert_percent_min' => $threshold,
            'selected_exchanges' => $exchanges,
        ];
    }

    private function buildSymbolList(string $quote, int $tokensToScan): array
    {
        $tokensToScan = max(1, min(5000, (int) $tokensToScan));
        $base = strtoupper(trim($quote));

        try {
            $ticker = new ExchangeTickerService();
        } catch (\Throwable $e) {
            $ticker = null;
        }

        $http = new \GuzzleHttp\Client([
            'timeout' => 15,
            'connect_timeout' => 5,
            'http_errors' => false,
        ]);

        try {
            $resp = $http->get('https://api.binance.com/api/v3/exchangeInfo');
            if ($resp->getStatusCode() !== 200) {
                return [];
            }
            $data = json_decode((string) $resp->getBody(), true);
            $symbols = is_array($data) ? ($data['symbols'] ?? []) : [];
            if (!is_array($symbols)) {
                return [];
            }

            $out = [];
            foreach ($symbols as $s) {
                if (!is_array($s)) {
                    continue;
                }
                if (($s['status'] ?? '') !== 'TRADING') {
                    continue;
                }
                if (($s['isSpotTradingAllowed'] ?? true) === false) {
                    continue;
                }
                $quoteAsset = strtoupper((string) ($s['quoteAsset'] ?? ''));
                $baseAsset = strtoupper((string) ($s['baseAsset'] ?? ''));
                if ($quoteAsset !== $base) {
                    continue;
                }
                if ($baseAsset === '') {
                    continue;
                }
                $out[] = $baseAsset . '/' . $quoteAsset;
                if (count($out) >= $tokensToScan) {
                    break;
                }
            }
            return $out;
        } catch (\Throwable $e) {
            return [];
        }
    }

    private function processUser(User $user, ExchangeTickerService $ticker, Carbon $now, bool $force, bool $explicitRun): void
    {
        $settings = $this->resolveSettings($user);
        $intervalSec = (int) ($settings['interval_sec'] ?? 300);
        $quote = (string) ($settings['quote'] ?? 'USDT');
        $tokensToScan = (int) ($settings['tokens_to_scan'] ?? 1000);
        $topN = (int) ($settings['top_n'] ?? 30);
        $threshold = (float) ($settings['alert_percent_min'] ?? 1.0);
        $exchanges = (array) ($settings['selected_exchanges'] ?? []);

        try {
            Log::info('crypto_monitor user settings', [
                'user_id' => $user->id,
                'quote' => $quote,
                'tokens_to_scan' => $tokensToScan,
                'top_n' => $topN,
                'threshold' => $threshold,
                'exchanges' => $exchanges,
            ]);
        } catch (\Throwable $e) {
        }

        if (count($exchanges) < 2) {
            if ($explicitRun) {
                $this->warn("SKIP <2 exchanges user_id={$user->id}");
            }
            return;
        }

        $lastCheckRaw = $user->crypto_monitor_last_check_at ?? null;
        $lastCheck = null;
        if ($lastCheckRaw) {
            try {
                $lastCheck = Carbon::parse($lastCheckRaw);
            } catch (\Throwable $e) {
                $lastCheck = null;
            }
        }

        if (!$force && $lastCheck && $lastCheck->diffInSeconds($now) < $intervalSec) {
            return;
        }

        $symbols = $this->buildSymbolList($quote, $tokensToScan);
        if (count($symbols) === 0) {
            if ($explicitRun) {
                $this->warn("SKIP no symbols user_id={$user->id}");
            }
            return;
        }

        $allTickers = $this->getAllTickersCachedForExchanges($exchanges);

        $priceHits = [];
        foreach ($exchanges as $ex) {
            $priceHits[(string) $ex] = 0;
        }
        $symbolsWith2Prices = 0;
        $symbolsWithAnyPrice = 0;

        $rows = [];
        foreach ($symbols as $sym) {
            $symNorm = strtoupper(trim((string) $sym));
            $baseAsset = '';
            $quoteAsset = '';
            if (str_contains($symNorm, '/')) {
                [$baseAsset, $quoteAsset] = explode('/', $symNorm, 2);
            }

            if ($baseAsset === '' || $quoteAsset === '') {
                continue;
            }

            $prices = [];
            foreach ($exchanges as $ex) {
                $ba = $this->getPriceFromBulkCache($allTickers, (string) $ex, $baseAsset, $quoteAsset);
                if (!$ba && !$this->isBulkSupportedExchange((string) $ex)) {
                    $ba = $ticker->getBidAsk((string) $ex, (string) $symNorm);
                }
                if (is_array($ba) && isset($ba['bid']) && isset($ba['ask'])) {
                    $prices[(string) $ex] = $ba;
                    $priceHits[(string) $ex] = (int) ($priceHits[(string) $ex] ?? 0) + 1;
                }
            }

            if (count($prices) < 2) {
                continue;
            }

            $symbolsWith2Prices++;
            $symbolsWithAnyPrice++;

            $minAsk = null;
            $minAskEx = '';
            $maxBid = null;
            $maxBidEx = '';

            foreach ($prices as $ex => $ba) {
                $ask = (float) $ba['ask'];
                $bid = (float) $ba['bid'];
                if ($minAsk === null || $ask < $minAsk) {
                    $minAsk = $ask;
                    $minAskEx = (string) $ex;
                }
                if ($maxBid === null || $bid > $maxBid) {
                    $maxBid = $bid;
                    $maxBidEx = (string) $ex;
                }
            }

            if (!$minAsk || !$maxBid || $minAsk <= 0) {
                continue;
            }

            $spreadPercent = ($maxBid - $minAsk) / $minAsk * 100.0;

            $rows[] = [
                'symbol' => $sym,
                'spread_pct' => $spreadPercent,
                'min_ex' => $minAskEx,
                'min_price' => (float) $minAsk,
                'max_ex' => $maxBidEx,
                'max_price' => (float) $maxBid,
            ];
        }

        try {
            Log::info('crypto_monitor price coverage', [
                'user_id' => $user->id,
                'symbols_total' => count($symbols),
                'symbols_with_2_prices' => $symbolsWith2Prices,
                'exchanges' => $exchanges,
                'price_hits' => $priceHits,
            ]);
        } catch (\Throwable $e) {
        }

        if (count($rows) === 0) {
            $this->touchLastCheck($user, $now);
            return;
        }

        usort($rows, function ($a, $b) {
            return ((float) $b['spread_pct'] <=> (float) $a['spread_pct']);
        });

        $thresholdMax = $user->crypto_monitor_alert_percent_max;
        if (!is_numeric($thresholdMax)) {
            $thresholdMax = 100.0;
        }
        $thresholdMax = (float) $thresholdMax;
        if ($thresholdMax <= 0) {
            $thresholdMax = 100.0;
        }
        if ($thresholdMax < $threshold) {
            $thresholdMax = $threshold;
        }

        $triggered = array_values(array_filter($rows, function ($r) use ($threshold, $thresholdMax) {
            $sp = (float) ($r['spread_pct'] ?? 0.0);
            return $sp >= $threshold && $sp <= $thresholdMax;
        }));

        try {
            Log::info('crypto_monitor computed rows', [
                'user_id' => $user->id,
                'rows_total' => count($rows),
                'rows_triggered' => count($triggered),
                'threshold_max' => $thresholdMax,
            ]);
        } catch (\Throwable $e) {
        }

        $this->touchLastCheck($user, $now);

        if (count($triggered) === 0) {
            return;
        }

        $rowsTop = array_slice($triggered, 0, max(1, $topN));
        $this->sendNotifications($user, $rowsTop, $quote, $threshold, $now);
    }

    private function touchLastCheck(User $user, Carbon $now): void
    {
        try {
            if (Schema::hasColumn('users', 'crypto_monitor_last_check_at')) {
                $user->crypto_monitor_last_check_at = $now->toDateTimeString();
                $user->save();
            }
        } catch (\Throwable $e) {
        }
    }

    private function formatBlock(string $lang, string $pair, float $spreadPercent, string $minAskEx, $minAsk, string $maxBidEx, $maxBid, float $threshold, Carbon $now): string
    {
        $spreadStr = number_format($spreadPercent, 2, '.', '');
        $thresholdStr = number_format($threshold, 2, '.', '');

        $timeStr = $now->copy();
        if ($lang === 'uk') {
            $timeStr->locale('uk');
        } elseif ($lang === 'en') {
            $timeStr->locale('en');
        } else {
            $timeStr->locale('ru');
        }
        $timeText = $timeStr->toDateTimeString();

        if ($lang === 'en') {
            return "📊 Pair: {$pair}\nSpread: {$spreadStr}% (threshold {$thresholdStr}%)\nBuy (min ask): {$minAskEx} @ {$minAsk}\nSell (max bid): {$maxBidEx} @ {$maxBid}\n\n⏰ Time: {$timeText}";
        }
        if ($lang === 'uk') {
            return "📊 Пара: {$pair}\nСпред: {$spreadStr}% (поріг {$thresholdStr}%)\nКупівля (min ask): {$minAskEx} @ {$minAsk}\nПродаж (max bid): {$maxBidEx} @ {$maxBid}\n\n⏰ Час: {$timeText}";
        }
        return "📊 Пара: {$pair}\nСпред: {$spreadStr}% (порог {$thresholdStr}%)\nПокупка (min ask): {$minAskEx} @ {$minAsk}\nПродажа (max bid): {$maxBidEx} @ {$maxBid}\n\n⏰ Время: {$timeText}";
    }

    private function sendNotifications(User $user, array $rowsTop, string $quote, float $threshold, Carbon $now): void
    {
        $lang = (string) ($user->language ?? 'ru');
        $lang = strtolower(substr(trim($lang), 0, 2));
        if (!in_array($lang, ['ru', 'en', 'uk'], true)) {
            $lang = 'ru';
        }

        $thresholdMax = $user->crypto_monitor_alert_percent_max;
        if (!is_numeric($thresholdMax)) {
            $thresholdMax = 100.0;
        }
        $thresholdMax = (float) $thresholdMax;
        if ($thresholdMax <= 0) {
            $thresholdMax = 100.0;
        }
        if ($thresholdMax < $threshold) {
            $thresholdMax = $threshold;
        }

        $rowsBefore = is_array($rowsTop) ? count($rowsTop) : 0;
        $rowsTop = array_values(array_filter($rowsTop, function ($r) use ($threshold, $thresholdMax) {
            $sp = (float) ($r['spread_pct'] ?? 0.0);
            return $sp >= $threshold && $sp <= $thresholdMax;
        }));

        try {
            Log::info('crypto_monitor notify filter', [
                'user_id' => $user->id,
                'rows_before' => $rowsBefore,
                'rows_after' => count($rowsTop),
                'top_n' => (int) ($user->crypto_monitor_top_n ?? 0),
            ]);
        } catch (\Throwable $e) {
        }

        if (count($rowsTop) === 0) {
            return;
        }

        $topN = is_numeric($user->crypto_monitor_top_n) ? (int) $user->crypto_monitor_top_n : 30;
        $topN = max(1, min(100, $topN));
        if (count($rowsTop) > $topN) {
            $rowsTop = array_slice($rowsTop, 0, $topN);
        }

        try {
            Log::info('crypto_monitor notify slice', ['user_id' => $user->id, 'top_n' => $topN, 'rows_sent' => count($rowsTop)]);
        } catch (\Throwable $e) {
        }

        $subject = $lang === 'en'
            ? '🚨 Crypto Monitor. New trading signal!'
            : ($lang === 'uk' ? '🚨 Crypto Monitor. Новий торговий сигнал!' : '🚨 Crypto Monitor. Новый торговый сигнал!');

        $header = $lang === 'en'
            ? "🚨 New trading signal!\n\n"
            : ($lang === 'uk' ? "🚨 Новий торговий сигнал!\n\n" : "🚨 Новый торговый сигнал!\n\n");

        $blocks = [];
        foreach ($rowsTop as $r) {
            $symbol = strtoupper(trim((string) ($r['symbol'] ?? '')));
            if ($symbol === '') {
                continue;
            }
            $pair = str_contains($symbol, '/') ? $symbol : ($symbol . '/' . strtoupper($quote));

            $blocks[] = $this->formatBlock(
                $lang,
                $pair,
                (float) ($r['spread_pct'] ?? 0.0),
                (string) ($r['min_ex'] ?? ''),
                (string) ($r['min_price'] ?? ''),
                (string) ($r['max_ex'] ?? ''),
                (string) ($r['max_price'] ?? ''),
                $threshold,
                $now
            );
        }

        if (count($blocks) === 0) {
            return;
        }

        $message = $header . implode("\n\n----------------\n\n", $blocks);

        $emailEnabled = (int) ($user->enable_email_notifications ?? 0) === 1;
        $telegramEnabled = (int) ($user->enable_telegram_notifications ?? 0) === 1;

        $isFree = (string) ($user->effective_plan ?? ($user->plan ?? 'free'));
        $isFree = strtolower(trim($isFree));
        $isFree = ($isFree === '' || $isFree === 'free' || $isFree === 'basic' || $isFree === 'trial');

        if ($isFree && ($emailEnabled || $telegramEnabled)) {
            try {
                $dayKey = $now->format('Ymd');
                $sentKey = 'cm_free_daily_sent_' . (string) $user->id . '_' . $dayKey;
                if ((bool) (Cache::get($sentKey) ?: false)) {
                    return;
                }
            } catch (\Throwable $e) {
            }
        }

        if ($emailEnabled && !empty($user->email)) {
            try {
                Mail::raw($message, function ($m) use ($user, $subject) {
                    $m->to($user->email)->subject($subject);
                });
            } catch (\Throwable $e) {
                Log::error('crypto_monitor:check email failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            }
        }

        if ($telegramEnabled) {
            try {
                $token = trim((string) env('TELEGRAM_BOT_TOKEN', ''));
                $chatId = trim((string) ($user->telegram_chat_id ?? ''));
                if ($token !== '' && $chatId !== '') {
                    $http = new \GuzzleHttp\Client(['timeout' => 15, 'http_errors' => false]);
                    $http->post("https://api.telegram.org/bot{$token}/sendMessage", [
                        'json' => [
                            'chat_id' => $chatId,
                            'text' => $message,
                        ],
                    ]);
                }
            } catch (\Throwable $e) {
                $msg = (string) $e->getMessage();
                $msg = preg_replace('/bot\d+:[^\s\/]+/i', 'bot***', $msg) ?? $msg;
                Log::error('crypto_monitor:check telegram failed', ['user_id' => $user->id, 'error' => $msg]);
            }
        }

        if ($isFree && ($emailEnabled || $telegramEnabled)) {
            try {
                $dayKey = $now->format('Ymd');
                $sentKey = 'cm_free_daily_sent_' . (string) $user->id . '_' . $dayKey;
                $ttlSec = max(60, $now->copy()->endOfDay()->diffInSeconds($now) + 30);
                Cache::put($sentKey, true, $ttlSec);
            } catch (\Throwable $e) {
            }
        }
    }
}
