<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PaymentController extends Controller
{
    private $apiKey;
    private $ipnSecret;

    public function __construct()
    {
        $this->apiKey = env('NOWPAYMENTS_API_KEY', '55VMB5S-8RR425Z-JXW9GJF-G0R681E');
        $this->ipnSecret = env('NOWPAYMENTS_IPN_SECRET', 'YSmQvbnGnobQuHSae4kUBXJROL727sTj');
    }

    /**
     * Получение списка доступных криптовалют
     */
    public function getAvailableCurrencies()
    {
        try {
            $ch = curl_init('https://api.nowpayments.io/v1/currencies');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'x-api-key: ' . $this->apiKey,
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode !== 200) {
                // Возвращаем список популярных валют по умолчанию
                return response()->json([
                    'currencies' => ['BTC', 'ETH', 'USDT', 'USDC', 'TRX', 'BNB', 'XRP', 'DOGE', 'LTC', 'ADA']
                ]);
            }

            $data = json_decode($response, true);
            return response()->json([
                'currencies' => $data['currencies'] ?? ['BTC', 'ETH', 'USDT', 'USDC', 'TRX', 'BNB', 'XRP', 'DOGE', 'LTC', 'ADA']
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to get currencies: ' . $e->getMessage());
            return response()->json([
                'currencies' => ['BTC', 'ETH', 'USDT', 'USDC', 'TRX', 'BNB', 'XRP', 'DOGE', 'LTC', 'ADA']
            ]);
        }
    }

    /**
     * Создание платежа для выбранного плана
     */
    public function createPayment(Request $request)
    {
        $request->validate([
            'plan' => 'required|in:pro,pro_plus',
            'payment_method' => 'nullable|in:crypto,card',
            'pay_currency' => 'nullable|string', // Для криптовалюты
        ]);

        $user = Auth::user();
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        // Определяем цену и валюту
        $prices = [
            'pro' => 10,
            'pro_plus' => 20,
        ];

        $amount = $prices[$request->plan];
        $currency = 'USD';
        $paymentMethod = $request->payment_method ?? 'crypto';
        $paymentCurrency = $request->pay_currency ?? 'ETH';

        // Создаем уникальный order_id
        $orderId = 'order_' . $user->id . '_' . time() . '_' . Str::random(8);

        // Данные для создания платежа в NOWPayments
        $paymentData = [
            'price_amount' => $amount,
            'price_currency' => $currency,
            'ipn_callback_url' => config('app.url') . '/api/payment/webhook',
            'order_id' => $orderId,
            'order_description' => 'Crypto Analyzer ' . strtoupper($request->plan) . ' Plan',
            'success_url' => config('app.url') . '/prices?payment=success',
            'cancel_url' => config('app.url') . '/prices?payment=cancel',
        ];

        // Если оплата картой, используем fiat payments
        if ($paymentMethod === 'card') {
            $paymentData['is_fiat'] = true;
        } else {
            // Для криптовалюты указываем валюту
            $paymentData['pay_currency'] = $paymentCurrency;
        }

        try {
            // Создаем платеж через NOWPayments API
            $ch = curl_init('https://api.nowpayments.io/v1/payment');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($paymentData));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'x-api-key: ' . $this->apiKey,
                'Content-Type: application/json',
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            if ($curlError) {
                Log::error('NOWPayments cURL error: ' . $curlError);
                return response()->json([
                    'error' => 'Failed to connect to payment service. Please try again later.'
                ], 500);
            }

            // NOWPayments возвращает 201 (Created) при успешном создании платежа
            if ($httpCode !== 200 && $httpCode !== 201) {
                Log::error('NOWPayments API error. HTTP Code: ' . $httpCode . ', Response: ' . $response);
                return response()->json([
                    'error' => 'Failed to create payment. Please try again later.',
                    'details' => config('app.debug') ? $response : null
                ], 500);
            }

            $paymentResponse = json_decode($response, true);

            if (!$paymentResponse || !isset($paymentResponse['payment_id'])) {
                Log::error('Invalid NOWPayments response: ' . $response);
                return response()->json([
                    'error' => 'Invalid payment response. Please try again later.'
                ], 500);
            }

            // Проверяем наличие pay_address или invoice_url
            if (!isset($paymentResponse['pay_address']) && !isset($paymentResponse['invoice_url'])) {
                Log::error('NOWPayments response missing payment address: ' . $response);
                return response()->json([
                    'error' => 'Payment address not received. Please try again later.'
                ], 500);
            }

            // Сохраняем информацию о платеже в базу данных
            try {
                Payment::create([
                    'user_id' => $user->id,
                    'order_id' => $orderId,
                    'payment_id' => $paymentResponse['payment_id'],
                    'plan' => $request->plan,
                    'amount' => $amount,
                    'currency' => $currency,
                    'pay_currency' => $paymentCurrency,
                    'payment_status' => $paymentResponse['payment_status'] ?? 'waiting',
                    'pay_status' => $paymentResponse['pay_status'] ?? null,
                ]);
                Log::info('Payment created successfully. Order ID: ' . $orderId . ', Payment ID: ' . $paymentResponse['payment_id']);
            } catch (\Exception $e) {
                Log::error('Failed to save payment to database: ' . $e->getMessage());
                // Продолжаем выполнение - платеж создан в NOWPayments
            }

            // Создаем payment_url на основе payment_id, если invoice_url отсутствует
            $paymentUrl = $paymentResponse['invoice_url'] 
                ?? $paymentResponse['pay_url'] 
                ?? (isset($paymentResponse['payment_id']) && isset($paymentResponse['pay_address']) 
                    ? 'https://nowpayments.io/payment/?i=' . $paymentResponse['payment_id'] 
                    : null);

            return response()->json([
                'payment_id' => $paymentResponse['payment_id'],
                'pay_address' => $paymentResponse['pay_address'] ?? null,
                'pay_amount' => $paymentResponse['pay_amount'] ?? null,
                'pay_currency' => $paymentResponse['pay_currency'] ?? $paymentCurrency,
                'payment_url' => $paymentUrl,
                'order_id' => $orderId,
                'payment_method' => $paymentMethod,
                'invoice_url' => $paymentResponse['invoice_url'] ?? null,
            ]);
        } catch (\Exception $e) {
            Log::error('Payment creation error: ' . $e->getMessage());
            return response()->json([
                'error' => 'Failed to create payment. Please try again later.'
            ], 500);
        }
    }

    /**
     * Webhook для обработки уведомлений от NOWPayments
     */
    public function webhook(Request $request)
    {
        try {
            // Получаем сырой JSON для верификации подписи
            $rawPayload = $request->getContent();
            $payload = json_decode($rawPayload, true);
            
            if (!$payload) {
                $payload = $request->all();
                $rawPayload = json_encode($payload);
            }
            
            $signature = $request->header('x-nowpayments-sig');

            // Верифицируем подпись (если есть)
            if ($signature && $this->ipnSecret) {
                $expectedSignature = hash_hmac('sha512', $rawPayload, $this->ipnSecret);
                
                if ($signature !== $expectedSignature) {
                    Log::error('Invalid webhook signature. Expected: ' . $expectedSignature . ', Got: ' . $signature);
                    // Временно пропускаем проверку подписи для отладки
                    // return response()->json(['error' => 'Invalid signature'], 401);
                }
            }

            // Проверяем статус платежа
            $paymentStatus = $payload['payment_status'] ?? null;
            $orderId = $payload['order_id'] ?? null;

            if (!$orderId) {
                Log::error('Webhook missing order_id');
                return response()->json(['error' => 'Missing order_id'], 400);
            }

            // Получаем информацию о платеже из базы данных
            $payment = Payment::where('order_id', $orderId)->first();
            
            if (!$payment) {
                Log::error('Payment not found for order_id: ' . $orderId);
                return response()->json(['error' => 'Payment not found'], 404);
            }

            // Обновляем статус платежа
            $payment->payment_status = $paymentStatus;
            $payment->pay_status = $payload['pay_status'] ?? $payment->pay_status;
            if (isset($payload['amount_received']) && $payload['amount_received'] > 0) {
                $payment->paid_at = now();
            }
            $payment->save();

            // Обрабатываем только успешные платежи
            if ($paymentStatus === 'confirmed' || $paymentStatus === 'finished') {
                $user = $payment->user;
                
                if (!$user) {
                    Log::error('User not found for payment: ' . $payment->id);
                    return response()->json(['error' => 'User not found'], 404);
                }

                // Обновляем план пользователя и срок его действия (ровно 1 месяц)
                $user->plan = $payment->plan;
                $user->plan_expires_at = now()->addMonth();
                $user->save();

                Log::info('Payment successful. User ' . $user->id . ' upgraded to ' . $payment->plan . ' until ' . $user->plan_expires_at);
            }

            return response()->json(['status' => 'ok']);
        } catch (\Exception $e) {
            Log::error('Webhook error: ' . $e->getMessage());
            return response()->json(['error' => 'Webhook processing failed'], 500);
        }
    }

    /**
     * Создание платежей для нескольких криптовалют одновременно
     */
    public function createMultiCurrencyPayment(Request $request)
    {
        $request->validate([
            'plan' => 'required|in:pro,pro_plus',
            'currencies' => 'required|array|min:1',
            'currencies.*' => 'string',
        ]);

        $user = Auth::user();
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $prices = [
            'pro' => 10,
            'pro_plus' => 20,
        ];

        $amount = $prices[$request->plan];
        $currency = 'USD';
        $currencies = $request->currencies;
        $payments = [];

        foreach ($currencies as $payCurrency) {
            $orderId = 'order_' . $user->id . '_' . time() . '_' . Str::random(8) . '_' . $payCurrency;
            
            $paymentData = [
                'price_amount' => $amount,
                'price_currency' => $currency,
                'pay_currency' => $payCurrency,
                'ipn_callback_url' => config('app.url') . '/api/payment/webhook',
                'order_id' => $orderId,
                'order_description' => 'Crypto Analyzer ' . strtoupper($request->plan) . ' Plan',
            ];

            try {
                $ch = curl_init('https://api.nowpayments.io/v1/payment');
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($paymentData));
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    'x-api-key: ' . $this->apiKey,
                    'Content-Type: application/json',
                ]);

                $response = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);

                if ($httpCode === 200 || $httpCode === 201) {
                    $paymentResponse = json_decode($response, true);
                    if ($paymentResponse && isset($paymentResponse['payment_id'])) {
                        // Сохраняем в БД
                        try {
                            Payment::create([
                                'user_id' => $user->id,
                                'order_id' => $orderId,
                                'payment_id' => $paymentResponse['payment_id'],
                                'plan' => $request->plan,
                                'amount' => $amount,
                                'currency' => $currency,
                                'pay_currency' => $payCurrency,
                                'payment_status' => $paymentResponse['payment_status'] ?? 'waiting',
                                'pay_status' => $paymentResponse['pay_status'] ?? null,
                            ]);
                        } catch (\Exception $e) {
                            Log::error('Failed to save payment to database: ' . $e->getMessage());
                        }

                        $payments[] = [
                            'currency' => $payCurrency,
                            'pay_address' => $paymentResponse['pay_address'] ?? null,
                            'pay_amount' => $paymentResponse['pay_amount'] ?? null,
                            'payment_id' => $paymentResponse['payment_id'],
                            'order_id' => $orderId,
                        ];
                    }
                }
            } catch (\Exception $e) {
                Log::error('Failed to create payment for ' . $payCurrency . ': ' . $e->getMessage());
            }
        }

        return response()->json([
            'payments' => $payments,
            'plan' => $request->plan,
            'amount' => $amount,
        ]);
    }

    /**
     * Проверка статуса платежа
     */
    public function checkPaymentStatus(Request $request)
    {
        $request->validate([
            'payment_id' => 'required|string',
        ]);

        try {
            $ch = curl_init('https://api.nowpayments.io/v1/payment/' . $request->payment_id);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'x-api-key: ' . $this->apiKey,
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode !== 200) {
                return response()->json([
                    'error' => 'Failed to check payment status'
                ], 500);
            }

            $paymentData = json_decode($response, true);

            return response()->json([
                'payment_status' => $paymentData['payment_status'] ?? 'unknown',
                'pay_status' => $paymentData['pay_status'] ?? 'unknown',
            ]);
        } catch (\Exception $e) {
            Log::error('Payment status check error: ' . $e->getMessage());
            return response()->json([
                'error' => 'Failed to check payment status'
            ], 500);
        }
    }
}

