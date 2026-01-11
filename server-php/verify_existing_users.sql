-- SQL скрипт для пометки всех существующих пользователей как верифицированных
-- Выполните этот скрипт в MySQL для пометки всех пользователей, созданных до внедрения верификации

UPDATE users 
SET email_verified_at = NOW(), 
    verification_token = NULL 
WHERE email_verified_at IS NULL;





