<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'auto_signal_capital')) {
                $table->decimal('auto_signal_capital', 18, 2)->nullable();
            }
            if (!Schema::hasColumn('users', 'auto_signal_strategy')) {
                $table->string('auto_signal_strategy')->nullable();
            }
            if (!Schema::hasColumn('users', 'auto_signal_risk')) {
                $table->decimal('auto_signal_risk', 8, 6)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $cols = [
                'auto_signal_capital',
                'auto_signal_strategy',
                'auto_signal_risk',
            ];

            foreach ($cols as $col) {
                if (Schema::hasColumn('users', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
