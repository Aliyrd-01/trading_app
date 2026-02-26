<?php

namespace App\Services;

class TechnicalIndicators
{
    public static function ema(array $values, int $period): array
    {
        $n = count($values);
        if ($n === 0) {
            return ['series' => [], 'value' => 0.0];
        }

        $alpha = 2 / ($period + 1);
        $ema = [];
        $ema[0] = (float) $values[0];
        for ($i = 1; $i < $n; $i++) {
            $ema[$i] = ($values[$i] * $alpha) + ($ema[$i - 1] * (1 - $alpha));
        }

        return ['series' => $ema, 'value' => (float) $ema[$n - 1]];
    }

    public static function rsi(array $closes, int $period): float
    {
        $n = count($closes);
        if ($n < $period + 1) {
            return 50.0;
        }

        $gains = 0.0;
        $losses = 0.0;

        for ($i = $n - $period; $i < $n; $i++) {
            $delta = $closes[$i] - $closes[$i - 1];
            if ($delta >= 0) {
                $gains += $delta;
            } else {
                $losses += abs($delta);
            }
        }

        $avgGain = $gains / $period;
        $avgLoss = $losses / $period;

        if ($avgLoss <= 1e-12) {
            return 100.0;
        }

        $rs = $avgGain / $avgLoss;

        return 100.0 - (100.0 / (1.0 + $rs));
    }

    public static function macd(array $closes): array
    {
        $ema12 = self::ema($closes, 12)['series'];
        $ema26 = self::ema($closes, 26)['series'];

        $macdSeries = [];
        $n = min(count($ema12), count($ema26));
        for ($i = 0; $i < $n; $i++) {
            $macdSeries[] = $ema12[$i] - $ema26[$i];
        }

        $signal = self::ema($macdSeries, 9);

        return [
            'macd' => (float) end($macdSeries),
            'signal' => (float) $signal['value'],
        ];
    }

    public static function adx(array $highs, array $lows, array $closes, int $period): float
    {
        $n = count($closes);
        if ($n < $period + 2) {
            return 0.0;
        }

        $plusDm = array_fill(0, $n, 0.0);
        $minusDm = array_fill(0, $n, 0.0);
        $tr = array_fill(0, $n, 0.0);

        for ($i = 1; $i < $n; $i++) {
            $upMove = $highs[$i] - $highs[$i - 1];
            $downMove = -($lows[$i] - $lows[$i - 1]);

            $plusDm[$i] = (($upMove > $downMove) && ($upMove > 0)) ? $upMove : 0.0;
            $minusDm[$i] = (($downMove > $upMove) && ($downMove > 0)) ? $downMove : 0.0;

            $hl = $highs[$i] - $lows[$i];
            $hc = abs($highs[$i] - $closes[$i - 1]);
            $lc = abs($lows[$i] - $closes[$i - 1]);
            $tr[$i] = max($hl, $hc, $lc);
        }

        $dxSeries = [];
        for ($i = $period; $i < $n; $i++) {
            $sumTr = 0.0;
            $sumPlus = 0.0;
            $sumMinus = 0.0;
            for ($j = $i - $period + 1; $j <= $i; $j++) {
                $sumTr += $tr[$j];
                $sumPlus += $plusDm[$j];
                $sumMinus += $minusDm[$j];
            }

            if ($sumTr <= 1e-12) {
                $dxSeries[$i] = 0.0;
                continue;
            }

            $plusDi = 100.0 * ($sumPlus / $sumTr);
            $minusDi = 100.0 * ($sumMinus / $sumTr);
            $den = $plusDi + $minusDi;
            $dxSeries[$i] = $den <= 1e-12 ? 0.0 : (100.0 * (abs($plusDi - $minusDi) / $den));
        }

        $adxStart = $n - $period;
        if ($adxStart < $period) {
            $adxStart = $period;
        }

        $sum = 0.0;
        $count = 0;
        for ($i = $adxStart; $i < $n; $i++) {
            if (isset($dxSeries[$i])) {
                $sum += $dxSeries[$i];
                $count++;
            }
        }

        return $count > 0 ? ($sum / $count) : 0.0;
    }

    public static function vwma(array $closes, array $volumes, int $period): float
    {
        $n = count($closes);
        if ($n < $period) {
            return (float) end($closes);
        }

        $start = $n - $period;
        $sumPv = 0.0;
        $sumV = 0.0;
        for ($i = $start; $i < $n; $i++) {
            $sumPv += $closes[$i] * $volumes[$i];
            $sumV += $volumes[$i];
        }

        if ($sumV <= 1e-12) {
            return (float) end($closes);
        }

        return $sumPv / $sumV;
    }

    public static function bollinger(array $closes, int $period, float $mult): array
    {
        $n = count($closes);
        if ($n < $period) {
            return ['middle' => null, 'upper' => null, 'lower' => null];
        }

        $slice = array_slice($closes, $n - $period, $period);
        $mean = array_sum($slice) / $period;

        $var = 0.0;
        foreach ($slice as $x) {
            $var += ($x - $mean) ** 2;
        }
        $std = sqrt($var / $period);

        return [
            'middle' => $mean,
            'upper' => $mean + ($mult * $std),
            'lower' => $mean - ($mult * $std),
        ];
    }

    public static function atr(array $highs, array $lows, array $closes, int $period): float
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

    public static function vwap(array $highs, array $lows, array $closes, array $volumes): float
    {
        $n = min(count($highs), count($lows), count($closes), count($volumes));
        if ($n <= 0) {
            return 0.0;
        }

        $sumTpv = 0.0;
        $sumV = 0.0;
        for ($i = 0; $i < $n; $i++) {
            $v = (float) $volumes[$i];
            $tp = ((float) $highs[$i] + (float) $lows[$i] + (float) $closes[$i]) / 3.0;
            if ($v > 0) {
                $sumTpv += $tp * $v;
                $sumV += $v;
            }
        }

        if ($sumV <= 1e-12) {
            return (float) $closes[$n - 1];
        }

        return $sumTpv / $sumV;
    }

