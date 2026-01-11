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
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'verification_token')) {
                $table->string('verification_token')->nullable()->after('email_verified_at');
            }
            if (!Schema::hasColumn('users', 'reset_token')) {
                $table->string('reset_token')->nullable()->after('verification_token');
            }
            if (!Schema::hasColumn('users', 'reset_token_expires')) {
                $table->timestamp('reset_token_expires')->nullable()->after('reset_token');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['verification_token', 'reset_token', 'reset_token_expires']);
        });
    }
};





