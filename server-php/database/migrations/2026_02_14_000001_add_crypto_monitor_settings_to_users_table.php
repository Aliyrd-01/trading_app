<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'crypto_monitor_interval_sec')) {
                $table->integer('crypto_monitor_interval_sec')->nullable();
            }
            if (!Schema::hasColumn('users', 'crypto_monitor_quote')) {
                $table->string('crypto_monitor_quote', 10)->nullable();
            }
            if (!Schema::hasColumn('users', 'crypto_monitor_tokens_to_scan')) {
                $table->integer('crypto_monitor_tokens_to_scan')->nullable();
            }
            if (!Schema::hasColumn('users', 'crypto_monitor_top_n')) {
                $table->integer('crypto_monitor_top_n')->nullable();
            }
            if (!Schema::hasColumn('users', 'crypto_monitor_alert_percent_min')) {
                $table->decimal('crypto_monitor_alert_percent_min', 8, 4)->nullable();
            }
            if (!Schema::hasColumn('users', 'crypto_monitor_alert_percent_max')) {
                $table->decimal('crypto_monitor_alert_percent_max', 8, 4)->nullable();
            }
            if (!Schema::hasColumn('users', 'crypto_monitor_selected_exchanges')) {
                $table->json('crypto_monitor_selected_exchanges')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $cols = [
                'crypto_monitor_interval_sec',
                'crypto_monitor_quote',
                'crypto_monitor_tokens_to_scan',
                'crypto_monitor_top_n',
                'crypto_monitor_alert_percent_min',
                'crypto_monitor_alert_percent_max',
                'crypto_monitor_selected_exchanges',
            ];

            foreach ($cols as $col) {
                if (Schema::hasColumn('users', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
