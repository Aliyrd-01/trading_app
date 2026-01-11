<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'enable_email_notifications')) {
                $table->boolean('enable_email_notifications')->default(false);
            }
            if (!Schema::hasColumn('users', 'enable_telegram_notifications')) {
                $table->boolean('enable_telegram_notifications')->default(false);
            }
            if (!Schema::hasColumn('users', 'telegram_chat_id')) {
                $table->string('telegram_chat_id')->nullable();
            }

            if (!Schema::hasColumn('users', 'auto_signals_enabled')) {
                $table->boolean('auto_signals_enabled')->default(false);
            }
            if (!Schema::hasColumn('users', 'auto_signal_symbol')) {
                $table->string('auto_signal_symbol')->nullable();
            }
            if (!Schema::hasColumn('users', 'auto_signal_trading_type')) {
                $table->string('auto_signal_trading_type')->nullable();
            }
            if (!Schema::hasColumn('users', 'auto_signal_confirmation')) {
                $table->string('auto_signal_confirmation')->nullable();
            }
            if (!Schema::hasColumn('users', 'auto_signal_min_reliability')) {
                $table->unsignedTinyInteger('auto_signal_min_reliability')->nullable();
            }
            if (!Schema::hasColumn('users', 'auto_signal_check_interval')) {
                $table->unsignedInteger('auto_signal_check_interval')->nullable();
            }

            if (!Schema::hasColumn('users', 'auto_signal_last_check')) {
                $table->timestamp('auto_signal_last_check')->nullable();
            }
            if (!Schema::hasColumn('users', 'auto_signal_last_signal_price')) {
                $table->decimal('auto_signal_last_signal_price', 18, 8)->nullable();
            }
            if (!Schema::hasColumn('users', 'auto_signal_last_signal_direction')) {
                $table->string('auto_signal_last_signal_direction', 10)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $cols = [
                'enable_email_notifications',
                'enable_telegram_notifications',
                'telegram_chat_id',
                'auto_signals_enabled',
                'auto_signal_symbol',
                'auto_signal_trading_type',
                'auto_signal_confirmation',
                'auto_signal_min_reliability',
                'auto_signal_check_interval',
                'auto_signal_last_check',
                'auto_signal_last_signal_price',
                'auto_signal_last_signal_direction',
            ];

            foreach ($cols as $col) {
                if (Schema::hasColumn('users', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
