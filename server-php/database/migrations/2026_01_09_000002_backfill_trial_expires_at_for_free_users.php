<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'trial_expires_at')) {
            return;
        }

        DB::statement("UPDATE users SET trial_expires_at = DATE_ADD(created_at, INTERVAL 7 DAY) WHERE plan = 'free' AND trial_expires_at IS NULL");
    }

    public function down(): void
    {
        // no-op
    }
};
