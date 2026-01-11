<?php

namespace Tests\Unit;

use App\Console\Commands\CheckSignalsCommand;
use App\Services\TechnicalIndicators;
use Tests\TestCase;

class TechnicalIndicatorsTest extends TestCase
{
    public function testEmaSimple(): void
    {
        $values = [1, 2, 3, 4, 5];
        $out = TechnicalIndicators::ema($values, 3);
        $this->assertIsArray($out);
        $this->assertArrayHasKey('value', $out);
        $this->assertGreaterThan(0, $out['value']);
    }

    public function testRsiRange(): void
    {
        $closes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
        $rsi = TechnicalIndicators::rsi($closes, 14);
        $this->assertGreaterThanOrEqual(0, $rsi);
        $this->assertLessThanOrEqual(100, $rsi);
    }

    public function testMacdHasKeys(): void
    {
        $closes = range(1, 60);
        $macd = TechnicalIndicators::macd($closes);
        $this->assertArrayHasKey('macd', $macd);
        $this->assertArrayHasKey('signal', $macd);
    }

    public function testCalculateSignalAddsConfirmPassedMeta(): void
    {
        $bars = [];
        $t = 1700000000000;
        for ($i = 0; $i < 260; $i++) {
            $bars[] = [
                'open_time' => $t + ($i * 60000),
                'open' => 100 + $i,
                'high' => 101 + $i,
                'low' => 99 + $i,
                'close' => 100 + $i,
                'volume' => 1000,
            ];
        }

        $cmd = new CheckSignalsCommand();

        $m = new \ReflectionMethod(CheckSignalsCommand::class, 'calculateSignal');
        $m->setAccessible(true);
        $signal = $m->invoke($cmd, $bars, 'ALL');

        $this->assertIsArray($signal);
        $this->assertArrayHasKey('meta', $signal);
        $this->assertIsArray($signal['meta']);
        $this->assertArrayHasKey('confirm_passed', $signal['meta']);
        $this->assertIsArray($signal['meta']['confirm_passed']);
    }
}
