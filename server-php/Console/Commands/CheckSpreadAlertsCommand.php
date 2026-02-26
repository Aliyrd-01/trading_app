<?php

namespace App\Console\Commands;

use App\Models\SpreadAlertRule;
use App\Models\User;
use App\Services\ExchangeTickerService;
use Carbon\Carbon;
use GuzzleHttp\Client;
use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;

class CheckSpreadAlertsCommand extends Command
{
    protected $signature = 'spread:check {--user_id=} {--force}';

    protected $description = 'Check inter-exchange bid/ask spreads for user rules and send notifications.';

    public function handle(): int
    {
        $userId = $this->option('user_id');
        $force = (bool) $this->option('force');
        $explicitRun = (bool) $userId || $force;

        $rulesQuery = SpreadAlertRule::query()->where('enabled', 1);
        if ($userId) {
            $rulesQuery->where('user_id', $userId);
        }

        if ($explicitRun) {
            $this->info('spread:check started');
            $count = (int) $rulesQuery->count();
            $this->line("rules: {$count}");
            if ($count === 0) {
                $this->warn('No rules matched query');
                return self::SUCCESS;
            }
        }

        $ticker = new ExchangeTickerService();
        $now = Carbon::now();

        $rulesQuery->orderBy('id')->chunkById(200, function ($rules) use ($ticker, $now, $force, $explicitRun) {
            foreach ($rules as $rule) {
                try {
                    $user = User::find($rule->user_id);
                    if (!$user) {
                        continue;
                    }

                    if (Schema::hasColumn('users', 'spread_alerts_enabled') && !((bool) ($user->spread_alerts_enabled ?? false))) {
                        if ($explicitRun) {
                            $this->warn("SKIP disabled user_id={$user->id} rule_id={$rule->id}");
                        }
                        continue;
                    }

                    $this->ensureFreeTrialStarted($user, $now);
                    $access = $this->userHasSpreadAlertsAccess($user, $now);
                    if (!$access) {
                        if ($explicitRun) {
                            $this->warn("SKIP no access user_id={$user->id} rule_id={$rule->id}");
                            $this->logSpreadAlert($user->id, $rule->id, [
                                'status' => 'skipped',
                                'error' => 'trial_expired',
                            ]);
                        }
                        continue;
                    }

                    $this->processRule($user, $rule, $ticker, $now, $force, $explicitRun);
                } catch (\Throwable $e) {
                    Log::error('spread:check rule failed', [
                        'rule_id' => $rule->id,
                        'user_id' => $rule->user_id,
                        'error' => $e->getMessage(),
                    ]);

                    try {
                        $this->logSpreadAlert((int) $rule->user_id, (int) $rule->id, [
                            'status' => 'error',
                            'error' => $e->getMessage(),
                        ]);
                    } catch (\Throwable $e2) {
                    }
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

    private function userHasSpreadAlertsAccess(User $user, Carbon $now): bool
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

    private function resolvePlanLimits(User $user): array
    {
        $plan = (string) ($user->plan ?? 'free');

        $minIntervalMinutes = 5;
        $maxRules = 1;

        if ($plan !== 'free') {
            $minIntervalMinutes = 1;
            $maxRules = 50;
        }

        return [
            'min_interval_minutes' => $minIntervalMinutes,
            'max_rules' => $maxRules,
        ];
    }

    private function processRule(User $user, SpreadAlertRule $rule, ExchangeTickerService $ticker, Carbon $now, bool $force, bool $explicitRun): void
    {
        $limits = $this->resolvePlanLimits($user);
        $checkIntervalMinutes = (int) ($rule->check_interval_minutes ?? 1);
        $checkIntervalMinutes = max((int) $limits['min_interval_minutes'], max(1, $checkIntervalMinutes));

        $lastChecked = $rule->last_checked_at ? Carbon::parse($rule->last_checked_at) : null;
        if (!$force && $lastChecked && $lastChecked->diffInMinutes($now) < $checkIntervalMinutes) {
            if ($explicitRun) {
                $this->warn("SKIP interval rule_id={$rule->id}");
                $this->logSpreadAlert((int) $user->id, (int) $rule->id, [
                    'status' => 'skipped',
                    'error' => 'interval',
                ]);
            }
            return;
        }

        $cooldownSeconds = (int) ($rule->cooldown_seconds ?? 300);
        if ($cooldownSeconds < 0) {
            $cooldownSeconds = 0;
        }

        $lastFiredAt = $rule->last_fired_at ? Carbon::parse($rule->last_fired_at) : null;
        if (!$force && $cooldownSeconds > 0 && $lastFiredAt && $lastFiredAt->diffInSeconds($now) < $cooldownSeconds) {
            $rule->last_checked_at = $now;
            $rule->save();
            if ($explicitRun) {
                $this->warn("SKIP cooldown rule_id={$rule->id}");
            }
            return;
        }

        $symbol = (string) ($rule->symbol ?? '');
        $exchanges = $rule->exchanges;
        if (!is_array($exchanges)) {
            $exchanges = [];
        }
        $exchanges = array_values(array_filter(array_map('strval', $exchanges), fn ($s) => trim($s) !== ''));
        $exchanges = array_values(array_unique($exchanges));

        if ($symbol === '' || count($exchanges) < 2) {
            $rule->last_checked_at = $now;
            $rule->save();
            if ($explicitRun) {
                $this->warn("SKIP invalid rule rule_id={$rule->id}");
            }
            return;
        }

        $prices = [];
        foreach ($exchanges as $ex) {
            $ba = $ticker->getBidAsk($ex, $symbol);
            if (is_array($ba) && isset($ba['bid']) && isset($ba['ask'])) {
                $prices[$ex] = $ba;
            }
        }

        if (count($prices) < 2) {
            $rule->last_checked_at = $now;
            $rule->save();
            if ($explicitRun) {
                $this->warn("SKIP insufficient prices rule_id={$rule->id}");
                $this->logSpreadAlert((int) $user->id, (int) $rule->id, [
                    'status' => 'skipped',
                    'error' => 'insufficient_prices',
                    'prices' => $prices,
                ]);
            }
            return;
        }

        $minAskEx = '';
        $minAsk = null;
        $maxBidEx = '';
        $maxBid = null;

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
            $rule->last_checked_at = $now;
            $rule->save();
            return;
        }

        $spreadPercent = ($maxBid - $minAsk) / $minAsk * 100.0;
        $threshold = (float) ($rule->threshold_percent ?? 0);
        if ($threshold < 0) {
            $threshold = 0;
        }

        $bucket = $now->format('Y-m-d H:i');
        $spreadRounded = number_format($spreadPercent, 2, '.', '');
        $firedKey = implode('|', [
            (string) $rule->id,
            strtoupper($symbol),
            (string) $minAskEx,
            (string) $maxBidEx,
            (string) $spreadRounded,
            (string) $bucket,
        ]);

        $rule->last_checked_at = $now;

        if ($spreadPercent < $threshold) {
            $rule->save();
            if ($explicitRun) {
                $this->line("SKIP threshold rule_id={$rule->id} spread={$spreadRounded}% threshold={$threshold}%");
                $this->logSpreadAlert((int) $user->id, (int) $rule->id, [
                    'status' => 'skipped',
                    'error' => 'threshold',
                    'spread_percent' => $spreadPercent,
                    'prices' => $prices,
                ]);
            }
            return;
        }

        if (!$force && is_string($rule->last_fired_key) && $rule->last_fired_key !== '' && $rule->last_fired_key === $firedKey) {
            $rule->save();
            if ($explicitRun) {
                $this->warn("SKIP dedupe rule_id={$rule->id}");
            }
            return;
        }

        $message = $this->formatMessage($user, $symbol, $spreadPercent, $minAskEx, $minAsk, $maxBidEx, $maxBid, $threshold, $now);

        try {
            $this->logSpreadAlert((int) $user->id, (int) $rule->id, [
                'status' => 'fired',
                'spread_percent' => $spreadPercent,
                'prices' => $prices,
                'message' => $message['text'],
                'fired_key' => $firedKey,
                'fired_at' => $now,
            ]);
        } catch (QueryException $e) {
            $msg = $e->getMessage();
            if (stripos($msg, 'Duplicate') !== false) {
                $rule->save();
                return;
            }
            throw $e;
        }

        $this->sendNotifications($user, $message['text'], $message['subject']);

        $rule->last_fired_at = $now;
        $rule->last_fired_key = $firedKey;
        $rule->save();

        if ($explicitRun) {
            $this->info("FIRED rule_id={$rule->id} {$symbol} spread={$spreadRounded}% buy={$minAskEx}@{$minAsk} sell={$maxBidEx}@{$maxBid}");
        }
    }

    private function formatMessage(User $user, string $symbol, float $spreadPercent, string $minAskEx, float $minAsk, string $maxBidEx, float $maxBid, float $threshold, Carbon $now): array
    {
        $lang = (string) ($user->language ?? 'ru');
        $lang = strtolower(substr(trim($lang), 0, 2));
        if (!in_array($lang, ['ru', 'en', 'uk'], true)) {
            $lang = 'ru';
        }

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
            $subject = "🚨 Crypto Monitor. New trading signal! {$symbol}: {$spreadStr}%";
            $text = "🚨 New trading signal!\n\n📊 Pair: {$symbol}\nSpread: {$spreadStr}% (threshold {$thresholdStr}%)\nBuy (min ask): {$minAskEx} @ {$minAsk}\nSell (max bid): {$maxBidEx} @ {$maxBid}\n\n⏰ Time: {$timeText}";
        } elseif ($lang === 'uk') {
            $subject = "🚨 Crypto Monitor. Новий торговий сигнал! {$symbol}: {$spreadStr}%";
            $text = "🚨 Новий торговий сигнал!\n\n📊 Пара: {$symbol}\nСпред: {$spreadStr}% (поріг {$thresholdStr}%)\nКупівля (min ask): {$minAskEx} @ {$minAsk}\nПродаж (max bid): {$maxBidEx} @ {$maxBid}\n\n⏰ Час: {$timeText}";
        } else {
            $subject = "🚨 Crypto Monitor. Новый торговый сигнал! {$symbol}: {$spreadStr}%";
            $text = "🚨 Новый торговый сигнал!\n\n📊 Пара: {$symbol}\nСпред: {$spreadStr}% (порог {$thresholdStr}%)\nПокупка (min ask): {$minAskEx} @ {$minAsk}\nПродажа (max bid): {$maxBidEx} @ {$maxBid}\n\n⏰ Время: {$timeText}";
        }

        return [
            'subject' => $subject,
            'text' => $text,
        ];
    }

    private function sendNotifications(User $user, string $message, string $subject): void
    {
        $emailEnabled = (int) ($user->enable_email_notifications ?? 0) === 1;
        $telegramEnabled = (int) ($user->spread_enable_telegram_notifications ?? 0) === 1;

        if ($emailEnabled && !empty($user->email)) {
            try {
                $finalSubject = $subject !== '' ? $subject : 'Spread alert';
                Mail::raw($message, function ($m) use ($user, $finalSubject) {
                    $m->to($user->email)->subject($finalSubject);
                });
            } catch (\Throwable $e) {
                Log::error('spread:check email failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            }
        }

        if ($telegramEnabled && !empty($user->spread_telegram_chat_id)) {
            try {
                $chatId = trim((string) $user->spread_telegram_chat_id);
                if ($chatId !== '') {
                    $this->sendTelegram($chatId, $message);
                }
            } catch (\Throwable $e) {
                Log::error('spread:check telegram failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            }
        }
    }

    private function sendTelegram(string $chatId, string $message): void
    {
        $token = trim((string) env('TELEGRAM_BOT_TOKEN', ''));
        if ($token === '') {
            return;
        }

        try {
            $http = new Client(['timeout' => 15, 'http_errors' => false]);
            $resp = $http->post("https://api.telegram.org/bot{$token}/sendMessage", [
                'form_params' => [
                    'chat_id' => $chatId,
                    'text' => $message,
                    'disable_web_page_preview' => true,
                ],
            ]);

            $status = (int) $resp->getStatusCode();
            if ($status < 200 || $status >= 300) {
                Log::error('spread:check telegram bad response', [
                    'status' => $status,
                    'body' => $resp->getBody()->getContents(),
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('spread:check telegram exception', ['error' => $e->getMessage()]);
        }
    }

    private function logSpreadAlert(int $userId, int $ruleId, array $data): void
    {
        $payload = array_merge([
            'user_id' => $userId,
            'rule_id' => $ruleId,
            'status' => 'error',
            'created_at' => Carbon::now(),
            'updated_at' => Carbon::now(),
        ], $data);

        if (array_key_exists('prices', $payload) && is_array($payload['prices'])) {
            $payload['prices'] = json_encode($payload['prices']);
        }

        DB::table('spread_alert_logs')->insert($payload);
    }
}
