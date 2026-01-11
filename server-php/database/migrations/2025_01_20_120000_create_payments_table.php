<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('order_id')->unique();
            $table->string('payment_id')->nullable();
            $table->string('plan'); // pro или pro_plus
            $table->decimal('amount', 10, 2);
            $table->string('currency', 10)->default('USD');
            $table->string('pay_currency', 10)->default('ETH');
            $table->string('payment_status')->nullable();
            $table->string('pay_status')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->index('order_id');
            $table->index('payment_id');
            $table->index('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};





