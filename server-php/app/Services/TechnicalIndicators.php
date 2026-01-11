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
}
