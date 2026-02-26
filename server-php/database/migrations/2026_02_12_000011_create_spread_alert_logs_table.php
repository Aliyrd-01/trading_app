<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('spread_alert_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('rule_id');
            $table->string('status', 20);
            $table->decimal('spread_percent', 10, 4)->nullable();
            $table->json('prices')->nullable();
            $table->text('message')->nullable();
            $table->text('error')->nullable();
            $table->string('fired_key', 191)->nullable();
            $table->timestamp('fired_at')->nullable();
            $table->timestamps();

            $table->index('user_id');
            $table->index('rule_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('spread_alert_logs');
    }
};
