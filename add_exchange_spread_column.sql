-- SQL скрипт для добавления колонки exchange_spread в таблицу users
-- Выполните этот скрипт в вашей MySQL базе данных

ALTER TABLE users 
ADD COLUMN exchange_spread FLOAT DEFAULT 0.0 
COMMENT 'Спред биржи в процентах (например, 0.1 = 0.1%)';










