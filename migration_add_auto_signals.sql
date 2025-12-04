-- Миграция: Добавление полей для автоматических сигналов
-- Выполните этот SQL в вашей базе данных

ALTER TABLE users 
ADD COLUMN auto_signals_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN auto_signal_symbol VARCHAR(20) NULL,
ADD COLUMN auto_signal_capital FLOAT NULL,
ADD COLUMN auto_signal_trading_type VARCHAR(50) NULL,
ADD COLUMN auto_signal_strategy VARCHAR(50) NULL,
ADD COLUMN auto_signal_risk FLOAT NULL,
ADD COLUMN auto_signal_confirmation VARCHAR(100) NULL,
ADD COLUMN auto_signal_min_reliability FLOAT DEFAULT 60.0,
ADD COLUMN auto_signal_check_interval INT DEFAULT 60,
ADD COLUMN auto_signal_last_check DATETIME NULL,
ADD COLUMN auto_signal_last_signal_price FLOAT NULL,
ADD COLUMN auto_signal_last_signal_direction VARCHAR(10) NULL;



