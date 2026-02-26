<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        $schedule->command('signals:check')
            ->everyMinute()
            ->withoutOverlapping()
            ->runInBackground();

        $schedule->command('spread:check')
            ->everyMinute()
            ->withoutOverlapping()
            ->runInBackground();

        $schedule->command('crypto_monitor:check')
            ->everyMinute()
            ->withoutOverlapping()
            ->runInBackground();
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(app_path('Console/Commands'));
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
