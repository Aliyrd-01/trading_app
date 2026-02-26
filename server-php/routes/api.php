<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\AutoSignalsController;
use App\Http\Controllers\CryptoMonitorSettingsController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\SpreadAlertsController;
use App\Models\User;
use Carbon\Carbon;
use GuzzleHttp\Client;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Test route
Route::get('/test', function () {
    return response()->json(['message' => 'API works']);
});

Route::post('/webhook/tradingview', function (Request $request) {
    $rawPayload = (string) $request->getContent();
    $data = null;

    try {
        $json = $request->json();
        if ($json) {
            $data = $json->all();
        }
    } catch (\Throwable $e) {
        $data = null;
    }

    if (!is_array($data) || empty($data)) {
        $decoded = json_decode($rawPayload, true);
        if (is_array($decoded)) {
            $data = $decoded;
        }
    }

    if (!is_array($data) || empty($data)) {
        $data = $request->all();
    }

    if (!is_array($data)) {
        return response()->json(['error' => 'Invalid JSON'], 400);
    }

    $expectedSecret = (string) env('TRADINGVIEW_WEBHOOK_SECRET', '');
    $providedSecret = (string) ($data['secret'] ?? '');
    if ($expectedSecret === '' || $providedSecret === '' || !hash_equals($expectedSecret, $providedSecret)) {
        return response()->json(['error' => 'Invalid secret'], 401);
    }

    $email = strtolower(trim((string) (($data['email'] ?? null) ?? ($request->input('email') ?? null) ?? ($request->header('X-User-Email') ?? ''))));
    if ($email === '') {
        $rawSafe = $rawPayload;
        if ($rawSafe !== '') {
            $rawSafe = preg_replace('/("secret"\s*:\s*")([^"]*)(")/i', '$1***$3', $rawSafe) ?? $rawSafe;
            $rawSafe = mb_substr($rawSafe, 0, 1000);
        }

        Log::warning('tradingview webhook missing email', [
            'content_type' => (string) $request->header('Content-Type', ''),
            'is_json' => (bool) $request->isJson(),
            'data_keys' => is_array($data) ? array_keys($data) : null,
            'request_all_keys' => array_keys($request->all()),
            'raw_len' => strlen($rawPayload),
            'raw' => $rawSafe,
        ]);
        return response()->json(['error' => 'Missing email'], 400);
    }

    $user = User::where('email', $email)->first();
    if (!$user) {
        return response()->json(['error' => 'User not found'], 404);
    }

    if (Schema::hasColumn('users', 'trial_expires_at')) {
        $plan = (string) ($user->plan ?? 'free');

        if ($plan === 'free' && !$user->trial_expires_at) {
            $base = $user->created_at ? Carbon::parse($user->created_at) : Carbon::now();
            $user->trial_expires_at = $base->copy()->addDays(7);
            $user->save();
        }

        if ($plan === 'free' && $user->trial_expires_at && Carbon::parse($user->trial_expires_at)->isPast()) {
            return response()->json(['error' => 'Trial expired'], 403);
        }
    }

    $action = strtoupper(trim((string) ($data['action'] ?? '')));
    if (!in_array($action, ['BUY', 'SELL'], true)) {
        return response()->json(['error' => 'Invalid action'], 400);
    }

    $entry = $data['entry_price'] ?? null;
    $sl = $data['stop_loss'] ?? null;
    $tp = $data['take_profit'] ?? null;
    if (!is_numeric($entry) || !is_numeric($sl) || !is_numeric($tp)) {
        return response()->json(['error' => 'entry_price/stop_loss/take_profit must be numeric'], 400);
    }

    $symbol = trim((string) ($data['symbol'] ?? ''));
    $timeframe = trim((string) ($data['timeframe'] ?? ''));
    $comment = trim((string) ($data['comment'] ?? ''));

    $lang = (string) ($data['language'] ?? ($user->language ?? 'ru'));
    $lang = strtolower(substr(trim($lang), 0, 2));
    if (!in_array($lang, ['ru', 'en', 'uk'], true)) {
        $lang = 'ru';
    }

    $subjectMap = [
        'ru' => '🚨 Новый торговый сигнал (TradingView)',
        'en' => '🚨 New trading signal (TradingView)',
        'uk' => '🚨 Новий торговий сигнал (TradingView)',
    ];
    $subject = (string) ($subjectMap[$lang] ?? $subjectMap['ru']);

    $lines = [];
    $lines[] = 'TradingView Signal';
    if ($symbol !== '') {
        $lines[] = "Symbol: {$symbol}";
    }
    $lines[] = "Action: {$action}";
    $lines[] = "Entry: {$entry}";
    $lines[] = "SL: {$sl}";
    $lines[] = "TP: {$tp}";
    if ($timeframe !== '') {
        $lines[] = "Timeframe: {$timeframe}";
    }
    if ($comment !== '') {
        $lines[] = "Comment: {$comment}";
    }
    $message = implode("\n", $lines);

    $emailEnabled = (int) ($user->enable_email_notifications ?? 0) === 1;
    $telegramEnabled = (int) ($user->enable_telegram_notifications ?? 0) === 1;

    if ($emailEnabled && !empty($user->email)) {
        try {
            Mail::raw($message, function ($m) use ($user, $subject) {
                $m->to($user->email)->subject($subject);
            });
        } catch (\Throwable $e) {
            Log::error('tradingview webhook email failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    if ($telegramEnabled) {
        $token = trim((string) env('TELEGRAM_BOT_TOKEN', ''));
        $chatId = trim((string) ($user->telegram_chat_id ?? ''));

        $resolveTelegramChatId = function (string $token, string $chatIdOrUsername): string {
            $token = trim($token);
            $value = trim($chatIdOrUsername);

            if ($token === '' || $value === '') {
                return '';
            }

            if (preg_match('/^\d{5,}$/', $value)) {
                return $value;
            }

            $username = ltrim($value, '@');
            $username = strtolower(trim($username));
            if ($username === '') {
                return '';
            }

            try {
                $http = new Client(['timeout' => 15, 'http_errors' => false]);
                $offset = 0;
                $all = [];

                for ($i = 0; $i < 5; $i++) {
                    $resp = $http->get("https://api.telegram.org/bot{$token}/getUpdates", [
                        'query' => [
                            'offset' => $offset,
                            'limit' => 100,
                            'timeout' => 10,
                        ],
                    ]);

                    $status = (int) $resp->getStatusCode();
                    if ($status < 200 || $status >= 300) {
                        break;
                    }

                    $data = json_decode((string) $resp->getBody(), true);
                    if (!is_array($data) || empty($data['ok'])) {
                        break;
                    }

                    $updates = $data['result'] ?? [];
                    if (!is_array($updates) || count($updates) === 0) {
                        break;
                    }

                    foreach ($updates as $u) {
                        if (is_array($u)) {
                            $all[] = $u;
                        }
                    }

                    $maxId = 0;
                    foreach ($updates as $u) {
                        if (is_array($u) && isset($u['update_id']) && is_numeric($u['update_id'])) {
                            $uid = (int) $u['update_id'];
                            if ($uid > $maxId) {
                                $maxId = $uid;
                            }
                        }
                    }
                    if ($maxId <= 0) {
                        break;
                    }
                    $offset = $maxId + 1;
                }

                foreach ($all as $update) {
                    if (!is_array($update)) {
                        continue;
                    }

                    $msg = null;
                    if (isset($update['message']) && is_array($update['message'])) {
                        $msg = $update['message'];
                    } elseif (isset($update['edited_message']) && is_array($update['edited_message'])) {
                        $msg = $update['edited_message'];
                    } elseif (isset($update['callback_query']['message']) && is_array($update['callback_query']['message'])) {
                        $msg = $update['callback_query']['message'];
                    }

                    if (!is_array($msg)) {
                        continue;
                    }

                    $from = $msg['from'] ?? null;
                    $chat = $msg['chat'] ?? null;
                    if (!is_array($from) || !is_array($chat)) {
                        continue;
                    }

                    $uname = strtolower(trim((string) ($from['username'] ?? '')));
                    if ($uname !== '' && $uname === $username) {
                        $cid = $chat['id'] ?? null;
                        if (is_numeric($cid)) {
                            return (string) $cid;
                        }
                    }
                }
            } catch (\Throwable $e) {
                return '';
            }

            return '';
        };

        $resolvedChatId = $resolveTelegramChatId($token, $chatId);
        if ($resolvedChatId !== '' && $resolvedChatId !== $chatId) {
            try {
                $user->telegram_chat_id = $resolvedChatId;
                $user->save();
                $chatId = $resolvedChatId;
            } catch (\Throwable $e) {
                Log::warning('tradingview webhook telegram chat_id save failed', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if ($token !== '' && $chatId !== '') {
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
                    $body = (string) $resp->getBody();
                    if (is_string($body) && strlen($body) > 1000) {
                        $body = substr($body, 0, 1000);
                    }
                    Log::error('tradingview webhook telegram bad response', [
                        'user_id' => $user->id,
                        'status' => $status,
                        'body' => $body,
                    ]);
                }
            } catch (\Throwable $e) {
                Log::error('tradingview webhook telegram failed', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    return response()->json(['ok' => true]);
});

Route::post('/test_telegram_notification', function (Request $request) {
    $user = $request->user() ?: Auth::user();
    if (!$user) {
        return response()->json(['error' => 'Unauthenticated'], 401);
    }

    $telegramEnabled = (bool) ($user->enable_telegram_notifications ?? false);
    if (!$telegramEnabled) {
        return response()->json(['error' => 'Telegram notifications are disabled'], 400);
    }

    $token = trim((string) env('TELEGRAM_BOT_TOKEN', ''));
    $chatId = trim((string) ($user->telegram_chat_id ?? ''));
    Log::info('test telegram request', [
        'user_id' => $user->id,
        'chat_id' => $chatId,
        'has_token' => $token !== '',
    ]);
    if ($token === '' || $chatId === '') {
        return response()->json(['error' => 'Telegram is not configured'], 400);
    }

    $message = '✅ Telegram test: notification channel works.';

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
            Log::error('test telegram bad response', [
                'user_id' => $user->id,
                'status' => $status,
                'body' => substr((string) $resp->getBody(), 0, 1000),
            ]);
            return response()->json(['error' => 'Telegram send failed'], 500);
        }
        Log::info('test telegram sent', [
            'user_id' => $user->id,
            'status' => $status,
        ]);
    } catch (\Throwable $e) {
        Log::error('test telegram failed', [
            'user_id' => $user->id,
            'error' => $e->getMessage(),
            'exception' => get_class($e),
        ]);
        return response()->json(['error' => 'Telegram send failed'], 500);
    }

    return response()->json(['ok' => true]);
});

Route::get('/scheduler/run', function (Request $request) {
    $key = (string) env('SCHEDULER_KEY', '');
    $provided = (string) $request->query('key', '');

    if ($key === '' || $provided !== $key) {
        return response()->json(['error' => 'Forbidden'], 403);
    }

    try {
        $exitCode = Artisan::call('schedule:run', ['--no-interaction' => true]);

        return response()->json([
            'ok' => true,
            'exit_code' => $exitCode,
            'output' => Artisan::output(),
        ]);
    } catch (\Throwable $e) {
        Log::error('scheduler:run failed', [
            'error' => $e->getMessage(),
            'exception' => get_class($e),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
        ]);

        return response()->json([
            'ok' => false,
            'error' => $e->getMessage(),
            'exception' => get_class($e),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
        ], 500);
    }
});

Route::get('/spread_alerts/run', function (Request $request) {
    $key = (string) env('SCHEDULER_KEY', '');
    $provided = (string) $request->query('key', '');

    if ($key === '' || $provided !== $key) {
        return response()->json(['error' => 'Forbidden'], 403);
    }

    try {
        $exitCode = Artisan::call('spread:check', ['--no-interaction' => true]);

        return response()->json([
            'ok' => true,
            'exit_code' => $exitCode,
            'output' => Artisan::output(),
        ]);
    } catch (\Throwable $e) {
        Log::error('spread_alerts:run failed', [
            'error' => $e->getMessage(),
            'exception' => get_class($e),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
        ]);

        return response()->json([
            'ok' => false,
            'error' => $e->getMessage(),
            'exception' => get_class($e),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
        ], 500);
    }
});

// Auth routes
Route::get('/auth/test', function () {
    return response()->json(['message' => 'Auth route works']);
});
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/token', [AuthController::class, 'token']);
Route::post('/auth/logout', [AuthController::class, 'logout']);
Route::get('/auth/me', [AuthController::class, 'me']);
Route::middleware('auth:sanctum')->get('/auth/me-token', [AuthController::class, 'meToken']);
Route::delete('/auth/account', [AuthController::class, 'deleteAccount'])->middleware('auth');
Route::post('/auth/verify-email', [AuthController::class, 'verifyEmail']);
Route::post('/auth/resend-verification', [AuthController::class, 'resendVerification']);
Route::post('/auth/reset-password-request', [AuthController::class, 'resetPasswordRequest']);
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);

// User plan management
Route::patch('/user/plan', [AuthController::class, 'updatePlan']);

// Auto signals
Route::get('/auto_signals/settings', [AutoSignalsController::class, 'getSettings']);
Route::get('/auto_signals/status', [AutoSignalsController::class, 'status']);
Route::post('/auto_signals/settings', [AutoSignalsController::class, 'saveSettings']);
Route::post('/auto_signals/test', [AutoSignalsController::class, 'test']);
Route::get('/auto_signals/logs', [AutoSignalsController::class, 'logs']);

// Spread alerts
Route::get('/spread_alerts/settings', [SpreadAlertsController::class, 'getSettings']);
Route::post('/spread_alerts/settings', [SpreadAlertsController::class, 'saveSettings']);
Route::post('/spread_alerts/rule', [SpreadAlertsController::class, 'saveRule']);
Route::delete('/spread_alerts/rule', [SpreadAlertsController::class, 'deleteRule']);
Route::get('/spread_alerts/status', [SpreadAlertsController::class, 'status']);
Route::get('/spread_alerts/notifications', [SpreadAlertsController::class, 'getNotifications']);
Route::post('/spread_alerts/notifications', [SpreadAlertsController::class, 'saveNotifications']);
Route::post('/spread_alerts/test', [SpreadAlertsController::class, 'test']);
Route::get('/spread_alerts/logs', [SpreadAlertsController::class, 'logs']);

// CryptoMonitor settings (web)
Route::get('/crypto_monitor/settings', [CryptoMonitorSettingsController::class, 'getSettings']);
Route::post('/crypto_monitor/settings', [CryptoMonitorSettingsController::class, 'saveSettings']);

// Desktop sync (Sanctum token)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/desktop/auto_signals/settings', [AutoSignalsController::class, 'getSettings']);
    Route::post('/desktop/auto_signals/settings', [AutoSignalsController::class, 'saveSettings']);
    Route::post('/desktop/auto_signals/test', [AutoSignalsController::class, 'test']);
    Route::get('/desktop/spread_alerts/settings', [SpreadAlertsController::class, 'getSettings']);
    Route::post('/desktop/spread_alerts/settings', [SpreadAlertsController::class, 'saveSettings']);
    Route::post('/desktop/spread_alerts/rule', [SpreadAlertsController::class, 'saveRule']);
    Route::delete('/desktop/spread_alerts/rule', [SpreadAlertsController::class, 'deleteRule']);
    Route::get('/desktop/spread_alerts/notifications', [SpreadAlertsController::class, 'getNotifications']);
    Route::post('/desktop/spread_alerts/notifications', [SpreadAlertsController::class, 'saveNotifications']);
    Route::post('/desktop/spread_alerts/test', [SpreadAlertsController::class, 'test']);
    Route::get('/desktop/spread_alerts/logs', [SpreadAlertsController::class, 'logs']);

    Route::get('/desktop/crypto_monitor/settings', [CryptoMonitorSettingsController::class, 'getSettings']);
    Route::post('/desktop/crypto_monitor/settings', [CryptoMonitorSettingsController::class, 'saveSettings']);
    Route::post('/desktop/crypto_monitor/scan_results', [CryptoMonitorSettingsController::class, 'scanResults']);
    Route::post('/desktop/feedback', [AuthController::class, 'desktopFeedback']);
});

// Payment routes
Route::get('/payment/currencies', [PaymentController::class, 'getAvailableCurrencies']);
Route::post('/payment/create', [PaymentController::class, 'createPayment']);
Route::post('/payment/create-multi', [PaymentController::class, 'createMultiCurrencyPayment']);
Route::post('/payment/webhook', [PaymentController::class, 'webhook']);
Route::get('/payment/status', [PaymentController::class, 'checkPaymentStatus']);
