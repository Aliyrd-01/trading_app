# Финальная настройка демо

## ✅ Что уже сделано:

1. Flask приложение запущено на порту 5051
2. Исправлены синтаксические ошибки в trading_app.py
3. Созданы скрипты для автозапуска
4. Обновлен фронтенд для показа демо

## 📦 Что нужно загрузить на сервер:

### 1. Файлы Flask приложения:
- `crypto-analyzer/trading_app.py` (исправленный)
- `crypto-analyzer/start_flask.sh` (новый)
- `crypto-analyzer/check_flask.sh` (новый)

### 2. Файлы фронтенда (после сборки):
- `dist/public/` - вся папка после `npm run build`

## 🔧 Что сделать на сервере:

### 1. Загрузите исправленные файлы Flask:
```bash
# Загрузите trading_app.py, start_flask.sh, check_flask.sh
# в ~/domains/cryptoanalyz.net/public_html/crypto-analyzer/
```

### 2. Сделайте скрипты исполняемыми:
```bash
cd ~/domains/cryptoanalyz.net/public_html/crypto-analyzer
chmod +x start_flask.sh check_flask.sh
```

### 3. Flask уже запущен - проверьте:
```bash
ps aux | grep "python3 app.py" | grep -v grep
```

### 4. Пересоберите и загрузите фронтенд:
```bash
# Локально:
npm run build

# Загрузите dist/public/ на сервер
```

## ✅ Готово!

После этого демо будет работать на https://cryptoanalyz.net/demo

