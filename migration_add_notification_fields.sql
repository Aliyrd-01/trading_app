-- Миграция: Добавление полей для настроек уведомлений в таблицу users
-- Выполните этот SQL скрипт в вашей базе данных

ALTER TABLE `users` 
ADD COLUMN `telegram_chat_id` VARCHAR(50) NULL AFTER `plan`,
ADD COLUMN `enable_telegram_notifications` BOOLEAN DEFAULT FALSE AFTER `telegram_chat_id`,
ADD COLUMN `enable_email_notifications` BOOLEAN DEFAULT FALSE AFTER `enable_telegram_notifications`,
ADD COLUMN `alert_min_reliability` FLOAT DEFAULT 60.0 AFTER `enable_email_notifications`;

























