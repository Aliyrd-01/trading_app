<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('auto_signal_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('symbol');
            $table->string('binance_symbol');
            $table->string('timeframe', 10)->nullable();
            $table->string('direction', 10)->nullable();
            $table->unsignedTinyInteger('reliability')->nullable();
            $table->decimal('price', 18, 8)->nullable();
            $table->string('status', 20);
            $table->timestamp('fired_at')->nullable();
            $table->text('message')->nullable();
            $table->text('error')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('auto_signal_logs');
    }
};