    public static function avwap(array $highs, array $lows, array $closes, array $volumes): float
    {
        $n = min(count($highs), count($lows), count($closes), count($volumes));
        if ($n <= 0) {
            return 0.0;
        }

        $anchor = 0;
        if ($n >= 5) {
            for ($i = 2; $i < $n - 2; $i++) {
                $h = (float) $highs[$i];
                $isPh = ($h > (float) $highs[$i - 1])
                    && ($h > (float) $highs[$i - 2])
                    && ($h > (float) $highs[$i + 1])
                    && ($h > (float) $highs[$i + 2]);
                if ($isPh) {
                    $anchor = $i;
                }
            }
        }

        $sumTpv = 0.0;
        $sumV = 0.0;
        for ($i = $anchor; $i < $n; $i++) {
            $v = (float) $volumes[$i];
            $tp = ((float) $highs[$i] + (float) $lows[$i] + (float) $closes[$i]) / 3.0;
            if ($v > 0) {
                $sumTpv += $tp * $v;
                $sumV += $v;
            }
        }

        if ($sumV <= 1e-12) {
            return (float) $closes[$n - 1];
        }

        return $sumTpv / $sumV;
    }

    public static function obv(array $closes, array $volumes, int $emaPeriod = 20): array
    {
        $n = min(count($closes), count($volumes));
        if ($n <= 0) {
            return ['value' => 0.0, 'ema20' => 0.0];
        }

        $obv = array_fill(0, $n, 0.0);
        for ($i = 1; $i < $n; $i++) {
            $delta = (float) $closes[$i] - (float) $closes[$i - 1];
            $dir = $delta > 0 ? 1.0 : ($delta < 0 ? -1.0 : 0.0);
            $obv[$i] = $obv[$i - 1] + ($dir * (float) $volumes[$i]);
        }

        $ema = self::ema($obv, $emaPeriod);

        return [
            'value' => (float) $obv[$n - 1],
            'ema20' => (float) ($ema['value'] ?? 0.0),
        ];
    }

    public static function supertrend(array $highs, array $lows, array $closes, int $period = 10, float $mult = 3.0): array
    {
        $n = min(count($highs), count($lows), count($closes));
        if ($n <= 0) {
            return ['value' => 0.0, 'dir' => 0.0];
        }
        if ($n < $period + 2) {
            return ['value' => (float) $closes[$n - 1], 'dir' => 0.0];
        }

        $tr = array_fill(0, $n, 0.0);
        for ($i = 1; $i < $n; $i++) {
            $hl = (float) $highs[$i] - (float) $lows[$i];
            $hc = abs((float) $highs[$i] - (float) $closes[$i - 1]);
            $lc = abs((float) $lows[$i] - (float) $closes[$i - 1]);
            $tr[$i] = max($hl, $hc, $lc);
        }

        $atr = array_fill(0, $n, 0.0);
        for ($i = $period; $i < $n; $i++) {
            $sum = 0.0;
            for ($j = $i - $period + 1; $j <= $i; $j++) {
                $sum += $tr[$j];
            }
            $atr[$i] = $sum / $period;
        }
        for ($i = 1; $i < $period; $i++) {
            $atr[$i] = $atr[$period];
        }

        $finalUpper = array_fill(0, $n, 0.0);
        $finalLower = array_fill(0, $n, 0.0);

        $hl2_0 = (((float) $highs[0]) + ((float) $lows[0])) / 2.0;
        $finalUpper[0] = $hl2_0 + $mult * $atr[0];
        $finalLower[0] = $hl2_0 - $mult * $atr[0];

        for ($i = 1; $i < $n; $i++) {
            $hl2 = (((float) $highs[$i]) + ((float) $lows[$i])) / 2.0;
            $basicUpper = $hl2 + $mult * $atr[$i];
            $basicLower = $hl2 - $mult * $atr[$i];
            $prevClose = (float) $closes[$i - 1];

            $finalUpper[$i] = ($basicUpper < $finalUpper[$i - 1] || $prevClose > $finalUpper[$i - 1])
                ? $basicUpper
                : $finalUpper[$i - 1];
            $finalLower[$i] = ($basicLower > $finalLower[$i - 1] || $prevClose < $finalLower[$i - 1])
                ? $basicLower
                : $finalLower[$i - 1];
        }

        $supertrend = array_fill(0, $n, 0.0);
        $dir = array_fill(0, $n, 0.0);
        $supertrend[0] = $finalUpper[0];
        $dir[0] = -1.0;

        for ($i = 1; $i < $n; $i++) {
            $close = (float) $closes[$i];
            $prevSt = $supertrend[$i - 1];
            if (abs($prevSt - $finalUpper[$i - 1]) <= 1e-9) {
                if ($close <= $finalUpper[$i]) {
                    $supertrend[$i] = $finalUpper[$i];
                    $dir[$i] = -1.0;
                } else {
                    $supertrend[$i] = $finalLower[$i];
                    $dir[$i] = 1.0;
                }
            } else {
                if ($close >= $finalLower[$i]) {
                    $supertrend[$i] = $finalLower[$i];
                    $dir[$i] = 1.0;
                } else {
                    $supertrend[$i] = $finalUpper[$i];
                    $dir[$i] = -1.0;
                }
            }
        }

        return [
            'value' => (float) $supertrend[$n - 1],
            'dir' => (float) $dir[$n - 1],
        ];
    }
}
