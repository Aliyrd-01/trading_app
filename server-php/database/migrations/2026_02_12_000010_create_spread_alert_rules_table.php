<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('spread_alert_rules', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->boolean('enabled')->default(true);
            $table->string('symbol');
            $table->json('exchanges');
            $table->decimal('threshold_percent', 10, 4)->default(0);
            $table->unsignedInteger('check_interval_minutes')->default(1);
            $table->unsignedInteger('cooldown_seconds')->default(300);
            $table->timestamp('last_checked_at')->nullable();
            $table->timestamp('last_fired_at')->nullable();
            $table->string('last_fired_key', 191)->nullable();
            $table->timestamps();

            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('spread_alert_rules');
    }
};
