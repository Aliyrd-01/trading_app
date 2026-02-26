<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'plan',
        'plan_expires_at',
        'trial_expires_at',
        'verification_token',
        'reset_token',
        'reset_token_expires',
        'enable_email_notifications',
        'enable_telegram_notifications',
        'telegram_chat_id',
        'spread_enable_telegram_notifications',
        'spread_telegram_chat_id',
        'language',
        'auto_signals_enabled',
        'spread_alerts_enabled',
        'auto_signal_symbol',
        'auto_signal_capital',
        'auto_signal_trading_type',
        'auto_signal_strategy',
        'auto_signal_risk',
        'auto_signal_confirmation',
        'auto_signal_min_reliability',
        'auto_signal_check_interval',
        'auto_signal_last_check',
        'auto_signal_last_signal_price',
        'auto_signal_last_signal_direction',
        'auto_signal_last_fired_at',

        'crypto_monitor_interval_sec',
        'crypto_monitor_quote',
        'crypto_monitor_tokens_to_scan',
        'crypto_monitor_top_n',
        'crypto_monitor_alert_percent_min',
        'crypto_monitor_alert_percent_max',
        'crypto_monitor_selected_exchanges',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'plan_expires_at' => 'datetime',
        'trial_expires_at' => 'datetime',
        'reset_token_expires' => 'datetime',
        'auto_signals_enabled' => 'boolean',
        'spread_alerts_enabled' => 'boolean',
        'spread_enable_telegram_notifications' => 'boolean',
        'auto_signal_last_check' => 'datetime',
        'auto_signal_last_fired_at' => 'datetime',
        'crypto_monitor_selected_exchanges' => 'array',
    ];
}



