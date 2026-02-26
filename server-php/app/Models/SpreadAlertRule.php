<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SpreadAlertRule extends Model
{
    use HasFactory;

    protected $table = 'spread_alert_rules';

    protected $fillable = [
        'user_id',
        'enabled',
        'symbol',
        'exchanges',
        'threshold_percent',
        'check_interval_minutes',
        'cooldown_seconds',
        'last_checked_at',
        'last_fired_at',
        'last_fired_key',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'exchanges' => 'array',
        'threshold_percent' => 'float',
        'check_interval_minutes' => 'integer',
        'cooldown_seconds' => 'integer',
        'last_checked_at' => 'datetime',
        'last_fired_at' => 'datetime',
    ];
}
