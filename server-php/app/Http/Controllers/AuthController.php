<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\DB;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        try {
            $request->validate([
                'email' => 'required|email|unique:users',
                'password' => 'required|min:6',
                'name' => 'nullable|string|max:255',
            ]);

            $verificationToken = Str::random(64);

            $trialExpiresAt = null;
            if (Schema::hasColumn('users', 'trial_expires_at')) {
                $trialExpiresAt = now()->addDays(7);
            }

            $user = User::create([
                'email' => strtolower(trim((string) $request->email)),
                'password' => Hash::make($request->password),
                'name' => trim((string) ($request->input('name') ?? '')),
                'plan' => 'free',
                'trial_expires_at' => $trialExpiresAt,
                'verification_token' => $verificationToken,
            ]);

            if (!$user->email_verified_at) {
                $user->email_verified_at = now();
                $user->verification_token = null;
                $user->save();
            }

            // Отправляем email верификации
            try {
                $this->sendVerificationEmail($user, $verificationToken);
            } catch (\Exception $e) {
                \Log::error('Failed to send verification email: ' . $e->getMessage());
                // Продолжаем выполнение - пользователь создан
            }

            Auth::login($user);

            return response()->json([
                'id' => (string) $user->id,
                'email' => $user->email,
                'name' => ($user->name ?? '') !== '' ? $user->name : null,
                'plan' => $user->plan,
                'createdAt' => $user->created_at->toIso8601String(),
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'error' => $e->getMessage(),
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Ошибка в AuthController@register: ' . $e->getMessage());
            return response()->json([
                'error' => 'Registration failed. Please try again later.'
            ], 500);
        }
    }

    public function login(Request $request)
    {
        try {
            $request->validate([
                'email' => 'required|email',
                'password' => 'required',
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'code' => 'VALIDATION_ERROR',
                'error' => $e->getMessage(),
                'errors' => $e->errors(),
            ], 422);
        }

        $user = User::where('email', $request->email)->first();

        if (
            !$user ||
            empty($user->password) ||
            !Hash::check($request->password, $user->password)
        ) {
            return response()->json([
                'code' => 'INVALID_CREDENTIALS',
                'error' => 'The provided credentials are incorrect.',
                'errors' => [
                    'email' => ['The provided credentials are incorrect.'],
                ],
            ], 422);
        }

        // Если пользователь существует, но email не верифицирован - автоматически верифицируем
        // (для старых пользователей, которые были созданы до внедрения верификации)
        if (!$user->email_verified_at) {
            $user->email_verified_at = now();
            $user->verification_token = null;
            $user->save();
        }

        if (
            Schema::hasColumn('users', 'trial_expires_at') &&
            (($user->plan ?? 'free') === 'free') &&
            !$user->trial_expires_at
        ) {
            $base = $user->created_at ? $user->created_at->copy() : now();
            $user->trial_expires_at = $base->addDays(7);
            $user->save();
        }

        Auth::login($user);

        return response()->json([
            'id' => (string) $user->id,
            'email' => $user->email,
            'name' => $user->name,
            'plan' => $user->plan,
            'createdAt' => $user->created_at->toIso8601String(),
        ]);
    }

    public function token(Request $request)
    {
        try {
            $request->validate([
                'email' => 'required|email',
                'password' => 'required',
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'code' => 'VALIDATION_ERROR',
                'error' => $e->getMessage(),
                'errors' => $e->errors(),
            ], 422);
        }

        $user = User::where('email', $request->email)->first();

        if (
            !$user ||
            empty($user->password) ||
            !Hash::check($request->password, $user->password)
        ) {
            return response()->json([
                'code' => 'INVALID_CREDENTIALS',
                'error' => 'The provided credentials are incorrect.',
                'errors' => [
                    'email' => ['The provided credentials are incorrect.'],
                ],
            ], 422);
        }

        if (!$user->email_verified_at) {
            $user->email_verified_at = now();
            $user->verification_token = null;
            $user->save();
        }

        if (
            Schema::hasColumn('users', 'trial_expires_at') &&
            (($user->plan ?? 'free') === 'free') &&
            !$user->trial_expires_at
        ) {
            $base = $user->created_at ? $user->created_at->copy() : now();
            $user->trial_expires_at = $base->addDays(7);
            $user->save();
        }

        $user->tokens()->where('name', 'desktop')->delete();
        $token = $user->createToken('desktop')->plainTextToken;

        return response()->json([
            'token' => $token,
            'id' => (string) $user->id,
            'email' => $user->email,
        ]);
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function deleteAccount(Request $request)
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        try {
            $request->validate([
                'password' => 'required|string',
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'code' => 'VALIDATION_ERROR',
                'error' => $e->getMessage(),
                'errors' => $e->errors(),
            ], 422);
        }

        if (!Hash::check((string) $request->input('password'), (string) $user->password)) {
            return response()->json([
                'code' => 'INVALID_PASSWORD',
                'error' => 'Invalid password',
            ], 422);
        }

        $userId = $user->id;
        $email = $user->email;

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        DB::beginTransaction();
        try {
            try {
                $user->tokens()->delete();
            } catch (\Throwable $e) {
                // ignore
            }

            try {
                DB::table('auto_signal_logs')->where('user_id', $user->id)->delete();
            } catch (\Throwable $e) {
                // ignore
            }

            try {
                DB::table('payments')->where('user_id', $user->id)->delete();
            } catch (\Throwable $e) {
                // ignore
            }

            $deleted = DB::table('users')->where('id', $userId)->delete();
            if ($deleted <= 0 && !empty($email)) {
                $deleted = DB::table('users')->where('email', strtolower(trim((string) $email)))->delete();
            }
            if ($deleted <= 0) {
                throw new \RuntimeException('User row was not deleted');
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            \Log::error('Account deletion failed', [
                'user_id' => $userId,
                'email' => $email,
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'error' => 'Failed to delete account. Please try again later.',
            ], 500);
        }

        return response()->json(['message' => 'Account deleted']);
    }

    public function me(Request $request)
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        // Если платный план истёк — автоматически вернуть пользователя на free
        if (
            $user->plan &&
            $user->plan !== 'free' &&
            $user->plan_expires_at &&
            (function ($v) {
                try {
                    $dt = $v instanceof \DateTimeInterface ? Carbon::instance($v) : Carbon::parse($v);
                    return $dt->isPast();
                } catch (\Throwable $e) {
                    return false;
                }
            })($user->plan_expires_at)
        ) {
            $user->plan = 'free';
            $user->plan_expires_at = null;
            $user->save();
        }

        $planExpiresAt = null;
        if (Schema::hasColumn('users', 'plan_expires_at') && $user->plan_expires_at) {
            try {
                $dt = $user->plan_expires_at instanceof \DateTimeInterface
                    ? Carbon::instance($user->plan_expires_at)
                    : Carbon::parse($user->plan_expires_at);
                $planExpiresAt = $dt->toIso8601String();
            } catch (\Throwable $e) {
                $planExpiresAt = (string) $user->plan_expires_at;
            }
        }

        // ✅ 7-дневный trial для Free (инициализация для старых пользователей)
        if (
            Schema::hasColumn('users', 'trial_expires_at') &&
            (($user->plan ?? 'free') === 'free') &&
            !$user->trial_expires_at
        ) {
            $base = $user->created_at ? $user->created_at->copy() : now();
            $user->trial_expires_at = $base->addDays(7);
            $user->save();
        }

        $trialExpiresAt = null;
        $trialExpiresAtDt = null;
        if (Schema::hasColumn('users', 'trial_expires_at') && $user->trial_expires_at) {
            try {
                $trialExpiresAtDt = $user->trial_expires_at instanceof \DateTimeInterface
                    ? Carbon::instance($user->trial_expires_at)
                    : Carbon::parse($user->trial_expires_at);
                $trialExpiresAt = $trialExpiresAtDt->toIso8601String();
            } catch (\Throwable $e) {
                $trialExpiresAtDt = null;
                $trialExpiresAt = (string) $user->trial_expires_at;
            }
        }

        $autoSignalsAllowed = true;
        $autoSignalsReason = null;
        if (
            Schema::hasColumn('users', 'trial_expires_at') &&
            (($user->plan ?? 'free') === 'free') &&
            $user->trial_expires_at &&
            (function () use ($trialExpiresAtDt, $user) {
                if ($trialExpiresAtDt) {
                    return $trialExpiresAtDt->isPast();
                }
                try {
                    $dt = $user->trial_expires_at instanceof \DateTimeInterface
                        ? Carbon::instance($user->trial_expires_at)
                        : Carbon::parse($user->trial_expires_at);
                    return $dt->isPast();
                } catch (\Throwable $e) {
                    return false;
                }
            })()
        ) {
            $autoSignalsAllowed = false;
            $autoSignalsReason = 'trial_expired';
        }

        // ✅ Форс-выключаем auto-signals после истечения trial
        if (!$autoSignalsAllowed && ($user->auto_signals_enabled ?? false)) {
            $user->auto_signals_enabled = false;
            $user->save();
        }

        return response()->json([
            'id' => (string) $user->id,
            'email' => $user->email,
            'name' => $user->name,
            'plan' => $user->plan,
            'plan_expires_at' => $planExpiresAt,
            'trial_expires_at' => $trialExpiresAt,
            'auto_signals_allowed' => $autoSignalsAllowed,
            'auto_signals_reason' => $autoSignalsReason,
            'createdAt' => $user->created_at->toIso8601String(),
        ]);
    }

    public function meToken(Request $request)
    {
        $user = null;
        try {
            $user = $request->user('sanctum');
        } catch (\Throwable $e) {
            $user = null;
        }

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        return $this->me($request);
    }

    public function verifyEmail(Request $request)
    {
        $request->validate([
            'token' => 'required|string',
        ]);

        $user = User::where('verification_token', $request->token)->first();

        if (!$user) {
            return response()->json([
                'error' => 'Invalid or expired verification token'
            ], 400);
        }

        $user->email_verified_at = now();
        $user->verification_token = null;
        $user->save();

        Auth::login($user);

        return response()->json([
            'id' => (string) $user->id,
            'email' => $user->email,
            'name' => $user->name,
            'plan' => $user->plan,
            'createdAt' => $user->created_at->toIso8601String(),
        ]);
    }

    public function resendVerification(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return response()->json(['error' => 'User not found'], 404);
        }

        if ($user->email_verified_at) {
            return response()->json(['error' => 'Email already verified'], 400);
        }

        $verificationToken = Str::random(64);
        $user->verification_token = $verificationToken;
        $user->save();

        try {
            $this->sendVerificationEmail($user, $verificationToken);
        } catch (\Exception $e) {
            \Log::error('Failed to resend verification email: ' . $e->getMessage());
            return response()->json([
                'error' => 'Failed to send verification email. Please try again later.'
            ], 500);
        }

        return response()->json(['message' => 'Verification email sent']);
    }

    public function resetPasswordRequest(Request $request)
    {
        try {
            $request->validate([
                'email' => 'required|email',
            ]);

            $user = User::where('email', $request->email)->first();

            // Для безопасности возвращаем успех даже если email не найден
            if (!$user) {
                return response()->json([
                    'message' => 'If the email exists, a password reset link has been sent'
                ]);
            }

            $resetToken = Str::random(64);
            $user->reset_token = $resetToken;
            $user->reset_token_expires = now()->addHour();
            $user->save();

            try {
                $this->sendPasswordResetEmail($user, $resetToken);
            } catch (\Exception $e) {
                \Log::error('Failed to send password reset email: ' . $e->getMessage());
                \Log::error('Email error details: ' . $e->getTraceAsString());
                return response()->json([
                    'error' => 'Failed to send email. Please try again later.'
                ], 500);
            }

            return response()->json([
                'message' => 'If the email exists, a password reset link has been sent'
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'error' => 'Invalid email address'
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Ошибка в AuthController@resetPasswordRequest: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'error' => 'Failed to process request. Please try again later.'
            ], 500);
        }
    }

    public function resetPassword(Request $request)
    {
        $request->validate([
            'token' => 'required|string',
            'password' => 'required|min:6',
        ]);

        $user = User::where('reset_token', $request->token)
            ->where('reset_token_expires', '>', now())
            ->first();

        if (!$user) {
            return response()->json([
                'error' => 'Invalid or expired reset token'
            ], 400);
        }

        $user->password = Hash::make($request->password);
        $user->reset_token = null;
        $user->reset_token_expires = null;
        $user->save();

        Auth::login($user);

        return response()->json([
            'id' => (string) $user->id,
            'email' => $user->email,
            'name' => $user->name,
            'plan' => $user->plan,
            'createdAt' => $user->created_at->toIso8601String(),
        ]);
    }

    public function updatePlan(Request $request)
    {
        $request->validate([
            'plan' => 'required|in:free,pro,pro_plus',
        ]);

        $user = Auth::user();
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        // Обновляем план и сбрасываем дату истечения (если сброс на free)
        $user->plan = $request->plan;

        if (Schema::hasColumn('users', 'plan_expires_at')) {
            if ($request->plan === 'free') {
                $user->plan_expires_at = null;
            } else {
                $current = $user->plan_expires_at;
                $needsExtend = true;
                if ($current) {
                    try {
                        $dt = $current instanceof \DateTimeInterface ? Carbon::instance($current) : Carbon::parse($current);
                        $needsExtend = $dt->isPast();
                    } catch (\Throwable $e) {
                        $needsExtend = true;
                    }
                }
                if ($needsExtend) {
                    $user->plan_expires_at = Carbon::now()->addMonth();
                }
            }
        }
        $user->save();

        return response()->json([
            'id' => (string) $user->id,
            'email' => $user->email,
            'name' => $user->name,
            'plan' => $user->plan,
            'createdAt' => $user->created_at->toIso8601String(),
        ]);
    }

    private function sendVerificationEmail($user, $token)
    {
        $baseUrl = config('app.url');
        $verificationUrl = rtrim($baseUrl, '/') . '/verify-email?token=' . $token;

        $language = $this->getLanguageFromRequest();
        $translations = $this->getVerificationEmailTranslations($language);

        Mail::send([], [], function ($message) use ($user, $verificationUrl, $translations) {
            $message->to($user->email)
                ->subject($translations['subject'])
                ->html($this->getVerificationEmailHtml($translations, $verificationUrl));
        });
    }

    private function sendPasswordResetEmail($user, $token)
    {
        $baseUrl = config('app.url');
        $resetUrl = rtrim($baseUrl, '/') . '/reset-password?token=' . $token;

        $language = $this->getLanguageFromRequest();
        $translations = $this->getPasswordResetEmailTranslations($language);

        Mail::send([], [], function ($message) use ($user, $resetUrl, $translations) {
            $message->to($user->email)
                ->subject($translations['subject'])
                ->html($this->getPasswordResetEmailHtml($translations, $resetUrl));
        });
    }

    private function getLanguageFromRequest()
    {
        $acceptLanguage = request()->header('Accept-Language', 'en');
        $lang = strtolower(substr($acceptLanguage, 0, 2));
        return in_array($lang, ['en', 'uk', 'ru']) ? $lang : 'en';
    }

    private function getVerificationEmailTranslations($lang)
    {
        $translations = [
            'en' => [
                'subject' => 'Verify your email - Crypto Analyzer',
                'title' => 'Verify Your Email Address',
                'text' => 'Thank you for registering! Please click the button below to verify your email address.',
                'button' => 'Verify Email',
                'footer' => 'If you didn\'t create an account, you can safely ignore this email.',
            ],
            'uk' => [
                'subject' => 'Підтвердіть email - Crypto Analyzer',
                'title' => 'Підтвердіть вашу адресу електронної пошти',
                'text' => 'Дякуємо за реєстрацію! Натисніть кнопку нижче, щоб підтвердити вашу адресу електронної пошти.',
                'button' => 'Підтвердити Email',
                'footer' => 'Якщо ви не створювали обліковий запис, ви можете безпечно ігнорувати цей лист.',
            ],
            'ru' => [
                'subject' => 'Подтвердите email - Crypto Analyzer',
                'title' => 'Подтвердите ваш адрес электронной почты',
                'text' => 'Спасибо за регистрацию! Нажмите кнопку ниже, чтобы подтвердить ваш адрес электронной почты.',
                'button' => 'Подтвердить Email',
                'footer' => 'Если вы не создавали учетную запись, вы можете безопасно игнорировать это письмо.',
            ],
        ];

        return $translations[$lang] ?? $translations['en'];
    }

    private function getPasswordResetEmailTranslations($lang)
    {
        $translations = [
            'en' => [
                'subject' => 'Reset your password - Crypto Analyzer',
                'title' => 'Reset Your Password',
                'text' => 'You requested to reset your password. Click the button below to create a new password.',
                'button' => 'Reset Password',
                'footer' => 'If you didn\'t request a password reset, you can safely ignore this email. This link will expire in 1 hour.',
            ],
            'uk' => [
                'subject' => 'Скиньте пароль - Crypto Analyzer',
                'title' => 'Скиньте ваш пароль',
                'text' => 'Ви запросили скидання пароля. Натисніть кнопку нижче, щоб створити новий пароль.',
                'button' => 'Скинути пароль',
                'footer' => 'Якщо ви не запитували скидання пароля, ви можете безпечно ігнорувати цей лист. Це посилання дійсне протягом 1 години.',
            ],
            'ru' => [
                'subject' => 'Сбросьте пароль - Crypto Analyzer',
                'title' => 'Сбросьте ваш пароль',
                'text' => 'Вы запросили сброс пароля. Нажмите кнопку ниже, чтобы создать новый пароль.',
                'button' => 'Сбросить пароль',
                'footer' => 'Если вы не запрашивали сброс пароля, вы можете безопасно игнорировать это письмо. Эта ссылка действительна в течение 1 часа.',
            ],
        ];

        return $translations[$lang] ?? $translations['en'];
    }

    private function getVerificationEmailHtml($translations, $url)
    {
        return $this->getEmailTemplate($translations, $url);
    }

    private function getPasswordResetEmailHtml($translations, $url)
    {
        return $this->getEmailTemplate($translations, $url);
    }

    private function getEmailTemplate($translations, $url)
    {
        return '
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .container {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 40px 20px;
                    border-radius: 10px;
                    text-align: center;
                }
                .content {
                    background: white;
                    padding: 30px;
                    border-radius: 8px;
                    margin: 20px 0;
                }
                h1 {
                    color: white;
                    margin: 0 0 20px 0;
                }
                .button {
                    display: inline-block;
                    padding: 12px 30px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 20px 0;
                    font-weight: bold;
                }
                .footer {
                    color: #666;
                    font-size: 14px;
                    margin-top: 20px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>' . htmlspecialchars($translations['title']) . '</h1>
                <div class="content">
                    <p>' . htmlspecialchars($translations['text']) . '</p>
                    <a href="' . htmlspecialchars($url) . '" class="button">' . htmlspecialchars($translations['button']) . '</a>
                    <div class="footer">
                        <p>' . htmlspecialchars($translations['footer']) . '</p>
                    </div>
                </div>
            </div>
        </body>
        </html>';
    }
}
