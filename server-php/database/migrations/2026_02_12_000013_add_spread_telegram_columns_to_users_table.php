<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'spread_enable_telegram_notifications')) {
                $table->boolean('spread_enable_telegram_notifications')->default(false);
            }
            if (!Schema::hasColumn('users', 'spread_telegram_chat_id')) {
                $table->string('spread_telegram_chat_id')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $cols = [
                'spread_enable_telegram_notifications',
                'spread_telegram_chat_id',
            ];
            foreach ($cols as $col) {
                if (Schema::hasColumn('users', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
