<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;

class AutoSignalsController extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    private function ensureFreeTrialStarted($user): void
    {
        if (!$user) {
            return;
        }

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

        $base = $user->created_at ? Carbon::parse($user->created_at) : Carbon::now();
        $user->trial_expires_at = $base->copy()->addDays(7);
        $user->save();
    }

    private function resolveAccessPayload($user): array
    {
        $trialExpiresAt = null;
        if (Schema::hasColumn('users', 'trial_expires_at') && $user && $user->trial_expires_at) {
            $trialExpiresAt = Carbon::parse($user->trial_expires_at)->toIso8601String();
        }

        $allowed = true;
        $reason = null;

        $plan = (string) ($user->plan ?? 'free');
        if (
            Schema::hasColumn('users', 'trial_expires_at') &&
            $plan === 'free' &&
            $user &&
            $user->trial_expires_at &&
            Carbon::parse($user->trial_expires_at)->isPast()
        ) {
            $allowed = false;
            $reason = 'trial_expired';
        }

        return [
            'allowed' => $allowed,
            'reason' => $reason,
            'trial_expires_at' => $trialExpiresAt,
        ];
    }

    private function resolveUser(Request $request)
    {
        return $request->user() ?: Auth::user();
    }

    public function getSettings(Request $request)
    {
        $user = $this->resolveUser($request);
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401)
                ->header('X-AutoSignals-Backend', 'server-php/app/Http/Controllers/AutoSignalsController.php');
        }

        $this->ensureFreeTrialStarted($user);
        $access = $this->resolveAccessPayload($user);
        $locked = !$access['allowed'];

        if ($locked && ($user->auto_signals_enabled ?? false)) {
            $user->auto_signals_enabled = false;
            $user->save();
        }

        $language = $user->language;
        if (!is_string($language) || trim($language) === '') {
            $language = 'ru';
        }
        $language = strtolower(substr($language, 0, 2));
        if (!in_array($language, ['ru', 'en', 'uk'], true)) {
            $language = 'ru';
        }

        $symbol = $user->auto_signal_symbol;
        if (!is_string($symbol) || trim($symbol) === '') {
            $symbol = 'BTC/USDT';
        }

        $tradingType = $user->auto_signal_trading_type;
        if (!is_string($tradingType) || trim($tradingType) === '') {
            $tradingType = 'Дейли трейдинг';
        }

        $confirmation = $user->auto_signal_confirmation;
        if (!is_string($confirmation) || trim($confirmation) === '') {
            $confirmation = 'ALL';
        }

        $minReliability = $user->auto_signal_min_reliability;
        if ($minReliability === null) {
            $minReliability = 60;
        }

        $checkInterval = $user->auto_signal_check_interval;
        if ($checkInterval === null) {
            $checkInterval = 5;
        }

        $capital = $user->auto_signal_capital;
        if (!is_numeric($capital) || (float) $capital <= 0) {
            $capital = 10000;
        }

        $strategy = $user->auto_signal_strategy;
        if (!is_string($strategy) || trim($strategy) === '') {
            $strategy = 'Сбалансированная';
        }

        $riskPercent = $user->auto_signal_risk;
        if (!is_numeric($riskPercent) || (float) $riskPercent <= 0) {
            $riskPercent = 1;
        }
        $riskPercent = (float) $riskPercent;
        if ($riskPercent > 0 && $riskPercent < 0.1) {
            $riskPercent = $riskPercent * 100.0;
        }
        if ($riskPercent > 100) {
            $riskPercent = 100;
        }

        return response()->json([
            'enabled' => $locked ? false : (bool) ($user->auto_signals_enabled ?? false),
            'symbol' => $symbol,
            'capital' => (float) $capital,
            'trading_type' => $tradingType,
            'strategy' => $strategy,
            'risk' => (float) $riskPercent,
            'confirmation' => $confirmation,
            'min_reliability' => $minReliability,
            'check_interval' => $checkInterval,
            'language' => $language,
            'enable_email_notifications' => (bool) ($user->enable_email_notifications ?? false),
            'enable_telegram_notifications' => (bool) ($user->enable_telegram_notifications ?? false),
            'telegram_chat_id' => $user->telegram_chat_id,
            'locked' => $locked,
            'access' => $access,
        ])->header('X-AutoSignals-Backend', 'server-php/app/Http/Controllers/AutoSignalsController.php');
    }

    public function status(Request $request)
    {
        $user = $this->resolveUser($request);
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401)
                ->header('X-AutoSignals-Backend', 'server-php/app/Http/Controllers/AutoSignalsController.php');
        }

        $this->ensureFreeTrialStarted($user);
        $access = $this->resolveAccessPayload($user);
        $locked = !$access['allowed'];

        if ($locked && ($user->auto_signals_enabled ?? false)) {
            $user->auto_signals_enabled = false;
            $user->save();
        }

        $now = Carbon::now();
        $checkInterval = (int) ($user->auto_signal_check_interval ?? 5);
        if ($checkInterval <= 0) {
            $checkInterval = 5;
        }

        $lastCheck = $user->auto_signal_last_check ? Carbon::parse($user->auto_signal_last_check) : null;
        $nextCheck = $lastCheck ? $lastCheck->copy()->addMinutes($checkInterval) : $now;
        $minutesUntilNext = $nextCheck->greaterThan($now) ? (int) $now->diffInMinutes($nextCheck) : 0;

        $lastFiredAt = $user->auto_signal_last_fired_at ? Carbon::parse($user->auto_signal_last_fired_at) : null;

        return response()->json([
            'enabled' => $locked ? false : (bool) ($user->auto_signals_enabled ?? false),
            'check_interval_minutes' => $checkInterval,
            'last_check' => $lastCheck ? $lastCheck->toIso8601String() : null,
            'next_check' => $nextCheck ? $nextCheck->toIso8601String() : null,
            'minutes_until_next' => $minutesUntilNext,
            'last_fired_at' => $lastFiredAt ? $lastFiredAt->toIso8601String() : null,
            'locked' => $locked,
            'access' => $access,
        ])->header('X-AutoSignals-Backend', 'server-php/app/Http/Controllers/AutoSignalsController.php');
    }

    public function saveSettings(Request $request)
    {
        $user = $this->resolveUser($request);
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401)
                ->header('X-AutoSignals-Backend', 'server-php/app/Http/Controllers/AutoSignalsController.php');
        }

        $this->ensureFreeTrialStarted($user);
        $access = $this->resolveAccessPayload($user);
        if (!$access['allowed']) {
            if (($user->auto_signals_enabled ?? false)) {
                $user->auto_signals_enabled = false;
                $user->save();
            }
            return $this->getSettings($request);
        }

        $data = $request->validate([
            'enabled' => 'required|boolean',
            'symbol' => 'nullable|string|max:50',
            'capital' => 'nullable|numeric|min:0',
            'trading_type' => 'nullable|string|max:50',
            'strategy' => 'nullable|string|max:50',
            'risk' => 'nullable|numeric|min:0|max:100',
            'confirmation' => 'nullable|string|max:500',
            'min_reliability' => 'nullable|integer|min:0|max:100',
            'check_interval' => 'nullable|integer|min:1|max:10080',
            'language' => 'nullable|string|max:5',
            'enable_email_notifications' => 'nullable|boolean',
            'enable_telegram_notifications' => 'nullable|boolean',
            'telegram_chat_id' => 'nullable|string|max:255',
        ]);

        $user->auto_signals_enabled = (bool) $data['enabled'];
        $user->auto_signal_symbol = $data['symbol'] ?? null;
        $user->auto_signal_capital = array_key_exists('capital', $data) ? ($data['capital'] !== null ? (float) $data['capital'] : null) : $user->auto_signal_capital;
        $user->auto_signal_trading_type = $data['trading_type'] ?? null;
        $user->auto_signal_strategy = $data['strategy'] ?? null;
        if (array_key_exists('risk', $data)) {
            $risk = $data['risk'];
            if ($risk === null) {
                $user->auto_signal_risk = null;
            } else {
                $risk = (float) $risk;
                if ($risk > 0 && $risk < 0.1) {
                    $risk = $risk * 100.0;
                }
                if ($risk > 100) {
                    $risk = 100;
                }
                $user->auto_signal_risk = $risk;
            }
        }
        $user->auto_signal_confirmation = $data['confirmation'] ?? null;
        $user->auto_signal_min_reliability = $data['min_reliability'] ?? null;
        $user->auto_signal_check_interval = $data['check_interval'] ?? null;

        if (array_key_exists('language', $data)) {
            $lang = $data['language'];
            if ($lang === null) {
                $user->language = null;
            } else {
                $lang = strtolower(substr(trim((string) $lang), 0, 2));
                $user->language = in_array($lang, ['ru', 'en', 'uk'], true) ? $lang : 'ru';
            }
        }

        if (array_key_exists('enable_email_notifications', $data)) {
            $user->enable_email_notifications = (bool) $data['enable_email_notifications'];
        }
        if (array_key_exists('enable_telegram_notifications', $data)) {
            $user->enable_telegram_notifications = (bool) $data['enable_telegram_notifications'];
        }
        if (array_key_exists('telegram_chat_id', $data)) {
            $user->telegram_chat_id = $data['telegram_chat_id'] ?: null;
        }

        $user->save();

        return $this->getSettings($request);
    }

    public function test(Request $request)
    {
        $user = $this->resolveUser($request);
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401)
                ->header('X-AutoSignals-Backend', 'server-php/app/Http/Controllers/AutoSignalsController.php');
        }

        $this->ensureFreeTrialStarted($user);
        $access = $this->resolveAccessPayload($user);
        if (!$access['allowed']) {
            if (($user->auto_signals_enabled ?? false)) {
                $user->auto_signals_enabled = false;
                $user->save();
            }
            return response()->json([
                'error' => 'Trial expired',
                'locked' => true,
                'access' => $access,
            ], 403)->header('X-AutoSignals-Backend', 'server-php/app/Http/Controllers/AutoSignalsController.php');
        }

        $lang = $request->input('language', null);
        if ($lang !== null) {
            $lang = strtolower(substr(trim((string) $lang), 0, 2));
            $user->language = in_array($lang, ['ru', 'en', 'uk'], true) ? $lang : 'ru';
            $user->save();
        }

        try {
            $exitCode = Artisan::call('signals:check', ['--user_id' => $user->id, '--force' => true]);
            $output = Artisan::output();
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Test failed',
                'message' => $e->getMessage(),
            ], 500)->header('X-AutoSignals-Backend', 'server-php/app/Http/Controllers/AutoSignalsController.php');
        }

        return response()->json([
            'message' => 'Test finished',
            'output' => $output ?? '',
        ])->header('X-AutoSignals-Backend', 'server-php/app/Http/Controllers/AutoSignalsController.php');
    }

    public function logs(Request $request)
    {
        $user = $this->resolveUser($request);
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401)
                ->header('X-AutoSignals-Backend', 'server-php/app/Http/Controllers/AutoSignalsController.php');
        }

        $limit = (int) $request->query('limit', 20);
        $limit = max(1, min(200, $limit));

        $items = DB::table('auto_signal_logs')
            ->where('user_id', $user->id)
            ->orderByDesc('id')
            ->limit($limit)
            ->get([
                'id',
                'symbol',
                'timeframe',
                'direction',
                'reliability',
                'price',
                'status',
                'fired_at',
                'message',
                'error',
                'meta',
                'created_at',
            ]);

        return response()->json(['items' => $items])
            ->header('X-AutoSignals-Backend', 'server-php/app/Http/Controllers/AutoSignalsController.php');
    }
}
