<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'crypto_monitor_last_check_at')) {
                $table->dateTime('crypto_monitor_last_check_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'crypto_monitor_last_check_at')) {
                $table->dropColumn('crypto_monitor_last_check_at');
            }
        });
    }
};
