<?php

namespace App\Jobs;

use App\Console\Commands\CheckSignalsCommand;
use App\Models\User;
use Carbon\Carbon;
use GuzzleHttp\Client;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessAutoSignalsUserJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $userId;

    public bool $force;

    public function __construct(int $userId, bool $force = false)
    {
        $this->userId = $userId;
        $this->force = $force;
    }

    public function handle(CheckSignalsCommand $command): void
    {
        $user = User::find($this->userId);
        if (!$user) {
            return;
        }

        $client = new Client([
            'base_uri' => 'https://api.binance.com',
            'timeout' => 15,
            'connect_timeout' => 5,
            'http_errors' => false,
        ]);

        $command->processUserForJob($user, $client, Carbon::now(), $this->force, false);
    }
}
