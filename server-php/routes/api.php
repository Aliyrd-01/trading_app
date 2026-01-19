<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\AutoSignalsController;
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
    $data = json_decode((string) $request->getContent(), true);
    if (!is_array($data)) {
        return response()->json(['error' => 'Invalid JSON'], 400);
    }

    $expectedSecret = (string) env('TRADINGVIEW_WEBHOOK_SECRET', '');
    $providedSecret = (string) ($data['secret'] ?? '');
    if ($expectedSecret === '' || $providedSecret === '' || !hash_equals($expectedSecret, $providedSecret)) {
        return response()->json(['error' => 'Invalid secret'], 401);
    }

    $email = strtolower(trim((string) ($data['email'] ?? '')));
    if ($email === '') {
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
        $token = (string) env('TELEGRAM_BOT_TOKEN', '');
        $chatId = (string) ($user->telegram_chat_id ?? '');
        if ($token !== '' && $chatId !== '') {
            try {
                $http = new Client(['timeout' => 15]);
                $http->post("https://api.telegram.org/bot{$token}/sendMessage", [
                    'form_params' => [
                        'chat_id' => $chatId,
                        'text' => $message,
                        'disable_web_page_preview' => true,
                    ],
                ]);
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

// Auth routes
Route::get('/auth/test', function () {
    return response()->json(['message' => 'Auth route works']);
});
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/token', [AuthController::class, 'token']);
Route::post('/auth/logout', [AuthController::class, 'logout']);
Route::get('/auth/me', [AuthController::class, 'me']);
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

// Desktop sync (Sanctum token)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/desktop/auto_signals/settings', [AutoSignalsController::class, 'getSettings']);
    Route::post('/desktop/auto_signals/settings', [AutoSignalsController::class, 'saveSettings']);
    Route::post('/desktop/auto_signals/test', [AutoSignalsController::class, 'test']);
});

// Payment routes
Route::get('/payment/currencies', [PaymentController::class, 'getAvailableCurrencies']);
Route::post('/payment/create', [PaymentController::class, 'createPayment']);
Route::post('/payment/create-multi', [PaymentController::class, 'createMultiCurrencyPayment']);
Route::post('/payment/webhook', [PaymentController::class, 'webhook']);
Route::get('/payment/status', [PaymentController::class, 'checkPaymentStatus']);
