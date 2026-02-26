<?php

namespace App\Http\Controllers;

use App\Models\SpreadAlertRule;
use Carbon\Carbon;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class SpreadAlertsController extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    private function resolveUser(Request $request)
    {
        return $request->user() ?: Auth::user();
    }

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

    private function resolvePlanLimits($user): array
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

    public function getSettings(Request $request)
    {
        $user = $this->resolveUser($request);
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401)
                ->header('X-SpreadAlerts-Backend', 'server-php/app/Http/Controllers/SpreadAlertsController.php');
        }

        $this->ensureFreeTrialStarted($user);
        $access = $this->resolveAccessPayload($user);
        $limits = $this->resolvePlanLimits($user);

        $locked = !$access['allowed'];
        if ($locked && ($user->spread_alerts_enabled ?? false)) {
            $user->spread_alerts_enabled = false;
            $user->save();
        }

        $rules = SpreadAlertRule::query()
            ->where('user_id', $user->id)
            ->orderByDesc('id')
            ->limit(200)
            ->get();

        return response()->json([
            'items' => $rules,
            'enabled' => $locked ? false : (bool) ($user->spread_alerts_enabled ?? false),
            'access' => $access,
            'limits' => $limits,
        ])->header('X-SpreadAlerts-Backend', 'server-php/app/Http/Controllers/SpreadAlertsController.php');
    }

    public function saveSettings(Request $request)
    {
        $user = $this->resolveUser($request);
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401)
                ->header('X-SpreadAlerts-Backend', 'server-php/app/Http/Controllers/SpreadAlertsController.php');
        }

        $this->ensureFreeTrialStarted($user);
        $access = $this->resolveAccessPayload($user);
        if (!$access['allowed']) {
            if (($user->spread_alerts_enabled ?? false)) {
                $user->spread_alerts_enabled = false;
                $user->save();
            }
            return $this->getSettings($request);
        }

        $data = $request->validate([
            'enabled' => 'required|boolean',
        ]);

        $user->spread_alerts_enabled = (bool) $data['enabled'];
        $user->save();

        return $this->getSettings($request);
    }

    public function saveRule(Request $request)
    {
        $user = $this->resolveUser($request);
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401)
                ->header('X-SpreadAlerts-Backend', 'server-php/app/Http/Controllers/SpreadAlertsController.php');
        }

        $this->ensureFreeTrialStarted($user);
        $access = $this->resolveAccessPayload($user);
        if (!$access['allowed']) {
            return $this->getSettings($request);
        }

        $limits = $this->resolvePlanLimits($user);

        $data = $request->validate([
            'id' => 'nullable|integer',
            'enabled' => 'required|boolean',
            'symbol' => 'required|string|max:50',
            'exchanges' => 'required|array|min:2|max:50',
            'exchanges.*' => 'string|max:50',
            'threshold_percent' => 'required|numeric|min:0|max:100',
            'check_interval_minutes' => 'required|integer|min:1|max:10080',
            'cooldown_seconds' => 'nullable|integer|min:0|max:86400',
        ]);

        $checkInterval = max((int) $limits['min_interval_minutes'], (int) $data['check_interval_minutes']);

        $ruleId = isset($data['id']) && is_numeric($data['id']) ? (int) $data['id'] : null;
        $rule = null;
        if ($ruleId) {
            $rule = SpreadAlertRule::query()->where('user_id', $user->id)->where('id', $ruleId)->first();
        }

        if (!$rule) {
            $count = (int) SpreadAlertRule::query()->where('user_id', $user->id)->count();
            if ($count >= (int) $limits['max_rules']) {
                return response()->json([
                    'error' => 'Rules limit reached',
                    'access' => $access,
                    'limits' => $limits,
                ], 403)->header('X-SpreadAlerts-Backend', 'server-php/app/Http/Controllers/SpreadAlertsController.php');
            }
            $rule = new SpreadAlertRule();
            $rule->user_id = $user->id;
        }

        $rule->enabled = (bool) $data['enabled'];
        $rule->symbol = (string) $data['symbol'];
        $rule->exchanges = array_values(array_unique(array_map('strval', $data['exchanges'])));
        $rule->threshold_percent = (float) $data['threshold_percent'];
        $rule->check_interval_minutes = $checkInterval;
        if (array_key_exists('cooldown_seconds', $data)) {
            $rule->cooldown_seconds = $data['cooldown_seconds'] !== null ? (int) $data['cooldown_seconds'] : $rule->cooldown_seconds;
        }
        if (!$rule->cooldown_seconds && $rule->cooldown_seconds !== 0) {
            $rule->cooldown_seconds = 300;
        }

        $rule->save();

        return $this->getSettings($request);
    }

    public function deleteRule(Request $request)
    {
        $user = $this->resolveUser($request);
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401)
                ->header('X-SpreadAlerts-Backend', 'server-php/app/Http/Controllers/SpreadAlertsController.php');
        }

        $data = $request->validate([
            'id' => 'required|integer',
        ]);

        SpreadAlertRule::query()
            ->where('user_id', $user->id)
            ->where('id', (int) $data['id'])
            ->delete();

        return $this->getSettings($request);
    }

    public function status(Request $request)
    {
        $user = $this->resolveUser($request);
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401)
                ->header('X-SpreadAlerts-Backend', 'server-php/app/Http/Controllers/SpreadAlertsController.php');
        }

        $this->ensureFreeTrialStarted($user);
        $access = $this->resolveAccessPayload($user);
        $limits = $this->resolvePlanLimits($user);

        $locked = !$access['allowed'];
        if ($locked && ($user->spread_alerts_enabled ?? false)) {
            $user->spread_alerts_enabled = false;
            $user->save();
        }

        $rules = SpreadAlertRule::query()
            ->where('user_id', $user->id)
            ->where('enabled', 1)
            ->get(['id', 'last_checked_at', 'check_interval_minutes']);

        $now = Carbon::now();
        $lastCheck = null;
        $nextCheck = $now->copy()->addMinute();

        $nextRuleId = null;
        $nextRuleIntervalMinutes = null;
        $nextRuleNextCheck = null;
        $nextRuleLastCheckedAt = null;

        if ($rules && $rules->count() > 0) {
            $minNext = null;
            $maxLast = null;

            foreach ($rules as $r) {
                $interval = (int) ($r->check_interval_minutes ?? 1);
                if ($interval < 1) $interval = 1;

                if ($r->last_checked_at) {
                    $last = Carbon::parse($r->last_checked_at);
                    if (!$maxLast || $last->greaterThan($maxLast)) {
                        $maxLast = $last;
                    }
                    $candidate = $last->copy()->addMinutes($interval);
                } else {
                    $candidate = $now->copy()->addMinute();
                }

                if (!$minNext || $candidate->lessThan($minNext)) {
                    $minNext = $candidate;
                    $nextRuleId = (int) ($r->id ?? 0);
                    $nextRuleIntervalMinutes = $interval;
                    $nextRuleNextCheck = $candidate;
                    $nextRuleLastCheckedAt = $r->last_checked_at ? Carbon::parse($r->last_checked_at) : null;
                }
            }

            $lastCheck = $maxLast;
            if ($minNext) {
                $nextCheck = $minNext;
            }
        }
        if ($nextCheck->lessThanOrEqualTo($now)) {
            $nextCheck = $now->copy()->addMinute();
        }

        $minutesUntilNext = 0;
        if ($nextCheck->greaterThan($now)) {
            $seconds = (int) $now->diffInSeconds($nextCheck);
            $minutesUntilNext = (int) ceil($seconds / 60);
        }

        return response()->json([
            'enabled' => $locked ? false : (bool) ($user->spread_alerts_enabled ?? false),
            'last_check' => $lastCheck,
            'next_check' => $nextCheck,
            'minutes_until_next' => $minutesUntilNext,
            'next_rule_id' => $nextRuleId,
            'next_rule_interval_minutes' => $nextRuleIntervalMinutes,
            'next_rule_next_check' => $nextRuleNextCheck,
            'next_rule_last_checked_at' => $nextRuleLastCheckedAt,
            'access' => $access,
            'limits' => $limits,
        ])->header('X-SpreadAlerts-Backend', 'server-php/app/Http/Controllers/SpreadAlertsController.php');
    }

    public function getNotifications(Request $request)
    {
        $user = $this->resolveUser($request);
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401)
                ->header('X-SpreadAlerts-Backend', 'server-php/app/Http/Controllers/SpreadAlertsController.php');
        }

        return response()->json([
            'enable_email_notifications' => (bool) ($user->enable_email_notifications ?? false),
            'enable_telegram_notifications' => (bool) ($user->spread_enable_telegram_notifications ?? false),
            'telegram_chat_id' => $user->spread_telegram_chat_id,
        ])->header('X-SpreadAlerts-Backend', 'server-php/app/Http/Controllers/SpreadAlertsController.php');
    }

    public function saveNotifications(Request $request)
    {
        $user = $this->resolveUser($request);
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401)
                ->header('X-SpreadAlerts-Backend', 'server-php/app/Http/Controllers/SpreadAlertsController.php');
        }

        $this->ensureFreeTrialStarted($user);
        $access = $this->resolveAccessPayload($user);
        if (!$access['allowed']) {
            return $this->getNotifications($request);
        }

        $data = $request->validate([
            'enable_email_notifications' => 'nullable|boolean',
            'enable_telegram_notifications' => 'nullable|boolean',
            'telegram_chat_id' => 'nullable|string|max:255',
        ]);

        if (array_key_exists('enable_email_notifications', $data)) {
            $user->enable_email_notifications = (bool) $data['enable_email_notifications'];
        }
        if (array_key_exists('enable_telegram_notifications', $data)) {
            $user->spread_enable_telegram_notifications = (bool) $data['enable_telegram_notifications'];
        }
        if (array_key_exists('telegram_chat_id', $data)) {
            $user->spread_telegram_chat_id = $data['telegram_chat_id'] !== null ? trim((string) $data['telegram_chat_id']) : null;
        }

        $user->save();

        return $this->getNotifications($request);
    }

    public function test(Request $request)
    {
        $user = $this->resolveUser($request);
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401)
                ->header('X-SpreadAlerts-Backend', 'server-php/app/Http/Controllers/SpreadAlertsController.php');
        }

        $this->ensureFreeTrialStarted($user);
        $access = $this->resolveAccessPayload($user);
        if (!$access['allowed']) {
            return response()->json([
                'error' => 'Trial expired',
                'locked' => true,
                'access' => $access,
            ], 403)->header('X-SpreadAlerts-Backend', 'server-php/app/Http/Controllers/SpreadAlertsController.php');
        }

        try {
            $exitCode = Artisan::call('spread:check', ['--user_id' => $user->id, '--force' => true]);
            $output = Artisan::output();
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Test failed',
                'message' => $e->getMessage(),
            ], 500)->header('X-SpreadAlerts-Backend', 'server-php/app/Http/Controllers/SpreadAlertsController.php');
        }

        return response()->json([
            'message' => 'Test finished',
            'output' => $output ?? '',
        ])->header('X-SpreadAlerts-Backend', 'server-php/app/Http/Controllers/SpreadAlertsController.php');
    }

    public function logs(Request $request)
    {
        $user = $this->resolveUser($request);
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401)
                ->header('X-SpreadAlerts-Backend', 'server-php/app/Http/Controllers/SpreadAlertsController.php');
        }

        $limit = (int) $request->query('limit', 20);
        $limit = max(1, min(200, $limit));

        $items = DB::table('spread_alert_logs')
            ->where('user_id', $user->id)
            ->orderByDesc('id')
            ->limit($limit)
            ->get([
                'id',
                'rule_id',
                'status',
                'spread_percent',
                'prices',
                'message',
                'error',
                'fired_key',
                'fired_at',
                'created_at',
            ]);

        return response()->json(['items' => $items])
            ->header('X-SpreadAlerts-Backend', 'server-php/app/Http/Controllers/SpreadAlertsController.php');
    }
}
