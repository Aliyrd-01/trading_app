<?php

namespace App\Console\Commands;

use App\Jobs\ProcessAutoSignalsUserJob;
use App\Models\User;
use App\Services\TechnicalIndicators;
use Carbon\Carbon;
use GuzzleHttp\Client;
use Illuminate\Database\QueryException;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;

class CheckSignalsCommand extends Command
{
    protected $signature = 'signals:check {--user_id=} {--force}';

    protected $description = 'Check Binance signals for users with auto alerts enabled and send notifications.';

    public function handle(): int
    {
        if (!class_exists(TechnicalIndicators::class)) {
            $fallbackPath = app_path('Services/TechnicalIndicators.php');
            if (is_string($fallbackPath) && is_file($fallbackPath)) {
                require_once $fallbackPath;
            }
        }

        $userId = $this->option('user_id');
        $force = (bool) $this->option('force');
        $explicitRun = (bool) $userId || $force;
        $query = User::query();
        if ($userId) {
            $query->where('id', $userId);
        } else {
            $query->where('auto_signals_enabled', 1);
        }

        if ($explicitRun) {
            $this->info('signals:check started');
            $count = (int) $query->count();
            $this->line("users: {$count}");
            if ($count === 0) {
                $this->warn('No users matched query');
                return self::SUCCESS;
            }
        }

        $client = new Client([
            'base_uri' => 'https://api.binance.com',
            'timeout' => 15,
            'connect_timeout' => 5,
            'http_errors' => false,
        ]);

        $now = Carbon::now();

        $query->chunkById(200, function ($users) use ($client, $now, $explicitRun) {
            foreach ($users as $user) {
                try {
                    if ($explicitRun) {
                        $email = (string) ($user->email ?? '');
                        $this->line("processing user_id={$user->id} {$email}");
                    }

                    $this->ensureFreeTrialStarted($user, $now);
                    if (!$this->userHasAutoSignalsAccess($user, $now)) {
                        if (($user->auto_signals_enabled ?? false)) {
                            $user->auto_signals_enabled = false;
                            $user->save();
                        }

                        if ($explicitRun) {
                            $this->warn('SKIP trial expired');
                            $this->logAutoSignal($user, [
                                'status' => 'skipped',
                                'error' => 'trial_expired',
                            ]);
                        }

                        continue;
                    }

                    if ($explicitRun) {
                        $this->processUser($user, $client, $now);
                    } else {
                        ProcessAutoSignalsUserJob::dispatch((int) $user->id, false);
                    }
                } catch (\Throwable $e) {
                    Log::error('signals:check user failed', [
                        'user_id' => $user->id,
                        'error' => $e->getMessage(),
                    ]);

                    $this->logAutoSignal($user, [
                        'status' => 'error',
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

    private function userHasAutoSignalsAccess(User $user, Carbon $now): bool
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

    private function processUser(User $user, Client $client, Carbon $now): void
    {
        $checkIntervalMinutes = $this->resolveCheckIntervalMinutes($user);
        $force = (bool) $this->option('force');
        $explicitRun = (bool) $this->option('user_id') || $force;

        $this->processUserForJob($user, $client, $now, $force, $explicitRun);
    }

    public function processUserForJob(User $user, Client $client, Carbon $now, bool $force, bool $explicitRun): void
    {
        $checkIntervalMinutes = $this->resolveCheckIntervalMinutes($user);

        $lastCheck = $user->auto_signal_last_check ? Carbon::parse($user->auto_signal_last_check) : null;
        if (!$force && $lastCheck && $lastCheck->diffInMinutes($now) < $checkIntervalMinutes) {
            if ($explicitRun) {
                $this->warn('SKIP interval');
                $this->logAutoSignal($user, [
                    'status' => 'skipped',
                    'error' => 'interval',
                    'meta' => [
                        'check_interval_minutes' => $checkIntervalMinutes,
                        'last_check' => $lastCheck ? $lastCheck->toDateTimeString() : null,
                    ],
                ]);
            }
            return;
        }

        $symbol = (string) ($user->auto_signal_symbol ?? '');
        $binanceSymbol = $this->normalizeBinanceSymbol($symbol);
        if ($binanceSymbol === '') {
            if ($explicitRun) {
                $this->warn('SKIP empty symbol');
                $this->logAutoSignal($user, [
                    'status' => 'skipped',
                    'error' => 'empty_symbol',
                ]);
            }
            return;
        }

        $timeframe = $this->resolveTimeframe($user);

        $bars = $this->fetchKlines($client, $binanceSymbol, $timeframe, 500);
        $bars = $this->useLastClosedBars($bars, $timeframe, $now);
        if (count($bars) < 250) {
            $user->auto_signal_last_check = $now;
            $user->save();
            if ($explicitRun) {
                $this->warn('SKIP insufficient bars');
                $this->logAutoSignal($user, [
                    'status' => 'skipped',
                    'error' => 'insufficient_bars',
                    'timeframe' => $timeframe,
                    'meta' => [
                        'bars' => count($bars),
                        'required_bars' => 250,
                    ],
                ]);
            }
            return;
        }

        $signal = $this->calculateSignal($bars, (string) ($user->auto_signal_confirmation ?? ''));
        $tradePlan = $this->computeTradePlan($user, $signal, $bars);
        if (isset($tradePlan['meta']) && is_array($tradePlan['meta'])) {
            $signal['meta'] = array_merge((array) ($signal['meta'] ?? []), $tradePlan['meta']);
        }
        $reliability = (int) round($signal['reliability']);

        $minReliabilityRaw = $user->auto_signal_min_reliability;
        $minReliability = 0;
        if (is_numeric($minReliabilityRaw)) {
            $minReliability = (float) $minReliabilityRaw;
            if ($minReliability > 0 && $minReliability < 1) {
                $minReliability *= 100.0;
            }
            if ($minReliability < 0) {
                $minReliability = 0.0;
            }
            if ($minReliability > 100) {
                $minReliability = 100.0;
            }
            $minReliability = (int) round($minReliability);
        }
        if (!$force && $minReliability > 0 && $reliability < $minReliability) {
            $user->auto_signal_last_check = $now;
            $user->save();
            if ($explicitRun) {
                $this->warn('SKIP min reliability');
                $this->logAutoSignal($user, [
                    'status' => 'skipped',
                    'error' => 'min_reliability',
                    'timeframe' => $timeframe,
                    'reliability' => $reliability,
                    'meta' => [
                        'min_reliability' => $minReliability,
                        'reliability' => $reliability,
                    ],
                ]);
            }
            return;
        }

        if (!$force && $this->isInCooldown($user, $now, $checkIntervalMinutes, $signal, $binanceSymbol)) {
            $user->auto_signal_last_check = $now;
            $user->save();
            if ($explicitRun) {
                $this->warn('SKIP cooldown');
                $this->logAutoSignal($user, [
                    'status' => 'skipped',
                    'error' => 'cooldown',
                    'timeframe' => $timeframe,
                    'meta' => [
                        'check_interval_minutes' => $checkIntervalMinutes,
                    ],
                ]);
            }
            return;
        }

        $htf = $this->computeHtfContext($client, $binanceSymbol, $now);
        if (!empty($htf)) {
            $signal['meta'] = array_merge((array) ($signal['meta'] ?? []), $htf);
        }

        $message = $this->formatMessage($user, $signal, $timeframe, $now);

        $candleOpenTime = (int) (($bars[count($bars) - 1]['open_time'] ?? 0));
        $signalKey = $this->buildSignalKey((int) $user->id, $binanceSymbol, $timeframe, (string) ($signal['direction'] ?? ''), $candleOpenTime);

        try {
            $this->logAutoSignal($user, [
                'signal_key' => $signalKey,
                'status' => 'fired',
                'symbol' => $symbol,
                'binance_symbol' => $binanceSymbol,
                'timeframe' => $timeframe,
                'direction' => $signal['direction'],
                'reliability' => $reliability,
                'price' => $signal['price'],
                'message' => (string) ($message['text'] ?? ''),
                'fired_at' => $now,
                'meta' => array_merge((array) ($signal['meta'] ?? []), [
                    'candle_open_time' => $candleOpenTime,
                ]),
            ]);
        } catch (QueryException $e) {
            $msg = $e->getMessage();
            if (stripos($msg, 'signal_key') !== false || stripos($msg, 'Duplicate') !== false) {
                $user->auto_signal_last_check = $now;
                $user->save();
                if ($explicitRun) {
                    $this->warn('SKIP dedupe');
                }
                if ($explicitRun) {
                    $this->logAutoSignal($user, [
                        'status' => 'skipped',
                        'error' => 'dedupe',
                        'timeframe' => $timeframe,
                        'direction' => $signal['direction'],
                        'reliability' => $reliability,
                        'price' => $signal['price'],
                        'meta' => [
                            'signal_key' => $signalKey,
                            'candle_open_time' => $candleOpenTime,
                        ],
                    ]);
                }
                return;
            }

            throw $e;
        }

        $this->sendNotifications($user, (string) ($message['text'] ?? ''), (string) ($message['subject'] ?? ''));

        $user->auto_signal_last_check = $now;
        $user->auto_signal_last_signal_price = $signal['price'];
        $user->auto_signal_last_signal_direction = $signal['direction'];
        $user->auto_signal_last_fired_at = $now;
        $user->save();

        if ($explicitRun) {
            $dir = (string) ($signal['direction'] ?? '');
            $price = (float) ($signal['price'] ?? 0);
            $this->info("FIRED {$binanceSymbol} {$timeframe} {$dir} reliability={$reliability}% price={$price}");
        }
    }

    private function resolveCheckIntervalMinutes(User $user): int
    {
        $interval = (int) ($user->auto_signal_check_interval ?? 0);
        if ($interval > 0) {
            return max(1, $interval);
        }

        $tradingType = (string) ($user->auto_signal_trading_type ?? '');

        $defaults = [
            'Скальпинг' => 1,
            'Дейтрейдинг' => 5,
            'Дейли трейдинг' => 5,
            'Свинг' => 15,
            'Среднесрочная' => 60,
            'Долгосрочная' => 240,
        ];

        return $defaults[$tradingType] ?? 5;
    }

    private function resolveTimeframe(User $user): string
    {
        $tradingType = (string) ($user->auto_signal_trading_type ?? '');

        $map = [
            'Скальпинг' => '1m',
            'Дейтрейдинг' => '15m',
            'Дейли трейдинг' => '15m',
            'Свинг' => '1h',
            'Среднесрочная' => '4h',
            'Долгосрочная' => '1d',
        ];

        return $map[$tradingType] ?? '15m';
    }

    private function normalizeBinanceSymbol(string $symbol): string
    {
        $symbol = trim($symbol);
        if ($symbol === '') {
            return '';
        }

        $symbol = str_replace([' ', '-'], '', $symbol);
        $symbol = str_replace('/', '', $symbol);

        return strtoupper($symbol);
    }

    private function fetchKlines(Client $client, string $symbol, string $interval, int $limit): array
    {
        $attempts = 3;
        $lastErr = null;
        for ($i = 0; $i < $attempts; $i++) {
            try {
                $resp = $client->get('/api/v3/klines', [
                    'query' => [
                        'symbol' => $symbol,
                        'interval' => $interval,
                        'limit' => $limit,
                    ],
                ]);

                $status = (int) $resp->getStatusCode();
                if ($status !== 200) {
                    if (($status === 418 || $status === 429 || $status >= 500) && $i < ($attempts - 1)) {
                        usleep((int) (200000 * ($i + 1)));
                        continue;
                    }
                    return [];
                }

                $data = json_decode((string) $resp->getBody(), true);
                if (!is_array($data)) {
                    return [];
                }

                $out = [];
                foreach ($data as $row) {
                    if (!is_array($row) || count($row) < 6) {
                        continue;
                    }

                    $out[] = [
                        'open_time' => (int) $row[0],
                        'open' => (float) $row[1],
                        'high' => (float) $row[2],
                        'low' => (float) $row[3],
                        'close' => (float) $row[4],
                        'volume' => (float) $row[5],
                    ];
                }

                return $out;
            } catch (\Throwable $e) {
                $lastErr = $e->getMessage();
                if ($i < ($attempts - 1)) {
                    usleep((int) (200000 * ($i + 1)));
                    continue;
                }
                break;
            }
        }

        if ($lastErr) {
            Log::warning('signals:check binance klines failed', [
                'symbol' => $symbol,
                'interval' => $interval,
                'error' => $lastErr,
            ]);
        }

        return [];
    }

    private function useLastClosedBars(array $bars, string $interval, Carbon $now): array
    {
        $n = count($bars);
        if ($n < 3) {
            return $bars;
        }

        $last = $bars[$n - 1] ?? null;
        if (!is_array($last) || !isset($last['open_time'])) {
            return $bars;
        }

        $ms = $this->intervalToMs($interval);
        if ($ms <= 0) {
            return $bars;
        }

        $nowMs = (int) floor(((float) $now->getTimestampMs()));
        $openTime = (int) $last['open_time'];
        $closeTime = $openTime + $ms;
        if ($nowMs < $closeTime) {
            return array_slice($bars, 0, -1);
        }

        return $bars;
    }

    private function intervalToMs(string $interval): int
    {
        $interval = trim($interval);
        $map = [
            '1m' => 60,
            '3m' => 180,
            '5m' => 300,
            '15m' => 900,
            '30m' => 1800,
            '1h' => 3600,
            '2h' => 7200,
            '4h' => 14400,
            '6h' => 21600,
            '8h' => 28800,
            '12h' => 43200,
            '1d' => 86400,
        ];

        $sec = (int) ($map[$interval] ?? 0);
        return $sec > 0 ? ($sec * 1000) : 0;
    }

    private function buildSignalKey(int $userId, string $binanceSymbol, string $timeframe, string $direction, int $candleOpenTime): string
    {
        $raw = $userId . '|' . $binanceSymbol . '|' . $timeframe . '|' . $direction . '|' . $candleOpenTime;
        return hash('sha256', $raw);
    }

    private function calculateSignal(array $bars, string $confirmation): array
    {
        $closes = array_map(fn ($b) => (float) $b['close'], $bars);
        $highs = array_map(fn ($b) => (float) $b['high'], $bars);
        $lows = array_map(fn ($b) => (float) $b['low'], $bars);
        $volumes = array_map(fn ($b) => (float) $b['volume'], $bars);

        $ema20 = TechnicalIndicators::ema($closes, 20);
        $ema50 = TechnicalIndicators::ema($closes, 50);
        $ema200 = TechnicalIndicators::ema($closes, 200);
        $trend = $ema50['value'] > $ema200['value'] ? 'Uptrend' : 'Downtrend';
        $rsi14 = TechnicalIndicators::rsi($closes, 14);
        $macd = TechnicalIndicators::macd($closes);
        $adx = TechnicalIndicators::adx($highs, $lows, $closes, 14);
        $vwma20 = TechnicalIndicators::vwma($closes, $volumes, 20);

        $bb = TechnicalIndicators::bollinger($closes, 20, 2.0);

        $prevClose = (float) $closes[max(0, count($closes) - 2)];
        $prevBb = TechnicalIndicators::bollinger(array_slice($closes, 0, -1), 20, 2.0);

        $trend = ($ema50['value'] > $ema200['value']) ? 'Uptrend' : 'Downtrend';
        $direction = ($trend === 'Uptrend') ? 'long' : 'short';

        $prevClose = (float) $closes[max(0, count($closes) - 2)];

        $indicatorsMap = [
            'EMA' => $ema50['value'] > $ema200['value'],
            'RSI' => $rsi14 > 50,
            'MACD' => $macd['macd'] > $macd['signal'],
            'ADX' => $adx > 25,
            'VWMA' => end($closes) > $vwma20,
            'BB' => (
                ($prevBb['lower'] !== null && $bb['lower'] !== null && $prevClose < $prevBb['lower'] && end($closes) >= $bb['lower'])
                || ($prevBb['upper'] !== null && $bb['upper'] !== null && $prevClose > $prevBb['upper'] && end($closes) <= $bb['upper'])
                || ($bb['lower'] !== null && $bb['upper'] !== null && end($closes) >= $bb['lower'] && end($closes) <= $bb['upper'])
            ),
        ];

        $selected = $this->parseConfirmation($confirmation);

        $passedList = [];
        $failedList = [];
        $total = 0;

        if (empty($selected)) {
            $reliability = 0.0;
        } elseif (in_array('ALL', $selected, true)) {
            $total = count($indicatorsMap);
            foreach ($indicatorsMap as $name => $cond) {
                if ($cond === true) {
                    $passedList[] = $name;
                } else {
                    $failedList[] = $name;
                }
            }
            $reliability = $total > 0 ? (100.0 * (count($passedList) / $total)) : 0.0;
        } else {
            $selected = array_values(array_unique($selected));
            $total = count($selected);
            foreach ($selected as $name) {
                if (($indicatorsMap[$name] ?? false) === true) {
                    $passedList[] = $name;
                } else {
                    $failedList[] = $name;
                }
            }
            $reliability = $total > 0 ? (100.0 * (count($passedList) / $total)) : 0.0;
        }

        return [
            'direction' => $direction,
            'reliability' => $reliability,
            'price' => end($closes),
            'meta' => [
                'trend' => $trend,
                'atr14' => $this->atr($highs, $lows, $closes, 14),
                'ema20' => $ema20['value'],
                'ema50' => $ema50['value'],
                'ema200' => $ema200['value'],
                'rsi14' => $rsi14,
                'macd' => $macd['macd'],
                'macd_signal' => $macd['signal'],
                'adx' => $adx,
                'vwma20' => $vwma20,
                'bb_upper' => $bb['upper'],
                'bb_lower' => $bb['lower'],
                'confirm_selected' => $selected,
                'confirm_passed' => $passedList,
                'confirm_failed' => $failedList,
                'confirm_total' => $total,
            ],
        ];
    }

    private function computeHtfContext(Client $client, string $binanceSymbol, Carbon $now): array
    {
        $out = [];

        $bars4h = $this->fetchKlines($client, $binanceSymbol, '4h', 260);
        $bars4h = $this->useLastClosedBars($bars4h, '4h', $now);
        if (count($bars4h) >= 220) {
            $closes = array_map(fn ($b) => (float) $b['close'], $bars4h);
            $ema50 = TechnicalIndicators::ema($closes, 50)['value'];
            $ema200 = TechnicalIndicators::ema($closes, 200)['value'];
            $out['htf_4h_trend'] = $ema50 > $ema200 ? 'Uptrend' : 'Downtrend';
        }

        $bars1d = $this->fetchKlines($client, $binanceSymbol, '1d', 260);
        $bars1d = $this->useLastClosedBars($bars1d, '1d', $now);
        if (count($bars1d) >= 220) {
            $closes = array_map(fn ($b) => (float) $b['close'], $bars1d);
            $ema50 = TechnicalIndicators::ema($closes, 50)['value'];
            $ema200 = TechnicalIndicators::ema($closes, 200)['value'];
            $out['htf_1d_trend'] = $ema50 > $ema200 ? 'Uptrend' : 'Downtrend';
        }

        return $out;
    }

    private function atr(array $highs, array $lows, array $closes, int $period): float
    {
        $n = count($closes);
        if ($n < $period + 1) {
            return 0.0;
        }

        $trs = [];
        for ($i = 1; $i < $n; $i++) {
            $hl = $highs[$i] - $lows[$i];
            $hc = abs($highs[$i] - $closes[$i - 1]);
            $lc = abs($lows[$i] - $closes[$i - 1]);
            $trs[] = max($hl, $hc, $lc);
        }

        $slice = array_slice($trs, -$period);
        if (count($slice) === 0) {
            return 0.0;
        }

        return array_sum($slice) / count($slice);
    }

    private function computeTradePlan(User $user, array $signal, array $bars): array
    {
        $direction = (string) ($signal['direction'] ?? '');
        $meta = is_array($signal['meta'] ?? null) ? $signal['meta'] : [];

        $capital = is_numeric($user->auto_signal_capital ?? null) ? (float) $user->auto_signal_capital : 10000.0;
        if ($capital <= 0) {
            $capital = 10000.0;
        }

        $riskPercent = is_numeric($user->auto_signal_risk ?? null) ? (float) $user->auto_signal_risk : 1.0;
        if ($riskPercent > 0 && $riskPercent < 0.1) {
            $riskPercent = $riskPercent * 100.0;
        }
        if ($riskPercent <= 0) {
            $riskPercent = 1.0;
        }
        if ($riskPercent > 100) {
            $riskPercent = 100.0;
        }

        $riskFraction = $riskPercent / 100.0;

        $strategyName = (string) ($user->auto_signal_strategy ?? '');
        if (trim($strategyName) === '') {
            $strategyName = 'Сбалансированная';
        }

        $strategies = [
            'Консервативная' => ['entry_type' => 'ema50', 'atr_sl' => 1.5, 'atr_tp' => 1.8, 'ema_buffer' => 0.001],
            'Сбалансированная' => ['entry_type' => 'ema20', 'atr_sl' => 1.2, 'atr_tp' => 1.8, 'ema_buffer' => 0.0007],
            'Агрессивная' => ['entry_type' => 'close', 'atr_sl' => 1.0, 'atr_tp' => 1.5, 'ema_buffer' => 0.0],
        ];
        $strat = $strategies[$strategyName] ?? $strategies['Сбалансированная'];

        $tradingType = (string) ($user->auto_signal_trading_type ?? '');
        if ($tradingType === 'Дейли трейдинг') {
            $tradingType = 'Дейтрейдинг';
        }
        $typeMult = [
            'Скальпинг' => ['mult_sl' => 0.8, 'mult_tp' => 1.0],
            'Дейтрейдинг' => ['mult_sl' => 1.0, 'mult_tp' => 1.3],
            'Свинг' => ['mult_sl' => 1.5, 'mult_tp' => 2.0],
            'Среднесрочная' => ['mult_sl' => 2.0, 'mult_tp' => 3.0],
            'Долгосрочная' => ['mult_sl' => 3.0, 'mult_tp' => 4.0],
        ];
        $multSl = (float) (($typeMult[$tradingType]['mult_sl'] ?? 1.0));
        $multTp = (float) (($typeMult[$tradingType]['mult_tp'] ?? 1.3));

        $latest = end($bars);
        if (!is_array($latest)) {
            return ['meta' => []];
        }
        $price = (float) ($signal['price'] ?? ($latest['close'] ?? 0));
        $high = (float) ($latest['high'] ?? $price);
        $low = (float) ($latest['low'] ?? $price);

        $atr = (float) ($meta['atr14'] ?? 0.0);
        if ($atr <= 0 || $atr < $price * 0.001) {
            $atr = $price * 0.001;
        }

        $emaBuffer = (float) ($strat['ema_buffer'] ?? 0.0);
        $entryType = (string) ($strat['entry_type'] ?? 'ema20');

        $entry = $price;
        if ($entryType === 'close') {
            $entry = $price;
        } elseif ($entryType === 'ema50') {
            $ema = (float) ($meta['ema50'] ?? $price);
            $entry = ($direction === 'short') ? ($ema * (1 - $emaBuffer)) : ($ema * (1 + $emaBuffer));
        } else {
            $ema = (float) ($meta['ema20'] ?? $price);
            $entry = ($direction === 'short') ? ($ema * (1 - $emaBuffer)) : ($ema * (1 + $emaBuffer));
        }

        if ($direction === 'long') {
            if ($entry > $high) {
                $entry = min($price, $high);
            }
        } elseif ($direction === 'short') {
            if ($entry < $low) {
                $entry = max($price, $low);
            }
        }

        $minDistance = max($price * 0.0005, $atr * 0.5);
        $slDist = max(((float) $strat['atr_sl']) * $atr * $multSl, $minDistance);
        $tpDist = max(((float) $strat['atr_tp']) * $atr * $multTp, $minDistance);

        if ($direction === 'short') {
            $stopLoss = $entry + $slDist;
            $takeProfit = $entry - $tpDist;

            $minSlDistance = ($entry - $takeProfit) * 0.3;
            if (($stopLoss - $entry) < $minSlDistance) {
                $stopLoss = $entry + $minSlDistance;
            }
        } else {
            $stopLoss = $entry - $slDist;
            $takeProfit = $entry + $tpDist;

            $minSlDistance = ($takeProfit - $entry) * 0.3;
            if (($entry - $stopLoss) < $minSlDistance) {
                $stopLoss = $entry - $minSlDistance;
            }
        }

        $riskUsd = $capital * $riskFraction;
        $dist = abs($entry - $stopLoss);
        $units = 0.0;
        $positionValue = 0.0;
        if ($dist > 1e-9 && $entry > 0) {
            $units = $riskUsd / $dist;
            $positionValue = $units * $entry;
            if ($positionValue > $capital) {
                $positionValue = $capital;
                $units = $positionValue / $entry;
            }
        }

        $rr = 0.0;
        if ($dist > 1e-9) {
            $rr = abs($takeProfit - $entry) / $dist;
        }

        return [
            'meta' => [
                'capital' => $capital,
                'risk' => $riskPercent,
                'strategy' => $strategyName,
                'entry' => $entry,
                'stop_loss' => $stopLoss,
                'take_profit' => $takeProfit,
                'rr' => round($rr, 2),
                'position_units' => $units,
                'position_value' => $positionValue,
            ],
        ];
    }

    private function parseConfirmation(string $confirmation): array
    {
        $conf = strtoupper(trim($confirmation));

        if ($conf === '') {
            return ['ALL'];
        }

        if ($conf === 'NONE' || $conf === 'N/A') {
            return [];
        }

        if ($conf === 'ALL') {
            return ['ALL'];
        }

        $parts = array_filter(array_map('trim', explode('+', $conf)));
        $out = [];
        foreach ($parts as $p) {
            $p = strtoupper($p);
            $out[] = $p;
        }

        return $out;
    }

    private function ema(array $values, int $period): array
    {
        return TechnicalIndicators::ema($values, $period);
    }

    private function rsi(array $closes, int $period): float
    {
        return TechnicalIndicators::rsi($closes, $period);
    }

    private function macd(array $closes): array
    {
        return TechnicalIndicators::macd($closes);
    }

    private function adx(array $highs, array $lows, array $closes, int $period): float
    {
        return TechnicalIndicators::adx($highs, $lows, $closes, $period);
    }

    private function vwma(array $closes, array $volumes, int $period): float
    {
        return TechnicalIndicators::vwma($closes, $volumes, $period);
    }

    private function bollinger(array $closes, int $period, float $mult): array
    {
        return TechnicalIndicators::bollinger($closes, $period, $mult);
    }

    private function isInCooldown(User $user, Carbon $now, int $checkIntervalMinutes, array $signal, string $binanceSymbol): bool
    {
        $lastFired = $user->auto_signal_last_fired_at ? Carbon::parse($user->auto_signal_last_fired_at) : null;
        if (!$lastFired) {
            return false;
        }

        $cooldownMinutes = max($checkIntervalMinutes, 5);
        if ($lastFired->diffInMinutes($now) < $cooldownMinutes) {
            return true;
        }

        $last = DB::table('auto_signal_logs')
            ->where('user_id', $user->id)
            ->where('status', 'fired')
            ->where('binance_symbol', $binanceSymbol)
            ->orderByDesc('id')
            ->first(['direction', 'price', 'fired_at']);

        if ($last && isset($last->direction, $last->price) && $last->price) {
            $newDir = (string) ($signal['direction'] ?? '');
            $newPrice = (float) ($signal['price'] ?? 0);
            $lastPrice = (float) $last->price;
            $lastDir = (string) $last->direction;

            if ($lastDir !== '' && $newDir !== '' && $lastDir === $newDir && $newPrice > 0 && $lastPrice > 0) {
                $diff = abs($newPrice - $lastPrice) / $newPrice;
                if ($diff < 0.001) {
                    return true;
                }
            }
        }

        return false;
    }

    private function formatMessage(User $user, array $signal, string $timeframe, Carbon $now): array
    {
        $lang = (string) ($user->language ?? 'ru');
        $lang = strtolower(substr(trim($lang), 0, 2));
        if (!in_array($lang, ['ru', 'en', 'uk'], true)) {
            $lang = 'ru';
        }

        $texts = [
            'ru' => [
                'subject' => '🚨 Новый торговый сигнал: {symbol} {dirUpper}',
                'title' => '🚨 Новый торговый сигнал!',
                'instrument' => '📊 Инструмент: {symbol}',
                'direction' => '🟢 Направление: {dirLocal} {dirIcon}',
                'trend' => '📈 Тренд: {trendLocal}',
                'confirm' => 'Подтверждения',
                'htf' => 'Старшие ТФ',
                'strategy' => '🎯 Стратегия: {strategy}',
                'levels' => '💰 Уровни:',
                'level_entry' => '• Вход: {price}',
                'level_stop' => '• Стоп-лосс: {price}',
                'level_tp' => '• Тейк-профит: {price}',
                'level_rr' => '• R:R (Риск/прибыль): {rr}',
                'reliability' => '⭐ Надёжность: {reliability}%',
                'time' => '⏰ Время: {time}',
                'dir_long' => 'Лонг',
                'dir_short' => 'Шорт',
                'trend_up' => 'Бычий рынок',
                'trend_down' => 'Медвежий рынок',
            ],
            'en' => [
                'subject' => '🚨 New trading signal: {symbol} {dirUpper}',
                'title' => '🚨 New trading signal!',
                'instrument' => '📊 Instrument: {symbol}',
                'direction' => '🟢 Direction: {dirLocal} {dirIcon}',
                'trend' => '📈 Trend: {trendLocal}',
                'confirm' => 'Confirmations',
                'htf' => 'Higher TF',
                'strategy' => '🎯 Strategy: {strategy}',
                'levels' => '💰 Levels:',
                'level_entry' => '• Entry: {price}',
                'level_stop' => '• Stop-loss: {price}',
                'level_tp' => '• Take profit: {price}',
                'level_rr' => '• R:R (Risk/Reward): {rr}',
                'reliability' => '⭐ Reliability: {reliability}%',
                'time' => '⏰ Time: {time}',
                'dir_long' => 'Long',
                'dir_short' => 'Short',
                'trend_up' => 'Bull market',
                'trend_down' => 'Bear market',
            ],
            'uk' => [
                'subject' => '🚨 Новий торговий сигнал: {symbol} {dirUpper}',
                'title' => '🚨 Новий торговий сигнал!',
                'instrument' => '📊 Інструмент: {symbol}',
                'direction' => '🟢 Напрям: {dirLocal} {dirIcon}',
                'trend' => '📈 Тренд: {trendLocal}',
                'confirm' => 'Підтвердження',
                'htf' => 'Старші ТФ',
                'strategy' => '🎯 Стратегія: {strategy}',
                'levels' => '💰 Рівні:',
                'level_entry' => '• Вхід: {price}',
                'level_stop' => '• Стоп-лосс: {price}',
                'level_tp' => '• Тейк-профіт: {price}',
                'level_rr' => '• R:R (Ризик/прибуток): {rr}',
                'reliability' => '⭐ Надійність: {reliability}%',
                'time' => '⏰ Час: {time}',
                'dir_long' => 'Лонг',
                'dir_short' => 'Шорт',
                'trend_up' => 'Бичачий ринок',
                'trend_down' => 'Ведмежий ринок',
            ],
        ];

        $t = $texts[$lang];

        $symbol = (string) ($user->auto_signal_symbol ?? '');
        $reliability = (float) ($signal['reliability'] ?? 0);
        $direction = (string) ($signal['direction'] ?? '');

        $meta = is_array($signal['meta'] ?? null) ? $signal['meta'] : [];
        $strategy = (string) ($meta['strategy'] ?? ($user->auto_signal_strategy ?? ''));
        $entry = isset($meta['entry']) ? (float) $meta['entry'] : null;
        $stopLoss = isset($meta['stop_loss']) ? (float) $meta['stop_loss'] : null;
        $takeProfit = isset($meta['take_profit']) ? (float) $meta['take_profit'] : null;
        $rr = isset($meta['rr']) ? (float) $meta['rr'] : null;

        $dirUpper = $direction === 'short' ? 'SHORT' : 'LONG';
        $dirLocal = $direction === 'short' ? $t['dir_short'] : $t['dir_long'];
        $dirIcon = $direction === 'short' ? '🚀⬇️' : '🚀';

        $trendRaw = (string) ($meta['trend'] ?? '');
        $trendLocal = $trendRaw === 'Downtrend' ? $t['trend_down'] : ($trendRaw === 'Uptrend' ? $t['trend_up'] : '');

        $strategyMap = [
            'Консервативная' => ['en' => 'Conservative', 'uk' => 'Консервативна', 'ru' => 'Консервативная'],
            'Сбалансированная' => ['en' => 'Balanced', 'uk' => 'Збалансована', 'ru' => 'Сбалансированная'],
            'Агрессивная' => ['en' => 'Aggressive', 'uk' => 'Агрессивная', 'ru' => 'Агрессивная'],
            'Conservative' => ['en' => 'Conservative', 'uk' => 'Консервативна', 'ru' => 'Консервативная'],
            'Balanced' => ['en' => 'Balanced', 'uk' => 'Збалансована', 'ru' => 'Сбалансированная'],
            'Aggressive' => ['en' => 'Aggressive', 'uk' => 'Агрессивная', 'ru' => 'Агрессивная'],
        ];
        if ($strategy !== '' && isset($strategyMap[$strategy])) {
            $strategy = (string) ($strategyMap[$strategy][$lang] ?? $strategy);
        }

        $fmtPrice = function (?float $v): string {
            if ($v === null || !is_finite($v)) {
                return '';
            }
            return '$' . number_format($v, 2, '.', '');
        };

        $fmt = function (string $template, array $vars) {
            foreach ($vars as $k => $v) {
                $template = str_replace('{' . $k . '}', (string) $v, $template);
            }
            return $template;
        };

        $lines = [];
        $lines[] = $t['title'];
        $lines[] = '';
        $lines[] = $fmt($t['instrument'], ['symbol' => $symbol]);
        $lines[] = $fmt($t['direction'], ['dirLocal' => $dirLocal, 'dirIcon' => $dirIcon]);
        if ($trendLocal !== '') {
            $lines[] = $fmt($t['trend'], ['trendLocal' => $trendLocal]);
        }

        $confirmPassed = [];
        if (isset($meta['confirm_passed']) && is_array($meta['confirm_passed'])) {
            $confirmPassed = array_values(array_filter(array_map('strval', $meta['confirm_passed'])));
        }
        $confirmFailed = [];
        if (isset($meta['confirm_failed']) && is_array($meta['confirm_failed'])) {
            $confirmFailed = array_values(array_filter(array_map('strval', $meta['confirm_failed'])));
        }
        $confirmTotal = isset($meta['confirm_total']) ? (int) $meta['confirm_total'] : 0;
        if ($confirmTotal <= 0) {
            $confirmTotal = count($confirmPassed) + count($confirmFailed);
        }
        if ($confirmTotal > 0) {
            $chunks = [];
            foreach ($confirmPassed as $x) {
                $chunks[] = $x . ' ✅';
            }
            foreach ($confirmFailed as $x) {
                $chunks[] = $x . ' ❌';
            }

            $countPassed = count($confirmPassed);
            $line = '✅ ' . $t['confirm'] . ' (' . $countPassed . '/' . $confirmTotal . '):';
            if (!empty($chunks)) {
                $line .= ' ' . implode(', ', $chunks);
            }
            $lines[] = $line;
        }

        $htf4h = (string) ($meta['htf_4h_trend'] ?? '');
        $htf1d = (string) ($meta['htf_1d_trend'] ?? '');
        if ($htf4h !== '' || $htf1d !== '') {
            $parts = [];
            if ($htf4h !== '') $parts[] = '4h: ' . $htf4h;
            if ($htf1d !== '') $parts[] = '1d: ' . $htf1d;
            $lines[] = '🧭 ' . $t['htf'] . ': ' . implode(' | ', $parts);
        }
        if ($strategy !== '') {
            $lines[] = $fmt($t['strategy'], ['strategy' => $strategy]);
        }

        $levels = [];
        if ($entry !== null) {
            $levels[] = $fmt($t['level_entry'], ['price' => $fmtPrice($entry)]);
        }
        if ($stopLoss !== null) {
            $levels[] = $fmt($t['level_stop'], ['price' => $fmtPrice($stopLoss)]);
        }
        if ($takeProfit !== null) {
            $levels[] = $fmt($t['level_tp'], ['price' => $fmtPrice($takeProfit)]);
        }
        if ($rr !== null) {
            $levels[] = $fmt($t['level_rr'], ['rr' => number_format($rr, 2, '.', '')]);
        }
        if (!empty($levels)) {
            $lines[] = '';
            $lines[] = $t['levels'];
            foreach ($levels as $l) {
                $lines[] = $l;
            }
            $lines[] = '';
        }

        $lines[] = $fmt($t['reliability'], ['reliability' => number_format($reliability, 1, '.', '')]);
        $lines[] = '';
        $lines[] = $fmt($t['time'], ['time' => $now->toDateTimeString()]);

        $subject = $fmt($t['subject'], ['symbol' => $symbol, 'dirUpper' => $dirUpper]);

        return [
            'subject' => $subject,
            'text' => implode("\n", $lines),
        ];
    }

    private function sendNotifications(User $user, string $message, string $subject): void
    {
        $emailEnabled = (int) ($user->enable_email_notifications ?? 0) === 1;
        $telegramEnabled = (int) ($user->enable_telegram_notifications ?? 0) === 1;

        if ($emailEnabled && !empty($user->email)) {
            try {
                $lang = (string) ($user->language ?? 'ru');
                $lang = strtolower(substr(trim($lang), 0, 2));
                if (!in_array($lang, ['ru', 'en', 'uk'], true)) {
                    $lang = 'ru';
                }
                $fallbackSubjectMap = [
                    'ru' => '🚨 Новый торговый сигнал',
                    'en' => '🚨 New trading signal',
                    'uk' => '🚨 Новий торговий сигнал',
                ];
                $fallbackSubject = (string) ($fallbackSubjectMap[$lang] ?? $fallbackSubjectMap['ru']);
                $finalSubject = $subject !== '' ? $subject : $fallbackSubject;
                Mail::raw($message, function ($m) use ($user, $finalSubject) {
                    $m->to($user->email)->subject($finalSubject);
                });
            } catch (\Throwable $e) {
                Log::error('signals:check email failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
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
                    Log::error('signals:check telegram failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
                }
            }
        }
    }

    private function logAutoSignal(User $user, array $data): void
    {
        $payload = array_merge([
            'user_id' => $user->id,
            'symbol' => (string) ($user->auto_signal_symbol ?? ''),
            'binance_symbol' => $this->normalizeBinanceSymbol((string) ($user->auto_signal_symbol ?? '')),
            'status' => 'error',
            'created_at' => Carbon::now(),
            'updated_at' => Carbon::now(),
        ], $data);

        if (array_key_exists('meta', $payload) && is_array($payload['meta'])) {
            $payload['meta'] = json_encode($payload['meta']);
        }

        DB::table('auto_signal_logs')->insert($payload);
    }
}
