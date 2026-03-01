<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Carbon\Carbon;

class CryptoMonitorSettingsController extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    private int $cryptoMonitorNotifyCooldownSec = 600;

    private function isFreeEffectivePlan($user): bool
    {
        $plan = (string) ($user->effective_plan ?? ($user->plan ?? 'free'));
        $plan = strtolower(trim($plan));
        if ($plan === '' || $plan === 'free' || $plan === 'basic' || $plan === 'trial') {
            return true;
        }
        return false;
    }

    private function resolveUser(Request $request)
    {
        return $request->user() ?: Auth::user();
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

    private function getDefaultSettings(): array
    {
        return [
            'interval_sec' => 300,
            'quote' => 'USDT',
            'tokens_to_scan' => 1000,
            'top_n' => 30,
            'alert_percent_min' => 1.0,
            'alert_percent_max' => 100.0,
            'selected_exchanges' => [],
        ];
    }

    private function buildSettingsPayload($user): array
    {
        $defaults = $this->getDefaultSettings();

        $interval = $user->crypto_monitor_interval_sec;
        if (!is_numeric($interval) || (int) $interval <= 0) {
            $interval = $defaults['interval_sec'];
        }

        $quote = $user->crypto_monitor_quote;
        if (!is_string($quote) || trim($quote) === '') {
            $quote = $defaults['quote'];
        }
        $quote = strtoupper(trim($quote));
        $allowedQuotes = ['USDT', 'USDC', 'BTC', 'ETH', 'USD'];
        if (!in_array($quote, $allowedQuotes, true)) {
            $quote = $defaults['quote'];
        }

        $tokens = $user->crypto_monitor_tokens_to_scan;
        if (!is_numeric($tokens) || (int) $tokens <= 0) {
            $tokens = $defaults['tokens_to_scan'];
        }

        $topN = $user->crypto_monitor_top_n;
        if (!is_numeric($topN) || (int) $topN <= 0) {
            $topN = $defaults['top_n'];
        }
        $topN = min(100, (int) $topN);

        $minAlert = $user->crypto_monitor_alert_percent_min;
        if (!is_numeric($minAlert) || (float) $minAlert < 0) {
            $minAlert = $defaults['alert_percent_min'];
        }

        $maxAlert = $user->crypto_monitor_alert_percent_max;
        if (!is_numeric($maxAlert) || (float) $maxAlert < 0) {
            $maxAlert = $defaults['alert_percent_max'];
        }
        $minAlert = (float) $minAlert;
        $maxAlert = (float) $maxAlert;
        if ($maxAlert <= 0) {
            $maxAlert = $defaults['alert_percent_max'];
        }
        if ($maxAlert < $minAlert) {
            $maxAlert = $minAlert;
        }

        $exchanges = $user->crypto_monitor_selected_exchanges;
        if (is_string($exchanges)) {
            try {
                $decoded = json_decode($exchanges, true);
                $exchanges = $decoded;
            } catch (\Throwable $e) {
            }
        }
        $exchanges = $this->normalizeExchanges($exchanges);

        $isFree = $this->isFreeEffectivePlan($user);
        $freeLeftToday = null;
        if ($isFree) {
            try {
                $dayKey = Carbon::now()->format('Ymd');
                $sentKey = 'cm_free_daily_sent_' . (string) $user->id . '_' . $dayKey;
                $already = (bool) (Cache::get($sentKey) ?: false);
                $freeLeftToday = $already ? 0 : 1;
            } catch (\Throwable $e) {
                $freeLeftToday = 1;
            }
        }

        return [
            'interval_sec' => (int) $interval,
            'quote' => $quote,
            'tokens_to_scan' => (int) $tokens,
            'top_n' => (int) $topN,
            'alert_percent_min' => (float) $minAlert,
            'alert_percent_max' => (float) $maxAlert,
            'selected_exchanges' => $exchanges,
            'quote_options' => $allowedQuotes,
            'free_notifications_left_today' => $freeLeftToday,
        ];
    }

    private function formatCryptoMonitorBlock(string $lang, string $pair, float $spreadPercent, string $minAskEx, $minAsk, string $maxBidEx, $maxBid, float $threshold, Carbon $now): string
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
            return "📊 Pair: {$pair}\nSpread: {$spreadStr}% (threshold {$thresholdStr}%)\nBuy (min ask): {$minAskEx} @ {$minAsk}\nSell (max bid): {$maxBidEx} @ {$maxBid}";
        }
        if ($lang === 'uk') {
            return "📊 Пара: {$pair}\nСпред: {$spreadStr}% (поріг {$thresholdStr}%)\nКупівля (min ask): {$minAskEx} @ {$minAsk}\nПродаж (max bid): {$maxBidEx} @ {$maxBid}";
        }
        return "📊 Пара: {$pair}\nСпред: {$spreadStr}% (порог {$thresholdStr}%)\nПокупка (min ask): {$minAskEx} @ {$minAsk}\nПродажа (max bid): {$maxBidEx} @ {$maxBid}";
    }

    private function sendTelegram(string $chatId, string $message): void
    {
        $token = trim((string) env('TELEGRAM_BOT_TOKEN', ''));
        $chatId = trim((string) $chatId);
        if ($token === '' || $chatId === '') {
            return;
        }

        try {
            $http = new \GuzzleHttp\Client(['timeout' => 15, 'http_errors' => false]);
            $http->post("https://api.telegram.org/bot{$token}/sendMessage", [
                'form_params' => [
                    'chat_id' => $chatId,
                    'text' => $message,
                    'disable_web_page_preview' => true,
                ],
            ]);
        } catch (\Throwable $e) {
            try {
                Log::error('crypto_monitor telegram failed', ['error' => $e->getMessage()]);
            } catch (\Throwable $e2) {
            }
        }
    }

    public function scanResults(Request $request)
    {
        $user = $this->resolveUser($request);
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401)
                ->header('X-CryptoMonitorSettings-Backend', 'server-php/app/Http/Controllers/CryptoMonitorSettingsController.php');
        }

        $data = $request->validate([
            'results' => 'required|array|min:1|max:1000',
            'quote' => 'nullable|string|max:10',
        ]);

        $now = Carbon::now();

        $lang = (string) ($user->language ?? 'ru');
        $lang = strtolower(substr(trim($lang), 0, 2));
        if (!in_array($lang, ['ru', 'en', 'uk'], true)) {
            $lang = 'ru';
        }

        $settings = $this->buildSettingsPayload($user);
        $threshold = (float) ($settings['alert_percent_min'] ?? 0);
        $thresholdMax = (float) ($settings['alert_percent_max'] ?? 100.0);
        if ($thresholdMax <= 0) {
            $thresholdMax = 100.0;
        }
        if ($thresholdMax < $threshold) {
            $thresholdMax = $threshold;
        }
        $topN = min(100, (int) ($settings['top_n'] ?? 30));
        $topN = max(1, $topN);
        $quote = strtoupper(trim((string) (($data['quote'] ?? null) ?: ($settings['quote'] ?? 'USDT'))));

        $rows = [];
        foreach (($data['results'] ?? []) as $r) {
            if (!is_array($r)) {
                continue;
            }
            $symbol = strtoupper(trim((string) ($r['symbol'] ?? '')));
            if ($symbol === '') {
                continue;
            }
            $pair = str_contains($symbol, '/') ? $symbol : ($symbol . '/' . $quote);

            $spread = $r['spread_pct'] ?? $r['spreadPercent'] ?? null;
            if (!is_numeric($spread)) {
                continue;
            }
            $spread = (float) $spread;

            $minEx = (string) ($r['min_ex'] ?? $r['min_mkt'] ?? $r['buy_exchange'] ?? '');
            $maxEx = (string) ($r['max_ex'] ?? $r['max_mkt'] ?? $r['sell_exchange'] ?? '');
            if (trim($minEx) === '' || trim($maxEx) === '') {
                continue;
            }

            $minPrice = $r['min'] ?? $r['min_price'] ?? $r['buy_price'] ?? null;
            $maxPrice = $r['max'] ?? $r['max_price'] ?? $r['sell_price'] ?? null;
            if (!is_numeric($minPrice) || !is_numeric($maxPrice)) {
                continue;
            }

            $rows[] = [
                'pair' => $pair,
                'spread_pct' => $spread,
                'min_ex' => trim($minEx),
                'min_price' => (float) $minPrice,
                'max_ex' => trim($maxEx),
                'max_price' => (float) $maxPrice,
            ];
        }

        if (count($rows) === 0) {
            return response()->json(['ok' => true, 'sent' => false, 'reason' => 'no_valid_rows']);
        }

        usort($rows, function ($a, $b) {
            return ($b['spread_pct'] <=> $a['spread_pct']);
        });

        $rowsFiltered = [];
        foreach ($rows as $r) {
            $sp = (float) ($r['spread_pct'] ?? 0);
            if ($sp >= $threshold && $sp <= $thresholdMax) {
                $rowsFiltered[] = $r;
            }
        }

        if (count($rowsFiltered) === 0) {
            return response()->json(['ok' => true, 'sent' => false, 'reason' => 'no_rows_in_threshold']);
        }

        // Manual run should show up to topN results (within the configured threshold range).
        $rowsDisplay = array_slice($rowsFiltered, 0, min($topN, count($rowsFiltered)));
        if (count($rowsDisplay) === 0) {
            return response()->json(['ok' => true, 'sent' => false, 'reason' => 'no_rows_in_threshold']);
        }

        // Notifications must send the first 10 from the same list as manual run.
        $notifyN = min(10, count($rowsDisplay));
        $notifyN = max(1, $notifyN);
        $rowsTop = array_slice($rowsDisplay, 0, $notifyN);

        $cacheKey = 'cm_notify_last_ts_user_' . (string) $user->id;
        $lastTs = (int) (Cache::get($cacheKey) ?: 0);
        $nowTs = time();
        if ($lastTs > 0 && ($nowTs - $lastTs) < $this->cryptoMonitorNotifyCooldownSec) {
            return response()->json(['ok' => true, 'sent' => false, 'reason' => 'rate_limited'], 429);
        }

        $header = $lang === 'en'
            ? "🚨 New trading signal!\n\n"
            : ($lang === 'uk' ? "🚨 Новий торговий сигнал!\n\n" : "🚨 Новый торговый сигнал!\n\n");

        $blocks = [];
        foreach ($rowsTop as $r) {
            $blocks[] = $this->formatCryptoMonitorBlock(
                $lang,
                (string) $r['pair'],
                (float) $r['spread_pct'],
                (string) $r['min_ex'],
                (string) $r['min_price'],
                (string) $r['max_ex'],
                (string) $r['max_price'],
                $threshold,
                $now
            );
        }

        $timeText = $now->toDateTimeString();

        $subjectPrefix = '🚨 Crypto Monitor. ';

        $subject = '';
        if (count($rowsTop) === 1 && isset($rowsTop[0]) && is_array($rowsTop[0])) {
            $pair = (string) ($rowsTop[0]['pair'] ?? '');
            $spreadStr = number_format((float) ($rowsTop[0]['spread_pct'] ?? 0), 2, '.', '');
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

        $subject = preg_replace('/^\s*🚨\s*/u', '', (string) $subject) ?? (string) $subject;
        $subject = '🚨 ' . $subject;

        $message = $header . implode("\n\n----------------\n\n", $blocks) . "\n\n";
        if ($lang === 'en') {
            $message .= "⏰ Time: {$timeText}";
        } elseif ($lang === 'uk') {
            $message .= "⏰ Час: {$timeText}";
        } else {
            $message .= "⏰ Время: {$timeText}";
        }

        $emailEnabled = (int) ($user->enable_email_notifications ?? 0) === 1;
        $telegramEnabled = (int) ($user->enable_telegram_notifications ?? 0) === 1;

        $sent = false;

        $isFree = $this->isFreeEffectivePlan($user);
        if ($isFree && ($emailEnabled || $telegramEnabled)) {
            try {
                $dayKey = $now->format('Ymd');
                $sentKey = 'cm_free_daily_sent_' . (string) $user->id . '_' . $dayKey;
                if ((bool) (Cache::get($sentKey) ?: false)) {
                    return response()->json(['ok' => true, 'sent' => false, 'reason' => 'free_daily_limit'], 429);
                }
            } catch (\Throwable $e) {
            }
        }

        if ($emailEnabled && !empty($user->email)) {
            try {
                Mail::raw($message, function ($m) use ($user, $subject) {
                    $m->to($user->email)->subject($subject);
                });
                $sent = true;
            } catch (\Throwable $e) {
                Log::error('crypto_monitor scan_results email failed', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if ($telegramEnabled && !empty($user->telegram_chat_id)) {
            try {
                $this->sendTelegram((string) $user->telegram_chat_id, $message);
                $sent = true;
            } catch (\Throwable $e) {
                Log::error('crypto_monitor scan_results telegram failed', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if ($sent) {
            Cache::put($cacheKey, $nowTs, max(120, $this->cryptoMonitorNotifyCooldownSec + 30));

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

        return response()->json([
            'ok' => true,
            'sent' => $sent,
            'shown' => count($rowsTop),
            'rows_top' => $rowsTop,
            'rows_display' => $rowsDisplay,
            'top_n' => $topN,
            'alert_percent_min' => $threshold,
            'alert_percent_max' => $thresholdMax,
        ]);
    }

    public function getSettings(Request $request)
    {
        $user = $this->resolveUser($request);
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401)
                ->header('X-CryptoMonitorSettings-Backend', 'server-php/app/Http/Controllers/CryptoMonitorSettingsController.php');
        }

        return response()->json($this->buildSettingsPayload($user))
            ->header('X-CryptoMonitorSettings-Backend', 'server-php/app/Http/Controllers/CryptoMonitorSettingsController.php');
    }

    public function saveSettings(Request $request)
    {
        $user = $this->resolveUser($request);
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401)
                ->header('X-CryptoMonitorSettings-Backend', 'server-php/app/Http/Controllers/CryptoMonitorSettingsController.php');
        }

        $data = $request->validate([
            'interval_sec' => 'nullable|integer|min:1|max:86400',
            'quote' => 'nullable|string|max:10',
            'tokens_to_scan' => 'nullable|integer|min:1|max:10000',
            'top_n' => 'nullable|integer|min:1|max:100',
            'alert_percent_min' => 'nullable|numeric|min:0|max:100',
            'alert_percent_max' => 'nullable|numeric|min:0|max:100',
            'selected_exchanges' => 'nullable|array',
        ]);

        if (array_key_exists('selected_exchanges', $data)) {
            $exchangesNorm = $this->normalizeExchanges($data['selected_exchanges']);
            if (count($exchangesNorm) < 2) {
                return response()->json(['error' => ''], 422)
                    ->header('X-CryptoMonitorSettings-Backend', 'server-php/app/Http/Controllers/CryptoMonitorSettingsController.php');
            }
            $data['selected_exchanges'] = $exchangesNorm;
        }

        if (array_key_exists('alert_percent_min', $data) && $data['alert_percent_min'] !== null) {
            $v = $data['alert_percent_min'];
            if (!is_numeric($v)) {
                return response()->json(['error' => 'alert_percent_min must be numeric'], 422)
                    ->header('X-CryptoMonitorSettings-Backend', 'server-php/app/Http/Controllers/CryptoMonitorSettingsController.php');
            }
            $f = (float) $v;
            if ($f < 0 || $f > 100) {
                return response()->json(['error' => 'alert_percent_min must be between 0 and 100'], 422)
                    ->header('X-CryptoMonitorSettings-Backend', 'server-php/app/Http/Controllers/CryptoMonitorSettingsController.php');
            }
            $data['alert_percent_min'] = $f;
        }

        if (array_key_exists('alert_percent_max', $data) && $data['alert_percent_max'] !== null) {
            $v = $data['alert_percent_max'];
            if (!is_numeric($v)) {
                return response()->json(['error' => 'alert_percent_max must be numeric'], 422)
                    ->header('X-CryptoMonitorSettings-Backend', 'server-php/app/Http/Controllers/CryptoMonitorSettingsController.php');
            }
            $f = (float) $v;
            if ($f < 0 || $f > 100) {
                return response()->json(['error' => 'alert_percent_max must be between 0 and 100'], 422)
                    ->header('X-CryptoMonitorSettings-Backend', 'server-php/app/Http/Controllers/CryptoMonitorSettingsController.php');
            }
            $data['alert_percent_max'] = $f;
        }

        if (
            array_key_exists('alert_percent_min', $data) && $data['alert_percent_min'] !== null &&
            array_key_exists('alert_percent_max', $data) && $data['alert_percent_max'] !== null
        ) {
            if ((float) $data['alert_percent_max'] < (float) $data['alert_percent_min']) {
                $data['alert_percent_max'] = (float) $data['alert_percent_min'];
            }
        }

        $isFree = $this->isFreeEffectivePlan($user);
        if ($isFree) {
            if (array_key_exists('interval_sec', $data) && is_numeric($data['interval_sec'])) {
                $data['interval_sec'] = max(900, (int) $data['interval_sec']);
            }
            if (array_key_exists('tokens_to_scan', $data) && is_numeric($data['tokens_to_scan'])) {
                $data['tokens_to_scan'] = min(50, (int) $data['tokens_to_scan']);
            }
            if (array_key_exists('top_n', $data) && is_numeric($data['top_n'])) {
                $data['top_n'] = min(5, (int) $data['top_n']);
            }
        } else {
            if (array_key_exists('tokens_to_scan', $data) && is_numeric($data['tokens_to_scan'])) {
                $data['tokens_to_scan'] = min(10000, (int) $data['tokens_to_scan']);
            }
        }

        if (array_key_exists('interval_sec', $data)) {
            $user->crypto_monitor_interval_sec = $data['interval_sec'];
        }
        if (array_key_exists('quote', $data)) {
            $user->crypto_monitor_quote = $data['quote'];
        }
        if (array_key_exists('tokens_to_scan', $data)) {
            $user->crypto_monitor_tokens_to_scan = $data['tokens_to_scan'];
        }
        if (array_key_exists('top_n', $data)) {
            $user->crypto_monitor_top_n = $data['top_n'];
        }
        if (array_key_exists('alert_percent_min', $data)) {
            $user->crypto_monitor_alert_percent_min = $data['alert_percent_min'] !== null ? (float) $data['alert_percent_min'] : null;
        }
        if (array_key_exists('alert_percent_max', $data)) {
            $user->crypto_monitor_alert_percent_max = $data['alert_percent_max'] !== null ? (float) $data['alert_percent_max'] : null;
        }
        if (array_key_exists('selected_exchanges', $data)) {
            $user->crypto_monitor_selected_exchanges = $data['selected_exchanges'];
        }

        $user->save();

        return response()->json($this->buildSettingsPayload($user))
            ->header('X-CryptoMonitorSettings-Backend', 'server-php/app/Http/Controllers/CryptoMonitorSettingsController.php');
    }
}
