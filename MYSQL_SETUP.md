# Настройка MySQL для Crypto Analyzer

Приложение обновлено для работы с MySQL. Чтобы завершить настройку, выполните следующие шаги:

## 1. Обновите drizzle.config.ts

Откройте файл `drizzle.config.ts` и измените `dialect` с `"postgresql"` на `"mysql"`:

```typescript
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "mysql",  // <-- Измените с "postgresql" на "mysql"
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
```

## 2. Настройте DATABASE_URL

Убедитесь, что ваша переменная окружения `DATABASE_URL` использует формат MySQL:

```
mysql://username:password@host:port/database
```

Например:
```
mysql://root:password@localhost:3306/crypto_analyzer
```

## 3. Примените схему к базе данных

После обновления конфигурации, выполните команду для создания таблиц:

```bash
npm run db:push
```

Если возникнут ошибки, попробуйте:
```bash
npm run db:push --force
```

## Что было изменено

✅ Схема обновлена для MySQL (`mysqlTable` вместо `pgTable`)
✅ UUID генерация изменена на `UUID()` (MySQL синтаксис)
✅ Типы данных адаптированы (datetime вместо timestamp)
✅ Session store переключен на `express-mysql-session`
✅ MySQL2 драйвер установлен и настроен
✅ Удалены PostgreSQL зависимости (@neondatabase/serverless, connect-pg-simple)

## Проверка работы

После выполнения всех шагов:
1. Перезапустите приложение
2. Проверьте регистрацию нового пользователя
3. Проверьте вход и выход из системы

Всё должно работать с вашей MySQL базой данных!
