<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('auto_signal_logs', function (Blueprint $table) {
            $table->string('signal_key', 64)->nullable()->after('binance_symbol');
            $table->unique('signal_key');
        });
    }

    public function down(): void
    {
        Schema::table('auto_signal_logs', function (Blueprint $table) {
            $table->dropUnique(['signal_key']);
            $table->dropColumn('signal_key');
        });
    }
};
