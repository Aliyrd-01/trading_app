<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\AutoSignalsController;

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
