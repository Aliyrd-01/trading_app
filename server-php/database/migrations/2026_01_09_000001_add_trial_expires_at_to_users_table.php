<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'trial_expires_at')) {
                $table->timestamp('trial_expires_at')->nullable()->after('plan_expires_at');
            }
        });

        if (Schema::hasColumn('users', 'trial_expires_at')) {
            DB::statement("UPDATE users SET trial_expires_at = DATE_ADD(created_at, INTERVAL 7 DAY) WHERE plan = 'free' AND trial_expires_at IS NULL");
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'trial_expires_at')) {
                $table->dropColumn('trial_expires_at');
            }
        });
    }
};
