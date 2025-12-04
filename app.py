import os
import base64
import io
import zipfile
import csv
import traceback
import logging
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for, session, make_response
import json
from werkzeug.security import check_password_hash
import bcrypt
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func
from trading_app import run_analysis, smart_combine_indicators, fetch_ohlcv, get_report_translation  # твой модуль анализа
import requests
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import atexit
import signal
import urllib3

# === Настройка логирования ===
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Загрузка переменных окружения из .env файла (если есть)
try:
    from dotenv import load_dotenv
    load_dotenv()
    # logger будет определен позже, используем print здесь
    print("✅ Загружены переменные окружения из .env файла")
except ImportError:
    print("⚠️ python-dotenv не установлен. Для использования .env файла установите: pip install python-dotenv")
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
import numpy as np
try:
    import seaborn as sns
    sns.set_style("darkgrid")
    HAS_SEABORN = True
except ImportError:
    HAS_SEABORN = False

# === Flask app ===
app = Flask(__name__)
# ✅ ИСПРАВЛЕНО: Фиксированный secret_key из переменной окружения
# Если не задан, генерируем один раз и сохраняем в файл для постоянства
SECRET_KEY_FILE = '.secret_key'
if os.path.exists(SECRET_KEY_FILE):
    with open(SECRET_KEY_FILE, 'r') as f:
        app.secret_key = f.read().strip()
else:
    app.secret_key = os.getenv('FLASK_SECRET_KEY', os.urandom(24).hex())
    # Сохраняем для будущих запусков
    try:
        with open(SECRET_KEY_FILE, 'w') as f:
            f.write(app.secret_key)
        logger.info("✅ Создан новый secret_key и сохранен в файл")
    except Exception as e:
        logger.warning(f"⚠️ Не удалось сохранить secret_key в файл: {e}")

# === Настройки сессий для работы через прокси ===
app.config['SESSION_COOKIE_SECURE'] = False  # True если используете HTTPS
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_PATH'] = '/'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)

# === Настройки уведомлений ===
# Сначала пытаемся загрузить из config_notifications.py (упрощенная настройка)
try:
    from config_notifications import (
        TELEGRAM_BOT_TOKEN as CONFIG_TELEGRAM_TOKEN,
        RESEND_API_KEY as CONFIG_RESEND_API_KEY,
        RESEND_FROM_EMAIL as CONFIG_RESEND_FROM_EMAIL,
        # Старые SMTP настройки (для обратной совместимости)
        SMTP_HOST as CONFIG_SMTP_HOST,
        SMTP_PORT as CONFIG_SMTP_PORT,
        SMTP_USER as CONFIG_SMTP_USER,
        SMTP_PASSWORD as CONFIG_SMTP_PASSWORD
    )
    # Используем настройки из config_notifications.py, если они заполнены
    TELEGRAM_BOT_TOKEN = CONFIG_TELEGRAM_TOKEN if CONFIG_TELEGRAM_TOKEN else os.getenv("TELEGRAM_BOT_TOKEN", "")
    RESEND_API_KEY = CONFIG_RESEND_API_KEY if CONFIG_RESEND_API_KEY else os.getenv("RESEND_API_KEY", "")
    RESEND_FROM_EMAIL = CONFIG_RESEND_FROM_EMAIL if CONFIG_RESEND_FROM_EMAIL else os.getenv("RESEND_FROM_EMAIL", "")
    # Старые SMTP настройки (для обратной совместимости)
    SMTP_HOST = CONFIG_SMTP_HOST if CONFIG_SMTP_HOST else os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(CONFIG_SMTP_PORT) if CONFIG_SMTP_PORT else int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = CONFIG_SMTP_USER if CONFIG_SMTP_USER else os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = CONFIG_SMTP_PASSWORD if CONFIG_SMTP_PASSWORD else os.getenv("SMTP_PASSWORD", "")
except ImportError:
    # Если config_notifications.py не существует, используем переменные окружения
    TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
    RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
    RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "")
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    print("ℹ️ Файл config_notifications.py не найден. Используются переменные окружения.")
except Exception as e:
    print(f"⚠️ Ошибка загрузки config_notifications.py: {e}. Используются переменные окружения.")
    TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
    RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
    RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "")
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

# === MySQL ===
app.config['SQLALCHEMY_DATABASE_URI'] = "mysql+pymysql://u543957720_crypto:AgUbbkD1h!@auth-db936.hstgr.io/u543957720_cryptoprice"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {"pool_recycle": 280, "pool_pre_ping": True}

db = SQLAlchemy(app)

# === Модели ===
class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=True)
    email = db.Column(db.String(191), unique=True, nullable=False)
    email_verified_at = db.Column(db.DateTime, nullable=True)
    password = db.Column(db.String(255), nullable=False)
    remember_token = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    plan = db.Column(db.String(20), default="free")
    # Настройки уведомлений
    telegram_chat_id = db.Column(db.String(50), nullable=True)
    enable_telegram_notifications = db.Column(db.Boolean, default=False)
    enable_email_notifications = db.Column(db.Boolean, default=False)
    alert_min_reliability = db.Column(db.Float, default=60.0)
    # Настройки торговли
    exchange_spread = db.Column(db.Float, default=0.0)  # Спред биржи в процентах (например, 0.1 = 0.1%)
    # Настройки автоматических сигналов
    auto_signals_enabled = db.Column(db.Boolean, default=False)
    auto_signal_symbol = db.Column(db.String(20), nullable=True)
    auto_signal_capital = db.Column(db.Float, nullable=True)
    auto_signal_trading_type = db.Column(db.String(50), nullable=True)
    auto_signal_strategy = db.Column(db.String(50), nullable=True)
    auto_signal_risk = db.Column(db.Float, nullable=True)
    auto_signal_confirmation = db.Column(db.String(100), nullable=True)
    auto_signal_min_reliability = db.Column(db.Float, default=60.0)
    auto_signal_check_interval = db.Column(db.Integer, default=60)
    auto_signal_last_check = db.Column(db.DateTime, nullable=True)
    auto_signal_last_signal_price = db.Column(db.Float, nullable=True)
    auto_signal_last_signal_direction = db.Column(db.String(10), nullable=True)


class ReportV2(db.Model):
    __tablename__ = "report_v2"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    symbol = db.Column(db.String(20))
    strategy = db.Column(db.String(50))
    trading_type = db.Column(db.String(50))
    capital = db.Column(db.Float)
    risk = db.Column(db.Float)
    confirmation = db.Column(db.String(100))
    direction = db.Column(db.String(10))
    entry_price = db.Column(db.Float)
    exit_price = db.Column(db.Float)
    rr_long = db.Column(db.Float)
    rr_short = db.Column(db.Float)
    profit_loss = db.Column(db.Float)
    profit_loss_percent = db.Column(db.Float)
    success = db.Column(db.Boolean)
    trend = db.Column(db.String(20))
    stop_loss = db.Column(db.Float, nullable=True)
    take_profit = db.Column(db.Float, nullable=True)
    report_text = db.Column(db.Text)
    result_summary = db.Column(db.String(200))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref="reports_v2")


# ✅ ФАЗА 2: Улучшенная обработка ошибок БД при старте приложения
with app.app_context():
    try:
        db.create_all()
        logger.info("✅ База данных инициализирована")
    except Exception as db_init_error:
        logger.error(f"❌ Ошибка инициализации БД: {db_init_error}")
        # Продолжаем работу, если БД недоступна (graceful degradation)
    
    # Проверяем и добавляем колонку exchange_spread, если её нет
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(db.engine)
        columns = [col['name'] for col in inspector.get_columns('users')]
        if 'exchange_spread' not in columns:
            logger.warning("⚠️ Колонка exchange_spread не найдена в таблице users. Добавляю...")
            db.session.execute(text("ALTER TABLE users ADD COLUMN exchange_spread FLOAT DEFAULT 0.0"))
            db.session.commit()
            logger.info("✅ Колонка exchange_spread успешно добавлена в таблицу users")
    except Exception as e:
        logger.error(f"⚠️ Не удалось проверить/добавить колонку exchange_spread: {e}")
        try:
            db.session.rollback()
        except:
            pass  # Игнорируем ошибки rollback, если БД недоступна

# === Функция получения переводов ===
def get_translation(key, language=None, **params):
    """Получает перевод для ключа с учетом языка из сессии или запроса"""
    if language is None:
        language = request.args.get('language') or session.get('language', 'ru')
    if language not in ['ru', 'en', 'uk']:
        language = 'ru'
    return get_report_translation(key, language, **params)

# === Проверка пароля ===
def verify_password(plain_password: str, stored_hash: str) -> bool:
    if not stored_hash or not plain_password:
        return False
    plain_password = plain_password.strip()
    stored_hash = stored_hash.strip()
    # Поддержка PHP bcrypt ($2y$) и стандартных $2b$/$2a$
    if stored_hash.startswith("$2y$") or stored_hash.startswith("$2b$") or stored_hash.startswith("$2a$"):
        try:
            # Нормализуем $2y$ -> $2b$ для совместимости с python-bcrypt
            hash_for_check = stored_hash
            if stored_hash.startswith("$2y$"):
                hash_for_check = "$2b$" + stored_hash[4:]
            return bcrypt.checkpw(plain_password.encode("utf-8"), hash_for_check.encode("utf-8"))
        except Exception:
            return False
    try:
        if stored_hash.startswith(("pbkdf2:", "scrypt:", "bcrypt:")):
            return check_password_hash(stored_hash, plain_password)
    except Exception:
        pass
    # ✅ ИСПРАВЛЕНО: Убран небезопасный fallback сравнения паролей
    # Если пароль не в формате хеша, логируем предупреждение и возвращаем False
    if len(stored_hash) < 20:  # Хеши обычно длиннее
        logger.warning(f"⚠️ Обнаружен пароль без хеша для пользователя. Требуется миграция паролей.")
        return False
    logger.error(f"❌ КРИТИЧЕСКАЯ ОШИБКА: Попытка сравнения пароля без хеша! Это небезопасно!")
    return False


# === Функция для получения переводов ===
def get_translation(key, language="ru", **params):
    """Получает перевод из trading_app.REPORT_TRANSLATIONS"""
    from trading_app import REPORT_TRANSLATIONS
    translations = REPORT_TRANSLATIONS.get(language, REPORT_TRANSLATIONS["ru"])
    translation = translations.get(key, key)
    if params:
        try:
            translation = translation.format(**params)
        except:
            pass
    return translation


# === API: Login ===
@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.json or {}
    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()

    if not email or not password:
        return jsonify({"error": "Email и пароль обязательны"}), 400

    user = User.query.filter(func.lower(User.email) == email).first()
    if not user:
        language = request.json.get('language', 'ru') if request.json else 'ru'
        return jsonify({"error": get_translation("error_user_not_found", language)}), 404

    if not verify_password(password, user.password):
        language = request.json.get('language', 'ru') if request.json else 'ru'
        return jsonify({"error": get_translation("error_invalid_password", language)}), 401

    session["user_id"] = user.id
    session["email"] = user.email

    return jsonify({
        "ok": True,
        "user": {"id": user.id, "email": user.email, "plan": user.plan}
    })


# === API: Logout ===
@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"ok": True})


# === Проверка сессии ===
@app.route("/session_check")
def session_check():
    # ✅ В demo режиме считаем пользователя "авторизованным"
    if session.get("demo_mode"):
        return jsonify({"logged_in": True, "demo_mode": True})
    return jsonify({"logged_in": bool(session.get("user_id"))})


# === API: Информация о пользователе ===
@app.route("/api/user_info")
def api_user_info():
    if not session.get("user_id"):
        language = request.args.get('language', 'ru')
        return jsonify({"error": get_translation("error_unauthorized", language)}), 401
    
    user = User.query.get(session["user_id"])
    if not user:
        return jsonify({"error": "Пользователь не найден"}), 404
    
    return jsonify({
        "id": user.id,
        "email": user.email,
        "plan": user.plan or "free"
    })


# === API: Исторические данные (klines) ===
@app.route("/api/klines")
def api_klines():
    if not session.get("user_id"):
        language = request.args.get('language', 'ru')
        return jsonify({"error": get_translation("error_unauthorized", language)}), 401
    
    symbol = request.args.get("symbol", "").upper()
    interval = request.args.get("interval", "1h")
    limit = int(request.args.get("limit", 500))
    
    language = request.args.get("language", "ru")
    if not symbol:
        return jsonify({"error": get_translation("error_symbol_required", language) or "Symbol обязателен"}), 400
    
    try:
        # Используем функцию fetch_ohlcv из trading_app
        # fetch_ohlcv принимает history_days, но нам нужен limit
        # Оцениваем количество дней на основе limit и interval
        import pandas as pd
        from datetime import timedelta
        
        # Приблизительная оценка дней для получения нужного количества свечей
        interval_to_hours = {
            "1m": 1/60, "3m": 3/60, "5m": 5/60, "15m": 15/60, "30m": 30/60,
            "1h": 1, "2h": 2, "4h": 4, "6h": 6, "8h": 8, "12h": 12,
            "1d": 24, "3d": 72, "1w": 168, "1M": 720
        }
        hours_per_candle = interval_to_hours.get(interval, 1)
        total_hours = limit * hours_per_candle
        history_days = max(1, int(total_hours / 24) + 1)  # +1 для запаса
        
        try:
            df = fetch_ohlcv(symbol, interval, history_days=history_days)
        except Exception as e:
            error_msg = str(e)
            # Определяем тип ошибки
            language = request.args.get('language', 'ru')
            if "getaddrinfo failed" in error_msg or "Failed to resolve" in error_msg:
                return jsonify({
                    "error": get_translation("error_binance_connection", language),
                    "details": get_translation("error_binance_dns", language)
                }), 503
            elif "NetworkError" in error_msg or "ConnectionError" in error_msg:
                return jsonify({
                    "error": get_translation("error_binance_server", language),
                    "details": error_msg
                }), 503
            else:
                return jsonify({
                    "error": get_translation("error_binance_data", language, error=error_msg),
                    "details": error_msg
                }), 500
        
        if df is None or df.empty:
            language = request.args.get('language', 'ru')
            return jsonify({"error": get_translation("error_binance_no_data", language)}), 404
        
        # Ограничиваем количество строк до limit
        df = df.tail(limit)
        
        # Конвертируем в формат klines (как у Binance API)
        klines = []
        for _, row in df.iterrows():
            # Преобразуем индекс (timestamp) в миллисекунды
            timestamp_ms = int(pd.Timestamp(row.name).timestamp() * 1000)
            
            kline = [
                timestamp_ms,                      # Open time
                str(float(row["Open"])),           # Open
                str(float(row["High"])),           # High
                str(float(row["Low"])),            # Low
                str(float(row["Close"])),          # Close
                str(float(row["Volume"])),         # Volume
                timestamp_ms,                      # Close time
                "0",                               # Quote asset volume
                0,                                 # Number of trades
                "0",                               # Taker buy base asset volume
                "0",                               # Taker buy quote asset volume
                "0"                                # Ignore
            ]
            klines.append(kline)
        
        return jsonify(klines)
    except Exception as e:
        print(f"⚠️ Ошибка получения klines: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# === Страницы ===
@app.route("/login")
def login_page():
    return render_template("login.html")

@app.route("/")
def index_page():
    if not session.get("user_id"):
        return redirect(url_for("login_page"))
    return render_template("index.html")


@app.route("/demo", methods=["GET", "POST"])
@app.route("/demo/", methods=["GET", "POST"])
def demo_page():
    """Demo режим - приложение без авторизации"""
    try:
        logger.info(f"🎮 Запрос на /demo от {request.remote_addr}")
        logger.info(f"🎮 User-Agent: {request.headers.get('User-Agent', 'Unknown')}")
        logger.info(f"🎮 Referer: {request.headers.get('Referer', 'Direct')}")
        logger.info(f"🎮 Session до: demo_mode={session.get('demo_mode')}, user_id={session.get('user_id')}")
        
        # Устанавливаем флаг demo режима в сессии
        session['demo_mode'] = True
        session.permanent = True  # ✅ Делаем сессию постоянной
        
        # Очищаем user_id для demo режима (если был установлен)
        if 'user_id' in session:
            session.pop('user_id', None)
        
        logger.info(f"🎮 Session после: demo_mode={session.get('demo_mode')}, user_id={session.get('user_id')}")
        logger.info("✅ Demo режим активирован, рендерим index.html")
        
        # ✅ Создаем response с явной установкой cookie
        response = make_response(render_template("index.html", demo_mode=True))
        # ✅ Устанавливаем cookie явно для надежности
        response.set_cookie('demo_mode', 'true', max_age=3600, path='/', httponly=False, samesite='Lax')
        return response
    except Exception as e:
        logger.error(f"❌ Ошибка в demo_page: {e}")
        logger.error(f"❌ Traceback: {traceback.format_exc()}")
        # Fallback: возвращаем страницу даже при ошибке
        try:
            response = make_response(render_template("index.html", demo_mode=True))
            response.set_cookie('demo_mode', 'true', max_age=3600, path='/', httponly=False, samesite='Lax')
            return response
        except Exception as e2:
            logger.error(f"❌ Критическая ошибка рендеринга: {e2}")
            return f"<html><body><h1>Demo Mode Error</h1><p>Error: {str(e)}</p><p>Details: {str(e2)}</p></body></html>", 500


# === API: Анализ ===
@app.route("/api/analyze", methods=["POST"])
def run_analysis_route():
    # ✅ ИСПРАВЛЕНО: Разрешаем demo режим
    if not session.get("user_id") and not session.get("demo_mode"):
        language = request.args.get('language') or (request.json.get('language') if request.json else None) or 'ru'
        return jsonify({"error": get_translation("error_unauthorized", language)}), 401

    data = request.json or {}
    user_id = session.get("user_id")  # Может быть None в demo режиме

    try:
        # Получаем параметры трейлинга
        enable_trailing = bool(data.get("enable_trailing", False))
        trailing_percent = float(data.get("trailing_percent", 50)) / 100 if enable_trailing else None
        
        # Получаем таймфрейм: если передан конкретный - используем его, иначе None (будет использован дефолтный)
        timeframe = data.get("timeframe")
        if timeframe == "auto" or timeframe == "" or timeframe is None:
            timeframe = None  # Используется дефолтный таймфрейм для типа торговли
        
        # Маппинг значений из формы в русские названия
        strategy_map = {
            "conservative": "Консервативная",
            "balanced": "Сбалансированная",
            "aggressive": "Агрессивная",
            "Консервативная": "Консервативная",
            "Сбалансированная": "Сбалансированная",
            "Агрессивная": "Агрессивная"
        }
        
        trading_type_map = {
            "scalping": "Скальпинг",
            "daytrading": "Дейтрейдинг",
            "swing": "Свинг",
            "medium_term": "Среднесрочная",
            "long_term": "Долгосрочная",
            "Скальпинг": "Скальпинг",
            "Дейтрейдинг": "Дейтрейдинг",
            "Свинг": "Свинг",
            "Среднесрочная": "Среднесрочная",
            "Долгосрочная": "Долгосрочная"
        }
        
        strategy_input = data.get("strategy", "balanced")
        trading_type_input = data.get("trading_type", "daytrading")
        
        strategy = strategy_map.get(strategy_input, strategy_input)
        trading_type = trading_type_map.get(trading_type_input, trading_type_input)
        
        # ✅ Получаем спред биржи из настроек пользователя
        user = User.query.get(user_id)
        exchange_spread = getattr(user, 'exchange_spread', 0.0) if user else 0.0
        
        # ✅ Получаем язык из запроса (по умолчанию русский)
        language = data.get("language", "ru")
        if language not in ["ru", "en", "uk"]:
            language = "ru"
        
        (
            reports_by_language,  # ✅ Словарь с отчетами на всех языках
            report_markdown_raw,  # Сырой markdown (для совместимости)
            chart_bytes,
            excel_bytes,
            symbol,
            rr_long,
            rr_short,
            entry_price,
            exit_price,
            direction,
            trend,
            stop_loss,
            take_profit,
            reliability_rating,
            rsi_value  # ✅ ФАЗА 2: Получаем реальный RSI из run_analysis
        ) = run_analysis(
            data.get("symbol"),
            timeframe,  # Передаем выбранный таймфрейм (None для автоматического)
            strategy,  # Уже переведено
            trading_type,  # Уже переведено
            float(data.get("capital", 10000)),
            float(data.get("risk", 1)) / 100,
            None,
            data.get("confirmation"),
            float(data.get("min_reliability", 50)),
            bool(data.get("enable_forecast", False)),
            bool(data.get("enable_backtest", False)),
            data.get("backtest_days"),  # может быть None или int
            bool(data.get("enable_ml", False)),
            ReportV2.query.filter(ReportV2.success.isnot(None)).limit(1000).all() if bool(data.get("enable_ml", False)) else None,
            enable_trailing=enable_trailing,
            trailing_percent=trailing_percent,
            spread=exchange_spread,  # ✅ Передаем спред биржи
            language=language  # ✅ Передаем язык
        )

        # ✅ ИСПРАВЛЕНИЕ: Определяем report_text для использования в коде
        current_lang = language if language in ["ru", "en", "uk"] else "ru"
        report_text = reports_by_language.get(current_lang, reports_by_language["ru"])

        # ✅ ГИБРИДНЫЙ ПОДХОД: Расчет profit_loss с использованием динамического риска (как в backtest)
        # Используем ту же логику, что и в backtest_strategy для согласованности
        if entry_price and exit_price and direction and entry_price > 0:
            # Импортируем dynamic_risk для согласованности с backtest
            from trading_app import dynamic_risk
            
            # Базовый риск
            base_risk = data.get("risk", 0) / 100 if data.get("risk") else 0.01
            
            # ✅ ФАЗА 2: Используем реальный RSI из run_analysis вместо фиксированного значения
            # Теперь dynamic_risk получает корректные данные для точного расчета
            risk_adj = dynamic_risk(base_risk, rsi_value, trend)
            
            # Защита от None
            if risk_adj is None:
                risk_adj = base_risk  # Fallback на базовый риск
            
            # Размер риска от начального капитала (для предсказуемости в run_analysis)
            # В backtest используется current_capital, но здесь используем начальный для согласованности
            capital = data.get("capital", 10000)
            risk_amount = capital * risk_adj
            
            # ✅ Используем те же TP/SL и R:R расчеты, что и в backtest
            if stop_loss and take_profit:
                if direction == "long":
                    sl_dist = abs(entry_price - stop_loss)
                    tp_dist = abs(take_profit - entry_price)
                else:  # short
                    sl_dist = abs(stop_loss - entry_price)
                    tp_dist = abs(entry_price - take_profit)
                
                if sl_dist > 1e-9:
                    rr_actual = tp_dist / sl_dist
                    # Прибыль от риска с учетом R:R (как в backtest)
                    profit_loss = risk_amount * rr_actual
                    # ✅ ИСПРАВЛЕНО: Рассчитываем размер позиции для правильного расчета комиссий
                    position_units = risk_amount / sl_dist
                    position_value = position_units * entry_price
                else:
                    # Fallback: если SL расстояние = 0
                    if direction == "long":
                        profit_loss = (exit_price - entry_price) * risk_amount / entry_price
                    else:
                        profit_loss = (entry_price - exit_price) * risk_amount / entry_price
                    # Приблизительный размер позиции (используем 50% капитала как fallback)
                    position_value = capital * 0.5
            else:
                # Fallback: если TP/SL не заданы
                if direction == "long":
                    profit_loss = (exit_price - entry_price) * risk_amount / entry_price
                else:
                    profit_loss = (entry_price - exit_price) * risk_amount / entry_price
                # Приблизительный размер позиции (используем 50% капитала как fallback)
                position_value = capital * 0.5
            
            # ✅ ИСПРАВЛЕНО: Комиссия рассчитывается от стоимости позиции, а не от risk_amount
            # Комиссия: 0.1% при входе + 0.1% при выходе = 0.2% от стоимости позиции (round-trip)
            commission_rate = 0.002  # 0.2% общая комиссия
            commission_amount = position_value * commission_rate
            profit_loss -= commission_amount
            
            # ✅ ИСПРАВЛЕНО: Спред рассчитывается от стоимости позиции, а не от risk_amount
            # Спред применяется при входе и выходе (round-trip)
            if exchange_spread > 0:
                spread_pct = exchange_spread / 100  # Конвертируем проценты в дробь
                spread_amount = position_value * spread_pct * 2  # Спред при входе и выходе
                profit_loss -= spread_amount
            
            # Расчет profit_loss_percent
            if direction == "long":
                profit_loss_percent = ((exit_price - entry_price) / entry_price * 100)
            else:  # short
                profit_loss_percent = ((entry_price - exit_price) / entry_price * 100)
        else:
            profit_loss = None
            profit_loss_percent = None
        
        # Успех определяется на основе фактической прибыли, а не просто сравнения цен
        # Это учитывает комиссии и другие факторы
        if profit_loss_percent is not None:
            success = profit_loss_percent > 0
        else:
            # Fallback: если прибыль не рассчитана, используем сравнение цен
            success = ((exit_price > entry_price) if direction == "long" else (exit_price < entry_price)) if entry_price and exit_price and direction else None

        # Конвертируем numpy типы в обычные Python типы для БД
        def convert_numpy(value):
            if value is None:
                return None
            try:
                # Проверяем на numpy nan перед конвертацией
                if isinstance(value, float) and (np.isnan(value) or value != value):
                    return None
                if hasattr(value, 'item'):  # numpy scalar
                    converted = value.item()
                    # Проверяем на nan после конвертации
                    if isinstance(converted, float) and (np.isnan(converted) or converted != converted):
                        return None
                    return converted
                if isinstance(value, (np.integer, np.floating)):
                    converted = float(value)
                    # Проверяем на nan
                    if np.isnan(converted) or converted != converted:
                        return None
                    return converted
                # Дополнительная проверка для обычных float
                if isinstance(value, float) and (np.isnan(value) or value != value):
                    return None
            except (ValueError, TypeError, OverflowError):
                # Если не удалось конвертировать, возвращаем None
                return None
            return value
        
        # ✅ В demo режиме не сохраняем отчеты в БД
        if session.get("demo_mode"):
            logger.info("💡 Demo режим: отчет не сохранен в БД")
        else:
            # ✅ current_lang уже определен выше (строка 570)
            
            report = ReportV2(
                user_id=user_id,
                symbol=symbol,
                strategy=data.get("strategy"),
                trading_type=data.get("trading_type"),
                capital=float(data.get("capital", 0)),
                risk=float(data.get("risk", 0)),
                confirmation=str(data.get("confirmation", "")),
                report_text=reports_by_language.get(current_lang, reports_by_language["ru"]),  # Сохраняем отчет на текущем языке
                rr_long=convert_numpy(rr_long),
                rr_short=convert_numpy(rr_short),
                trend=trend,
                entry_price=convert_numpy(entry_price),
                exit_price=convert_numpy(exit_price),
                direction=direction,
                stop_loss=convert_numpy(stop_loss),
                take_profit=convert_numpy(take_profit),
                profit_loss=convert_numpy(profit_loss),
                profit_loss_percent=convert_numpy(profit_loss_percent),
                success=success,
                result_summary="Анализ завершён"
            )

            db.session.add(report)
            error_str = None
            try:
                db.session.commit()
                logger.info(f"💾 Отчёт сохранён: id={report.id}, user={user_id}")
            except Exception as db_error:
                db.session.rollback()
                error_str = str(db_error)
                # ✅ ФАЗА 2: Улучшенная обработка ошибок БД с retry и connection pool
                # Проверяем различные типы ошибок подключения
                connection_errors = [
                    "2006", "MySQL server has gone away", "ConnectionResetError",
                    "2003", "Can't connect to MySQL", "getaddrinfo failed",
                    "OperationalError", "ConnectionError", "Timeout"
                ]
                is_connection_error = any(err in error_str for err in connection_errors)
                
                if is_connection_error:
                    logger.warning(f"⚠️ Потеряно соединение с БД, пытаемся переподключиться...")
                    max_retries = 3
                    retry_count = 0
                    success = False
                    
                    while retry_count < max_retries and not success:
                        try:
                            retry_count += 1
                            # Закрываем текущую сессию и переподключаемся
                            db.session.close()
                            db.engine.dispose()
                            # Создаём новый объект отчёта для повторной попытки
                            report_retry = ReportV2(
                                user_id=user_id,
                                symbol=symbol,
                                strategy=data.get("strategy"),
                                trading_type=data.get("trading_type"),
                                capital=float(data.get("capital", 0)),
                                risk=float(data.get("risk", 0)),
                                confirmation=str(data.get("confirmation", "")),
                                report_text=report_text,
                                rr_long=convert_numpy(rr_long),
                                rr_short=convert_numpy(rr_short),
                                trend=trend,
                                entry_price=convert_numpy(entry_price),
                                exit_price=convert_numpy(exit_price),
                                direction=direction,
                                stop_loss=convert_numpy(stop_loss),
                                take_profit=convert_numpy(take_profit),
                                profit_loss=convert_numpy(profit_loss),
                                profit_loss_percent=convert_numpy(profit_loss_percent),
                                success=success,
                                result_summary="Анализ завершён"
                            )
                            db.session.add(report_retry)
                            db.session.commit()
                            logger.info(f"💾 Отчёт сохранён после переподключения (попытка {retry_count}): id={report_retry.id}, user={user_id}")
                            success = True
                        except Exception as retry_error:
                            logger.warning(f"⚠️ Ошибка сохранения отчёта после переподключения (попытка {retry_count}/{max_retries}): {retry_error}")
                            if retry_count < max_retries:
                                import time
                                time.sleep(1)  # Небольшая задержка перед следующей попыткой
                    
                    if not success:
                        logger.error(f"❌ Не удалось сохранить отчёт после {max_retries} попыток переподключения")
                else:
                    logger.error(f"⚠️ Ошибка сохранения отчёта (не связана с подключением): {db_error}")
                    # Продолжаем работу, даже если не удалось сохранить в БД
                    pass

        # === Уведомления ===
        # ✅ В demo режиме не отправляем уведомления
        if session.get("demo_mode"):
            logger.info("💡 Demo режим: уведомления не отправляются")
        else:
            user = User.query.get(user_id)
            
            # ✅ Добавляем подробное логирование для диагностики
            logger.info(f"🔔 Проверка уведомлений для user_id={user_id}, reliability_rating={reliability_rating}")
            
            if not user:
                logger.warning(f"⚠️ Пользователь с user_id={user_id} не найден в БД")
            else:
                logger.info(f"📋 Настройки уведомлений пользователя: enable_email={getattr(user, 'enable_email_notifications', None)}, "
                           f"enable_telegram={getattr(user, 'enable_telegram_notifications', None)}, "
                           f"email={getattr(user, 'email', None)}, "
                           f"telegram_chat_id={getattr(user, 'telegram_chat_id', None)}")
            
            # Минимальный рейтинг (из запроса или из БД)
            alert_min_reliability = float(data.get("alert_min_reliability", user.alert_min_reliability if user else 60))
            logger.info(f"📊 Минимальный рейтинг для уведомлений: {alert_min_reliability}, текущий рейтинг: {reliability_rating}")
            
            # Отправляем уведомления только если рейтинг достаточен
            if user and reliability_rating >= alert_min_reliability:
                logger.info(f"✅ Условие для отправки уведомлений выполнено (reliability_rating >= alert_min_reliability)")
                alert_message = format_alert_message(
                    symbol, direction, entry_price, stop_loss, take_profit,
                    reliability_rating, data.get("strategy"), trend, language=language
                )
                
                # Email уведомления (если включено)
                if user.enable_email_notifications and user.email:
                    email_subject = f"🚨 Новый торговый сигнал: {symbol} {direction.upper()}"
                    email_message = alert_message.replace("<b>", "").replace("</b>", "").replace("🚨", "🚨").replace("📊", "📊")
                    logger.info(f"📧 Попытка отправить Email уведомление на {user.email}")
                    if send_email_notification(user.email, email_subject, email_message):
                        logger.info(f"✅ Email уведомление отправлено на {user.email}")
                    else:
                        logger.warning(f"⚠️ Не удалось отправить Email уведомление на {user.email}. Проверьте SMTP настройки в config_notifications.py.")
                else:
                    logger.info(f"📧 Email уведомления пропущены: enable_email_notifications={getattr(user, 'enable_email_notifications', None)}, email={getattr(user, 'email', None)}")
                
                # Telegram уведомления (если включено)
                if user.enable_telegram_notifications and user.telegram_chat_id:
                    telegram_message = alert_message.replace("<b>", "*").replace("</b>", "*").replace("🚨", "🚨").replace("📊", "📊")
                    logger.info(f"📱 Попытка отправить Telegram уведомление на {user.telegram_chat_id}")
                    if send_telegram_notification(user.telegram_chat_id, telegram_message):
                        logger.info(f"✅ Telegram уведомление отправлено на {user.telegram_chat_id}")
                    else:
                        logger.warning(f"⚠️ Не удалось отправить Telegram уведомление на {user.telegram_chat_id}")
                else:
                    logger.info(f"📱 Telegram уведомления пропущены: enable_telegram_notifications={getattr(user, 'enable_telegram_notifications', None)}, "
                               f"telegram_chat_id={getattr(user, 'telegram_chat_id', None)}")
            else:
                if not user:
                    logger.warning(f"⚠️ Уведомления не отправлены: пользователь не найден")
                elif reliability_rating < alert_min_reliability:
                    logger.info(f"⚠️ Уведомления не отправлены: reliability_rating ({reliability_rating}) < alert_min_reliability ({alert_min_reliability})")

        chart_base64 = base64.b64encode(chart_bytes.getvalue()).decode() if chart_bytes else None
        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf, "w") as z:
            z.writestr("report.txt", report_text)
            if chart_bytes:
                z.writestr("chart.png", chart_bytes.getvalue())
            if excel_bytes:
                z.writestr("data.xlsx", excel_bytes.getvalue())
        zip_base64 = base64.b64encode(zip_buf.getvalue()).decode()

        # Вспомогательная функция для безопасной конвертации в float для JSON
        def safe_float(value):
            if value is None:
                return None
            try:
                # Проверяем на numpy nan
                if isinstance(value, float) and (np.isnan(value) or value != value):
                    return None
                if hasattr(value, 'item'):
                    converted = value.item()
                    if isinstance(converted, float) and (np.isnan(converted) or converted != converted):
                        return None
                    return converted
                converted = float(value)
                if np.isnan(converted) or converted != converted:
                    return None
                return converted
            except (ValueError, TypeError, OverflowError):
                return None

        # ✅ Психологические уровни для графика
        from trading_app import find_psychological_levels
        psychological_levels = find_psychological_levels(safe_float(entry_price) or 0, count=3) if entry_price else []
        
        # Получаем trailing_percent из запроса
        enable_trailing = data.get("enable_trailing", False)
        trailing_percent = data.get("trailing_percent", 50) if enable_trailing else None
        
        # ✅ current_lang уже определен выше (строка 570)
        
        return jsonify({
            "report_text": reports_by_language.get(current_lang, reports_by_language["ru"]),  # Текущий язык
            "reports_by_language": reports_by_language,  # ✅ ВСЕ три версии отчета
            "report_markdown_raw": report_markdown_raw,  # Для совместимости
            "chart_base64": chart_base64,
            "zip_base64": zip_base64,
            "symbol": symbol,
            "entry_price": safe_float(entry_price),
            "stop_loss": safe_float(stop_loss),
            "take_profit": safe_float(take_profit),
            "direction": direction,
            "enable_trailing": enable_trailing,
            "trailing_percent": trailing_percent,
            "psychological_levels": psychological_levels  # ✅ Добавляем психологические уровни
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# === API: Перевод markdown отчета ===
@app.route("/api/translate_report", methods=["POST"])
def translate_report():
    """Переводит markdown отчет с ключами {{key}} на указанный язык"""
    if not request.json:
        return jsonify({"error": "JSON required"}), 400
    
    markdown = request.json.get("markdown")
    language = request.json.get("language", "ru")
    
    if not markdown:
        return jsonify({"error": "markdown required"}), 400
    
    if language not in ["ru", "en", "uk"]:
        language = "ru"
    
    try:
        from trading_app import translate_markdown
        translated = translate_markdown(markdown, language)
        return jsonify({"translated": translated})
    except Exception as e:
        logger.error(f"⚠️ Ошибка перевода markdown: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# === API: Скачивание статистики ===
@app.route("/download_user_stats")
def download_user_stats():
    if not session.get("user_id"):
        language = request.args.get('language', 'ru')
        return jsonify({"error": get_translation("error_unauthorized_short", language)}), 401

    user_id = session["user_id"]
    reports = ReportV2.query.filter_by(user_id=user_id).all()
    if not reports:
        language = request.args.get('language', 'ru')
        return jsonify({"error": get_translation("error_no_data", language)}), 404

    csv_buf = io.StringIO()
    writer = csv.writer(csv_buf)
    writer.writerow([
        "symbol", "strategy", "type", "entry_price", "exit_price", "direction",
        "profit_loss", "profit_loss_percent", "success", "stop_loss", "take_profit", "date"
    ])
    for r in reports:
        writer.writerow([
            r.symbol, r.strategy, r.trading_type,
            r.entry_price, r.exit_price, r.direction,
            r.profit_loss, r.profit_loss_percent, r.success,
            r.stop_loss, r.take_profit,
            r.timestamp.strftime("%Y-%m-%d %H:%M")
        ])

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w") as z:
        z.writestr("stats.csv", csv_buf.getvalue())
    zip_buf.seek(0)
    return send_file(zip_buf, as_attachment=True, download_name="user_stats.zip", mimetype="application/zip")


# === Функции анализа ===
def analyze_strategies_performance(reports):
    """
    Анализирует производительность стратегий за период.
    Возвращает словарь с метриками по каждой стратегии.
    """
    if not reports:
        return {}
    
    strategy_stats = {}
    
    # Словарь для нормализации названий стратегий
    strategy_normalize = {
        "conservative": "Консервативная",
        "balanced": "Сбалансированная",
        "aggressive": "Агрессивная",
        "Консервативная": "Консервативная",
        "Сбалансированная": "Сбалансированная",
        "Агрессивная": "Агрессивная"
    }
    
    for report in reports:
        strategy_raw = report.strategy or "Не указана"
        # Нормализуем название стратегии
        strategy = strategy_normalize.get(strategy_raw, strategy_raw)
        
        if strategy not in strategy_stats:
            strategy_stats[strategy] = {
                "total_trades": 0,
                "successful_trades": 0,
                "failed_trades": 0,
                "total_profit": 0.0,
                "total_profit_percent": 0.0,
                "avg_profit_percent": 0.0,
                "max_profit": None,
                "max_loss": None,
                "win_rate": 0.0
            }
        
        stats = strategy_stats[strategy]
        stats["total_trades"] += 1
        
        # Определяем успешность на основе фактической прибыли, если доступна
        # Это более точный показатель, чем просто report.success
        if report.profit_loss_percent is not None:
            if report.profit_loss_percent > 0:
                stats["successful_trades"] += 1
            else:
                stats["failed_trades"] += 1
        elif report.success is not None:
            # Fallback: используем report.success, если profit_loss_percent недоступен
            if report.success:
                stats["successful_trades"] += 1
            else:
                stats["failed_trades"] += 1
        
        if report.profit_loss_percent is not None:
            stats["total_profit_percent"] += report.profit_loss_percent
            if stats["max_profit"] is None or report.profit_loss_percent > stats["max_profit"]:
                stats["max_profit"] = report.profit_loss_percent
            if stats["max_loss"] is None or report.profit_loss_percent < stats["max_loss"]:
                stats["max_loss"] = report.profit_loss_percent
        
        if report.profit_loss is not None:
            stats["total_profit"] += report.profit_loss
    
    # Вычисляем средние значения и Win Rate
    for strategy, stats in strategy_stats.items():
        if stats["total_trades"] > 0:
            stats["avg_profit_percent"] = stats["total_profit_percent"] / stats["total_trades"]
            if stats["successful_trades"] + stats["failed_trades"] > 0:
                stats["win_rate"] = (stats["successful_trades"] / (stats["successful_trades"] + stats["failed_trades"])) * 100
    
    return strategy_stats

def generate_auto_summary(reports, strategy_stats, language="ru"):
    """
    Генерирует автоматический текстовый отчёт (AI Summary) на основе данных.
    
    Параметры:
    - reports: список отчетов
    - strategy_stats: статистика по стратегиям
    - language: язык для перевода ("ru", "en", "uk")
    """
    # Словари переводов
    translations = {
        "ru": {
            "insufficient_data": "Недостаточно данных для анализа.",
            "general_stats": "📊 **Общая статистика:** Всего сделок: {total}, успешных: {successful} ({rate:.1f}%), неудачных: {failed}.",
            "main_trend": "📈 **Основная тенденция:** {trend} (средняя прибыль: {profit:+.2f}%).",
            "best_strategy": "🏆 **Лучшая стратегия:** {strategy} (средняя прибыль: {profit:+.2f}%, Win Rate: {winrate:.1f}%).",
            "most_used_symbol": "💎 **Наиболее используемый инструмент:** {symbol} ({count} сделок).",
            "most_profitable_type": "⏰ **Наиболее прибыльный тип торговли:** {type} (средняя прибыль: {profit:+.2f}%).",
            "trend_bullish": "Бычья",
            "trend_bearish": "Медвежья",
            "trend_neutral": "Нейтральная"
        },
        "en": {
            "insufficient_data": "Insufficient data for analysis.",
            "general_stats": "📊 **General Statistics:** Total trades: {total}, successful: {successful} ({rate:.1f}%), failed: {failed}.",
            "main_trend": "📈 **Main Trend:** {trend} (average profit: {profit:+.2f}%).",
            "best_strategy": "🏆 **Best Strategy:** {strategy} (average profit: {profit:+.2f}%, Win Rate: {winrate:.1f}%).",
            "most_used_symbol": "💎 **Most Used Instrument:** {symbol} ({count} trades).",
            "most_profitable_type": "⏰ **Most Profitable Trading Type:** {type} (average profit: {profit:+.2f}%).",
            "trend_bullish": "Bullish",
            "trend_bearish": "Bearish",
            "trend_neutral": "Neutral"
        },
        "uk": {
            "insufficient_data": "Недостатньо даних для аналізу.",
            "general_stats": "📊 **Загальна статистика:** Всього угод: {total}, успішних: {successful} ({rate:.1f}%), невдалих: {failed}.",
            "main_trend": "📈 **Основна тенденція:** {trend} (середній прибуток: {profit:+.2f}%).",
            "best_strategy": "🏆 **Найкраща стратегія:** {strategy} (середній прибуток: {profit:+.2f}%, Win Rate: {winrate:.1f}%).",
            "most_used_symbol": "💎 **Найбільш використовуваний інструмент:** {symbol} ({count} угод).",
            "most_profitable_type": "⏰ **Найприбутковіший тип торгівлі:** {type} (середній прибуток: {profit:+.2f}%).",
            "trend_bullish": "Бича",
            "trend_bearish": "Ведмежа",
            "trend_neutral": "Нейтральна"
        }
    }
    
    # Выбираем язык (по умолчанию русский)
    if language not in translations:
        language = "ru"
    t = translations[language]
    
    if not reports:
        return t["insufficient_data"]
    
    summary_parts = []
    
    # Общая статистика
    total_trades = len(reports)
    # Определяем успешность на основе фактической прибыли, если доступна
    successful = sum(1 for r in reports if (r.profit_loss_percent is not None and r.profit_loss_percent > 0) or (r.profit_loss_percent is None and r.success == True))
    failed = sum(1 for r in reports if (r.profit_loss_percent is not None and r.profit_loss_percent <= 0) or (r.profit_loss_percent is None and r.success == False))
    total_success_rate = (successful / (successful + failed) * 100) if (successful + failed) > 0 else 0
    
    # Определяем общую тенденцию
    avg_profit = np.mean([r.profit_loss_percent for r in reports if r.profit_loss_percent is not None]) if any(r.profit_loss_percent is not None for r in reports) else 0
    if avg_profit > 0:
        trend = t["trend_bullish"]
    elif avg_profit < 0:
        trend = t["trend_bearish"]
    else:
        trend = t["trend_neutral"]
    
    # Формируем текст общей статистики
    summary_parts.append(t["general_stats"].format(
        total=total_trades,
        successful=successful,
        rate=total_success_rate,
        failed=failed
    ))
    
    # Основная тенденция
    summary_parts.append(t["main_trend"].format(trend=trend, profit=avg_profit))
    
    # Лучшая стратегия
    best_strategy = None
    best_avg_profit = float('-inf')
    if strategy_stats:
        for strategy, stats in strategy_stats.items():
            if stats["avg_profit_percent"] > best_avg_profit:
                best_avg_profit = stats["avg_profit_percent"]
                best_strategy = strategy
    
    if best_strategy:
        # Переводим название стратегии
        strategy_translation = {
            "ru": {
                "conservative": "Консервативная",
                "balanced": "Сбалансированная", 
                "aggressive": "Агрессивная",
                "Консервативная": "Консервативная",
                "Сбалансированная": "Сбалансированная",
                "Агрессивная": "Агрессивная"
            },
            "en": {
                "conservative": "Conservative",
                "balanced": "Balanced",
                "aggressive": "Aggressive",
                "Консервативная": "Conservative",
                "Сбалансированная": "Balanced",
                "Агрессивная": "Aggressive"
            },
            "uk": {
                "conservative": "Консервативна",
                "balanced": "Збалансована",
                "aggressive": "Агресивна",
                "Консервативная": "Консервативна",
                "Сбалансированная": "Збалансована",
                "Агрессивная": "Агресивна"
            }
        }
        strategy_display = strategy_translation.get(language, strategy_translation["ru"]).get(best_strategy, best_strategy)
        summary_parts.append(t["best_strategy"].format(
            strategy=strategy_display,
            profit=best_avg_profit,
            winrate=strategy_stats[best_strategy]['win_rate']
        ))
    
    # Наиболее используемый инструмент
    symbols = [r.symbol for r in reports if r.symbol]
    symbol_counts = {}
    for s in symbols:
        symbol_counts[s] = symbol_counts.get(s, 0) + 1
    most_used_symbol = max(symbol_counts.items(), key=lambda x: x[1])[0] if symbol_counts else None
    
    if most_used_symbol:
        summary_parts.append(t["most_used_symbol"].format(
            symbol=most_used_symbol,
            count=symbol_counts[most_used_symbol]
        ))
    
    # Анализ по типам торговли
    trading_types = {}
    trading_type_translation = {
        "ru": {
            "scalping": "Скальпинг",
            "daytrading": "Дейтрейдинг",
            "swing": "Свинг",
            "medium_term": "Среднесрочная",
            "long_term": "Долгосрочная",
            "Скальпинг": "Скальпинг",
            "Дейтрейдинг": "Дейтрейдинг",
            "Свинг": "Свинг",
            "Среднесрочная": "Среднесрочная",
            "Долгосрочная": "Долгосрочная"
        },
        "en": {
            "scalping": "Scalping",
            "daytrading": "Day Trading",
            "swing": "Swing",
            "medium_term": "Medium-term",
            "long_term": "Long-term",
            "Скальпинг": "Scalping",
            "Дейтрейдинг": "Day Trading",
            "Свинг": "Swing",
            "Среднесрочная": "Medium-term",
            "Долгосрочная": "Long-term"
        },
        "uk": {
            "scalping": "Скальпінг",
            "daytrading": "Дейтрейдинг",
            "swing": "Свінг",
            "medium_term": "Середньострокова",
            "long_term": "Довгострокова",
            "Скальпинг": "Скальпінг",
            "Дейтрейдинг": "Дейтрейдинг",
            "Свинг": "Свінг",
            "Среднесрочная": "Середньострокова",
            "Долгосрочная": "Довгострокова"
        }
    }
    
    for r in reports:
        tt = r.trading_type or "Не указан"
        if tt not in trading_types:
            trading_types[tt] = {"count": 0, "profit": []}
        trading_types[tt]["count"] += 1
        if r.profit_loss_percent is not None:
            trading_types[tt]["profit"].append(r.profit_loss_percent)
    
    if trading_types:
        best_type = max(trading_types.items(), key=lambda x: np.mean(x[1]["profit"]) if x[1]["profit"] else -999)
        if best_type[1]["profit"]:
            avg_type_profit = np.mean(best_type[1]["profit"])
            type_display = trading_type_translation.get(language, trading_type_translation["ru"]).get(best_type[0], best_type[0])
            summary_parts.append(t["most_profitable_type"].format(
                type=type_display,
                profit=avg_type_profit
            ))
    
    return " ".join(summary_parts)

# === Функции отправки уведомлений ===
def get_telegram_chat_id_from_username(username, bot_token=None):
    """
    Пытается получить Chat ID пользователя по username через getUpdates API.
    
    Параметры:
    - username: Telegram username (с @ или без)
    - bot_token: токен бота
    
    Возвращает: Chat ID (int) или None если не найден
    """
    try:
        token = bot_token or TELEGRAM_BOT_TOKEN
        if not token:
            return None
        
        # Очищаем username
        clean_username = username.strip().lstrip('@').lower()
        
        # ✅ УЛУЧШЕНО: Получаем все доступные обновления, начиная с offset=0
        # Это позволяет получить больше обновлений, чем стандартные последние 100
        url = f"https://api.telegram.org/bot{token}/getUpdates"
        all_updates = []
        offset = 0
        
        # Делаем несколько запросов для получения всех доступных обновлений
        for attempt in range(5):  # Максимум 5 попыток (до 500 обновлений)
            params = {"offset": offset, "limit": 100, "timeout": 10}
            try:
                response = requests.get(url, params=params, timeout=15)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("ok"):
                        updates = data.get("result", [])
                        if not updates:
                            break
                        
                        all_updates.extend(updates)
                        # Обновляем offset для следующего запроса
                        max_update_id = max((update.get("update_id", 0) for update in updates), default=0)
                        offset = max_update_id + 1
                    else:
                        break
                else:
                    logger.warning(f"⚠️ Ошибка получения обновлений (попытка {attempt + 1}): {response.status_code}")
                    break
            except Exception as e:
                logger.warning(f"⚠️ Ошибка при получении обновлений (попытка {attempt + 1}): {e}")
                break
        
        # Ищем пользователя во всех полученных обновлениях
        if all_updates:
            logger.info(f"📋 Получено {len(all_updates)} обновлений для поиска Chat ID")
            for update in all_updates:
                message = update.get("message") or update.get("edited_message") or update.get("callback_query", {}).get("message")
                if message:
                    from_user = message.get("from", {})
                    chat = message.get("chat", {})
                    
                    # Проверяем username
                    user_username = from_user.get("username", "").lower()
                    if user_username == clean_username:
                        chat_id = chat.get("id")
                        if chat_id:
                            logger.info(f"✅ Найден Chat ID для @{clean_username}: {chat_id}")
                            return str(chat_id)  # Возвращаем как строку для совместимости
        else:
            logger.warning(f"⚠️ Не получено обновлений от бота")
        
        logger.warning(f"⚠️ Пользователь @{clean_username} не найден в обновлениях бота")
        logger.warning(f"   Убедитесь, что пользователь отправил хотя бы одно сообщение боту")
        
        return None
    except Exception as e:
        logger.error(f"⚠️ Ошибка при получении Chat ID: {e}")
        return None

def send_telegram_notification(username_or_chat_id, message, bot_token=None):
    """
    Отправляет уведомление в Telegram.
    
    Параметры:
    - username_or_chat_id: Telegram username (с @ или без) или Chat ID (число)
    - message: текст сообщения
    - bot_token: токен бота (если не указан, используется глобальный)
    
    Возвращает: True если успешно, False если ошибка
    
    Примечание: Для работы с username пользователь должен сначала начать диалог с ботом (отправить /start)
    """
    try:
        token = bot_token or TELEGRAM_BOT_TOKEN
        if not token:
            logger.warning(f"⚠️ TELEGRAM_BOT_TOKEN не настроен.")
            logger.warning(f"   Решение: Откройте файл config_notifications.py и заполните TELEGRAM_BOT_TOKEN")
            logger.warning(f"   Или установите переменную окружения: export TELEGRAM_BOT_TOKEN='ваш_токен'")
            return False
        
        if not username_or_chat_id or not username_or_chat_id.strip():
            logger.warning(f"⚠️ Telegram username или Chat ID не указан. Пользователь должен указать свой username или Chat ID в настройках.")
            return False
        
        # Очищаем от пробелов
        identifier = str(username_or_chat_id).strip()
        
        # Определяем, это username или Chat ID
        is_username = False
        if identifier.startswith('@'):
            # Это username с @
            chat_identifier = identifier  # Оставляем @ для username
            is_username = True
        elif identifier.isdigit():
            # Это Chat ID (число)
            if len(identifier) < 5:
                logger.warning(f"⚠️ Chat ID слишком короткий: '{identifier}'")
                logger.warning(f"   Chat ID обычно содержит 9-10 цифр")
                return False
            chat_identifier = identifier
            is_username = False
        else:
            # Это username без @ - добавляем @
            chat_identifier = f"@{identifier}"
            is_username = True
        
        logger.info(f"📱 Отправка Telegram сообщения на {chat_identifier} (тип: {'username' if is_username else 'Chat ID'})")
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        response = requests.post(url, json={
            "chat_id": chat_identifier,
            "text": message,
            "parse_mode": "HTML"
        }, timeout=10)
        
        if response.status_code == 200:
            logger.info(f"✅ Telegram уведомление успешно отправлено на {chat_identifier}")
            return True
        
        # ✅ ИСПРАВЛЕНИЕ: Если username не сработал, пытаемся получить Chat ID
        if is_username and response.status_code == 400:
            error_data = response.json() if response.text else {}
            error_desc = error_data.get("description", "")
            
            if "chat not found" in error_desc.lower() or "user not found" in error_desc.lower():
                logger.warning(f"⚠️ Не удалось отправить на username {chat_identifier}, пытаемся получить Chat ID...")
                chat_id = get_telegram_chat_id_from_username(identifier, token)
                
                if chat_id:
                    logger.info(f"✅ Найден Chat ID: {chat_id}, повторная попытка отправки...")
                    # Пытаемся отправить на Chat ID
                    response = requests.post(url, json={
                        "chat_id": chat_id,
                        "text": message,
                        "parse_mode": "HTML"
                    }, timeout=10)
                    
                    if response.status_code == 200:
                        logger.info(f"✅ Telegram уведомление успешно отправлено на Chat ID {chat_id}")
                        # ✅ НОВОЕ: Сохраняем Chat ID в базу данных для будущих использований
                        try:
                            # Ищем пользователя по старому значению (username)
                            user = User.query.filter_by(telegram_chat_id=username_or_chat_id).first()
                            if user:
                                user.telegram_chat_id = str(chat_id)
                                db.session.commit()
                                logger.info(f"💾 Chat ID {chat_id} сохранен в базу данных для пользователя (ID: {user.id})")
                            else:
                                logger.warning(f"⚠️ Пользователь с telegram_chat_id={username_or_chat_id} не найден в БД")
                        except Exception as e:
                            logger.warning(f"⚠️ Не удалось сохранить Chat ID в БД: {e}")
                            import traceback
                            logger.warning(traceback.format_exc())
                        return True
                    else:
                        error_data = response.json() if response.text else {}
                        error_desc = error_data.get("description", "Неизвестная ошибка")
                        logger.error(f"⚠️ Ошибка отправки на Chat ID {chat_id}: {response.status_code} - {error_desc}")
                else:
                    logger.error(f"❌ Не удалось получить Chat ID для {chat_identifier}")
                    logger.error(f"   Решение:")
                    logger.error(f"   1. Попросите пользователя отправить любое сообщение боту (например: /start)")
                    logger.error(f"   2. Или используйте Chat ID вместо username в настройках")
                    logger.error(f"      Чтобы получить Chat ID, пользователь может:")
                    logger.error(f"      - Написать боту @userinfobot и отправить /start")
                    logger.error(f"      - Или использовать бота @getidsbot")
        
        # Логируем ошибку
        error_data = response.json() if response.text else {}
        error_desc = error_data.get("description", "Неизвестная ошибка")
        error_code = error_data.get("error_code", 0)
        logger.error(f"⚠️ Ошибка отправки Telegram уведомления: {response.status_code} - {error_desc}")
        
        if response.status_code == 401:
            logger.error(f"   Возможная причина: Неверный TELEGRAM_BOT_TOKEN. Проверьте токен в config_notifications.py")
        elif response.status_code == 400:
            if "chat not found" in error_desc.lower() or "user not found" in error_desc.lower():
                if is_username:
                    logger.error(f"   ⚠️ Пользователь с username ({chat_identifier}) не найден.")
                    logger.error(f"   Решение: Пользователь должен отправить хотя бы одно сообщение боту")
                else:
                    logger.error(f"   ⚠️ Пользователь с Chat ID ({chat_identifier}) не найден.")
                    logger.error(f"   Решение: Проверьте правильность Chat ID")
            else:
                identifier_type = "username" if is_username else "Chat ID"
                logger.error(f"   Возможная причина: Неверный {identifier_type} ({chat_identifier}). Убедитесь, что пользователь указал правильный {identifier_type}")
        elif response.status_code == 403:
            logger.error(f"   Возможная причина: Пользователь заблокировал бота или бот не может отправлять сообщения")
            logger.error(f"   → Решение: Пользователь должен разблокировать бота и отправить ему /start")
        
        return False
    except requests.exceptions.Timeout:
        logger.error(f"⚠️ Таймаут при отправке Telegram уведомления. Проверьте интернет-соединение.")
        return False
    except Exception as e:
        logger.error(f"⚠️ Ошибка отправки Telegram уведомления: {e}")
        import traceback
        logger.error(f"   Детали ошибки: {traceback.format_exc()}")
        return False

def send_email_notification(email, subject, message):
    """
    Отправляет уведомление на Email через Resend API.
    
    Параметры:
    - email: адрес получателя (email пользователя из БД)
    - subject: тема письма
    - message: текст сообщения
    
    Возвращает: True если успешно, False если ошибка
    """
    try:
        # Проверяем наличие Resend настроек
        if not RESEND_API_KEY or not RESEND_FROM_EMAIL or not email:
            print(f"⚠️ Resend настройки неполные:")
            print(f"   RESEND_API_KEY: {'✅ установлен' if RESEND_API_KEY else '❌ не установлен'}")
            print(f"   RESEND_FROM_EMAIL: {'✅ установлен' if RESEND_FROM_EMAIL else '❌ не установлен'}")
            print(f"   email получателя: {email if email else '❌ не указан'}")
            print(f"   Решение: Откройте файл config_notifications.py и заполните RESEND_API_KEY и RESEND_FROM_EMAIL")
            return False
        
        # Отправляем через Resend API
        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json"
        }
        
        # Определяем from email - если это gmail.com, используем верифицированный домен
        from_email = RESEND_FROM_EMAIL
        reply_to_email = None
        
        # Извлекаем email адрес из RESEND_FROM_EMAIL (может быть в формате "Name <email>")
        email_address = RESEND_FROM_EMAIL
        if "<" in RESEND_FROM_EMAIL and ">" in RESEND_FROM_EMAIL:
            # Формат "Name <email@domain.com>"
            email_address = RESEND_FROM_EMAIL.split("<")[1].split(">")[0].strip()
        
        if "@gmail.com" in email_address.lower():
            # Если указан gmail.com, используем верифицированный домен в from
            # Сохраняем имя отправителя, если оно было указано
            sender_name = "Crypto Analyzer"
            if "<" in RESEND_FROM_EMAIL and ">" in RESEND_FROM_EMAIL:
                sender_name = RESEND_FROM_EMAIL.split("<")[0].strip().strip('"').strip("'")
            
            from_email = f"{sender_name} <noreply@cryptoanalyz.net>"
            reply_to_email = [email_address]  # gmail.com в reply_to
        
        payload = {
            "from": from_email,
            "to": [email],
            "subject": subject,
            "html": message
        }
        
        # Добавляем reply_to только если нужно
        if reply_to_email:
            payload["reply_to"] = reply_to_email
        
        print(f"📧 Отправка email через Resend API на {email} (from: {from_email})")
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Email успешно отправлен через Resend на {email} (ID: {result.get('id', 'N/A')})")
            return True
        else:
            error_data = response.json() if response.text else {}
            error_msg = error_data.get("message", f"HTTP {response.status_code}")
            print(f"⚠️ Ошибка отправки email через Resend: {error_msg}")
            print(f"   Ответ сервера: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print(f"⚠️ Таймаут при отправке email через Resend. Проверьте интернет-соединение.")
        return False
    except requests.exceptions.RequestException as e:
        print(f"⚠️ Ошибка подключения к Resend API: {e}")
        return False
    except Exception as e:
        print(f"⚠️ Ошибка отправки Email уведомления: {e}")
        print(f"   Проверьте: 1) RESEND_API_KEY в config_notifications.py, 2) RESEND_FROM_EMAIL верифицирован в Resend, 3) Интернет-соединение")
        traceback.print_exc()
        return False

def format_alert_message(symbol, direction, entry_price, stop_loss, take_profit, reliability_rating, strategy, trend, language="ru"):
    """
    Форматирует сообщение для уведомления с учетом языка.
    """
    # Получаем переводы
    t = lambda key, **params: get_translation(key, language, **params)
    direction_emoji = "🟢" if direction == "long" else "🔴"
    direction_text = t("long_direction") if direction == "long" else t("short_direction")
    trend_text = t("bull_market") if trend == "Uptrend" else t("bear_market")
    rr = ((take_profit - entry_price) / (entry_price - stop_loss) if direction == "long" else (entry_price - take_profit) / (stop_loss - entry_price))
    
    message = f"""
🚨 <b>{t('notification_new_signal')}</b>

📊 <b>{t('notification_instrument')}</b> {symbol}
{direction_emoji} <b>{t('notification_direction')}</b> {direction_text}
📈 <b>{t('notification_trend')}</b> {trend_text}
🎯 <b>{t('notification_strategy')}</b> {strategy}

💰 <b>{t('notification_levels')}</b>
• {t('notification_entry')} ${entry_price:.2f}
• {t('notification_stop_loss')} ${stop_loss:.2f}
• {t('notification_take_profit')} ${take_profit:.2f}
• {t('notification_rr')} {rr:.2f}

⭐ <b>{t('notification_reliability')}</b> {reliability_rating:.1f}%

⏰ <b>{t('notification_time')}</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
    return message.strip()

def generate_heatmap_data(reports):
    """
    Генерирует данные для heatmap: прибыльность по символам и времени.
    
    Возвращает:
    - heatmap_data: словарь с данными для визуализации
    - heatmap_image_base64: base64 изображения heatmap (если возможно)
    """
    if not reports:
        return None, None
    
    try:
        # Подготовка данных
        data = []
        for report in reports:
            if not report.symbol or report.profit_loss_percent is None:
                continue
            
            timestamp = report.timestamp
            symbol = report.symbol
            profit_pct = report.profit_loss_percent
            
            # Извлекаем час дня и день недели
            hour = timestamp.hour
            day_of_week = timestamp.weekday()  # 0 = понедельник, 6 = воскресенье
            
            data.append({
                "symbol": symbol,
                "hour": hour,
                "day_of_week": day_of_week,
                "profit_pct": profit_pct,
                "timestamp": timestamp
            })
        
        if not data:
            return None, None
        
        # Создаём DataFrame
        try:
            import pandas as pd
        except ImportError:
            print("⚠️ pandas не установлен, heatmap недоступен")
            return None, None
        
        df = pd.DataFrame(data)
        
        # Группируем по символам и часам
        heatmap_by_hour = df.groupby(["symbol", "hour"])["profit_pct"].mean().reset_index()
        pivot_hour = heatmap_by_hour.pivot(index="symbol", columns="hour", values="profit_pct")
        
        # Группируем по символам и дням недели
        heatmap_by_day = df.groupby(["symbol", "day_of_week"])["profit_pct"].mean().reset_index()
        pivot_day = heatmap_by_day.pivot(index="symbol", columns="day_of_week", values="profit_pct")
        
        # Проверяем, что есть данные
        if pivot_hour.empty or pivot_day.empty:
            return None, None
        
        # Генерируем изображение heatmap
        heatmap_image_base64 = None
        try:
            fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 8))
            
            # Heatmap по часам
            if HAS_SEABORN:
                sns.heatmap(pivot_hour, annot=True, fmt=".1f", cmap="RdYlGn", center=0, 
                           ax=ax1, cbar_kws={"label": "Прибыль (%)"})
            else:
                im1 = ax1.imshow(pivot_hour.values, cmap="RdYlGn", aspect="auto", vmin=-10, vmax=10)
                ax1.set_xticks(range(len(pivot_hour.columns)))
                ax1.set_xticklabels(pivot_hour.columns)
                ax1.set_yticks(range(len(pivot_hour.index)))
                ax1.set_yticklabels(pivot_hour.index)
                plt.colorbar(im1, ax=ax1, label="Прибыль (%)")
                # Добавляем аннотации
                for i in range(len(pivot_hour.index)):
                    for j in range(len(pivot_hour.columns)):
                        val = pivot_hour.iloc[i, j]
                        if not pd.isna(val):
                            ax1.text(j, i, f"{val:.1f}", ha="center", va="center", color="black" if abs(val) < 5 else "white")
            
            ax1.set_title("Прибыльность по часам дня", fontsize=14, fontweight="bold")
            ax1.set_xlabel("Час дня (UTC)", fontsize=12)
            ax1.set_ylabel("Инструмент", fontsize=12)
            
            # Heatmap по дням недели
            day_names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
            if HAS_SEABORN:
                sns.heatmap(pivot_day, annot=True, fmt=".1f", cmap="RdYlGn", center=0,
                           ax=ax2, cbar_kws={"label": "Прибыль (%)"}, 
                           xticklabels=[day_names[i] for i in pivot_day.columns])
            else:
                im2 = ax2.imshow(pivot_day.values, cmap="RdYlGn", aspect="auto", vmin=-10, vmax=10)
                ax2.set_xticks(range(len(pivot_day.columns)))
                ax2.set_xticklabels([day_names[i] for i in pivot_day.columns])
                ax2.set_yticks(range(len(pivot_day.index)))
                ax2.set_yticklabels(pivot_day.index)
                plt.colorbar(im2, ax=ax2, label="Прибыль (%)")
                # Добавляем аннотации
                for i in range(len(pivot_day.index)):
                    for j in range(len(pivot_day.columns)):
                        val = pivot_day.iloc[i, j]
                        if not pd.isna(val):
                            ax2.text(j, i, f"{val:.1f}", ha="center", va="center", color="black" if abs(val) < 5 else "white")
            
            ax2.set_title("Прибыльность по дням недели", fontsize=14, fontweight="bold")
            ax2.set_xlabel("День недели", fontsize=12)
            ax2.set_ylabel("Инструмент", fontsize=12)
            
            plt.tight_layout()
            
            # Сохраняем в base64
            buf = io.BytesIO()
            plt.savefig(buf, format="png", bbox_inches="tight", dpi=100)
            buf.seek(0)
            heatmap_image_base64 = base64.b64encode(buf.getvalue()).decode()
            plt.close(fig)
        except Exception as e:
            print(f"⚠️ Ошибка при создании heatmap изображения: {e}")
            traceback.print_exc()
        
        # Подготавливаем данные для JSON
        heatmap_data = {
            "by_hour": {
                "symbols": list(pivot_hour.index),
                "hours": [int(h) for h in pivot_hour.columns],
                "data": pivot_hour.fillna(0).to_dict("index")
            },
            "by_day": {
                "symbols": list(pivot_day.index),
                "days": [int(d) for d in pivot_day.columns],
                "day_names": [day_names[int(d)] for d in pivot_day.columns],
                "data": pivot_day.fillna(0).to_dict("index")
            }
        }
        
        return heatmap_data, heatmap_image_base64
    
    except Exception as e:
        print(f"⚠️ Ошибка в generate_heatmap_data: {e}")
        traceback.print_exc()
        return None, None

def calculate_benchmark_comparison(reports):
    """
    Сравнивает доходность стратегии с "купить и держать" (Buy & Hold).
    
    Возвращает:
    - strategy_return: общая доходность стратегии (%)
    - buy_hold_return: доходность Buy & Hold (%)
    - difference: разница в процентах
    - better: какой подход лучше ("strategy" или "buy_hold")
    - equity_curve_strategy: кривая капитала стратегии
    - equity_curve_buyhold: кривая капитала Buy & Hold
    """
    if not reports:
        return None
    
    try:
        # Группируем сделки по символам и находим общий период
        symbol_periods = {}
        strategy_total_return = 0.0
        initial_capital = 10000  # Базовый капитал для расчёта
        
        # Собираем все сделки по символам и периодам
        for report in reports:
            if not report.symbol or not report.entry_price or not report.exit_price:
                continue
            
            symbol = report.symbol
            if symbol not in symbol_periods:
                symbol_periods[symbol] = {
                    "start_date": report.timestamp,
                    "end_date": report.timestamp,
                    "trades": []
                }
            
            period = symbol_periods[symbol]
            if report.timestamp < period["start_date"]:
                period["start_date"] = report.timestamp
            if report.timestamp > period["end_date"]:
                period["end_date"] = report.timestamp
            
            # Добавляем сделку
            if report.profit_loss_percent is not None:
                period["trades"].append({
                    "date": report.timestamp,
                    "profit_pct": report.profit_loss_percent,
                    "entry": report.entry_price,
                    "exit": report.exit_price
                })
                strategy_total_return += report.profit_loss_percent
        
        if not symbol_periods:
            return None
        
        # Рассчитываем Buy & Hold для каждого символа
        buy_hold_returns = []
        equity_curve_strategy = [initial_capital]
        equity_curve_buyhold = [initial_capital]
        current_capital_strategy = initial_capital
        current_capital_buyhold = initial_capital
        
        for symbol, period_data in symbol_periods.items():
            try:
                # Получаем исторические данные за период
                start_date = period_data["start_date"]
                end_date = period_data["end_date"]
                
                # Вычисляем количество дней
                days_diff = (end_date - start_date).days
                if days_diff < 1:
                    days_diff = 30  # Минимум 30 дней
                
                # Загружаем данные
                df = fetch_ohlcv(symbol, "1d", history_days=min(days_diff + 10, 365))
                
                if df.empty or len(df) < 2:
                    continue
                
                # Находим первую и последнюю цену в периоде
                df_sorted = df.sort_index()
                buy_price = df_sorted.iloc[0]["Close"]
                sell_price = df_sorted.iloc[-1]["Close"]
                
                # Расчёт Buy & Hold
                buy_hold_pct = ((sell_price - buy_price) / buy_price) * 100
                buy_hold_returns.append(buy_hold_pct)
                
                # Обновляем кривые капитала
                # Для стратегии: добавляем прибыль от сделок
                for trade in period_data["trades"]:
                    current_capital_strategy += (current_capital_strategy * trade["profit_pct"] / 100)
                    equity_curve_strategy.append(current_capital_strategy)
                
                # Для Buy & Hold: применяем общую доходность
                current_capital_buyhold *= (1 + buy_hold_pct / 100)
                equity_curve_buyhold.append(current_capital_buyhold)
                
            except Exception as e:
                print(f"⚠️ Ошибка при расчёте Benchmark для {symbol}: {e}")
                continue
        
        if not buy_hold_returns:
            return None
        
        # Средняя доходность Buy & Hold
        buy_hold_return = np.mean(buy_hold_returns) if buy_hold_returns else 0
        
        # Общая доходность стратегии (средняя на сделку)
        total_trades = sum(len(p["trades"]) for p in symbol_periods.values())
        strategy_return = strategy_total_return / total_trades if total_trades > 0 else 0
        
        # Альтернативный расчёт: общая доходность капитала
        strategy_total_capital_return = ((current_capital_strategy - initial_capital) / initial_capital) * 100
        buy_hold_total_capital_return = ((current_capital_buyhold - initial_capital) / initial_capital) * 100
        
        # Разница (используем среднюю доходность на сделку для сравнения)
        difference = strategy_return - buy_hold_return
        better = "strategy" if difference > 0 else "buy_hold"
        
        return {
            "strategy_return": strategy_return,
            "buy_hold_return": buy_hold_return,
            "strategy_total_return": strategy_total_capital_return,
            "buy_hold_total_return": buy_hold_total_capital_return,
            "difference": difference,
            "better": better,
            "total_trades": total_trades,
            "equity_curve_strategy": equity_curve_strategy[-10:],  # Последние 10 точек для графика
            "equity_curve_buyhold": equity_curve_buyhold[-10:]
        }
    
    except Exception as e:
        print(f"⚠️ Ошибка в calculate_benchmark_comparison: {e}")
        traceback.print_exc()
        return None

# === API: Сохранение настроек уведомлений ===
@app.route("/api/save_notification_settings", methods=["POST"])
def save_notification_settings():
    """Сохраняет настройки уведомлений пользователя."""
    if not session.get("user_id"):
        language = request.args.get('language') or (request.json.get('language') if request.json else None) or 'ru'
        return jsonify({"error": get_translation("error_unauthorized", language)}), 401
    
    user_id = session["user_id"]
    data = request.json or {}
    
    try:
        user = User.query.get(user_id)
        if not user:
            language = request.args.get('language') or (request.json.get('language') if request.json else None) or 'ru'
            return jsonify({"error": get_translation("error_user_not_found", language)}), 404
        
        # Обновляем настройки
        if "enable_email" in data:
            user.enable_email_notifications = bool(data.get("enable_email", False))
        if "enable_telegram" in data:
            user.enable_telegram_notifications = bool(data.get("enable_telegram", False))
        if "telegram_chat_id" in data:
            user.telegram_chat_id = data.get("telegram_chat_id", "").strip()
        if "alert_min_reliability" in data:
            user.alert_min_reliability = float(data.get("alert_min_reliability", 60))
        
        db.session.commit()
        language = data.get('language', 'ru')
        return jsonify({"success": True, "message": get_translation("error_settings_saved", language)})
    except Exception as e:
        db.session.rollback()
        print(f"⚠️ Ошибка сохранения настроек: {e}")
        return jsonify({"error": str(e)}), 500

# === API: Загрузка настроек уведомлений ===
@app.route("/api/get_notification_settings")
def get_notification_settings():
    """Возвращает настройки уведомлений пользователя."""
    if not session.get("user_id"):
        language = request.args.get('language') or (request.json.get('language') if request.json else None) or 'ru'
        return jsonify({"error": get_translation("error_unauthorized", language)}), 401
    
    user_id = session["user_id"]
    try:
        user = User.query.get(user_id)
        if not user:
            language = request.args.get('language') or (request.json.get('language') if request.json else None) or 'ru'
            return jsonify({"error": get_translation("error_user_not_found", language)}), 404
        
        return jsonify({
            "enable_email": user.enable_email_notifications or False,
            "enable_telegram": user.enable_telegram_notifications or False,
            "telegram_chat_id": user.telegram_chat_id or "",
            "alert_min_reliability": user.alert_min_reliability or 60.0,
            "exchange_spread": getattr(user, 'exchange_spread', 0.0) or 0.0
        })
    except Exception as e:
        print(f"⚠️ Ошибка загрузки настроек: {e}")
        return jsonify({"error": str(e)}), 500

# === API: Сохранение настроек торговли ===
@app.route("/api/save_trading_settings", methods=["POST"])
def save_trading_settings():
    """Сохраняет настройки торговли пользователя (спред биржи и т.д.)."""
    if not session.get("user_id"):
        language = request.args.get('language') or (request.json.get('language') if request.json else None) or 'ru'
        return jsonify({"error": get_translation("error_unauthorized", language)}), 401
    
    user_id = session["user_id"]
    data = request.json or {}
    
    try:
        user = User.query.get(user_id)
        if not user:
            language = request.args.get('language') or (request.json.get('language') if request.json else None) or 'ru'
            return jsonify({"error": get_translation("error_user_not_found", language)}), 404
        
        # Обновляем настройки торговли
        if "exchange_spread" in data:
            spread = float(data.get("exchange_spread", 0))
            if spread < 0 or spread > 1:
                language = data.get('language', 'ru')
                return jsonify({"error": get_translation("error_spread_range", language)}), 400
            user.exchange_spread = spread
        
        db.session.commit()
        language = data.get('language', 'ru')
        return jsonify({"success": True, "message": get_translation("error_trading_settings_saved", language)})
    except Exception as e:
        db.session.rollback()
        print(f"⚠️ Ошибка сохранения настроек торговли: {e}")
        return jsonify({"error": str(e)}), 500

# === API: Загрузка настроек торговли ===
@app.route("/api/get_trading_settings")
def get_trading_settings():
    """Возвращает настройки торговли пользователя."""
    if not session.get("user_id"):
        language = request.args.get('language') or (request.json.get('language') if request.json else None) or 'ru'
        return jsonify({"error": get_translation("error_unauthorized", language)}), 401
    
    user_id = session["user_id"]
    try:
        user = User.query.get(user_id)
        if not user:
            language = request.args.get('language') or (request.json.get('language') if request.json else None) or 'ru'
            return jsonify({"error": get_translation("error_user_not_found", language)}), 404
        
        return jsonify({
            "exchange_spread": getattr(user, 'exchange_spread', 0.0) or 0.0
        })
    except Exception as e:
        print(f"⚠️ Ошибка загрузки настроек торговли: {e}")
        return jsonify({"error": str(e)}), 500

# === API: Отправка сообщения о проблеме ===
@app.route("/api/send_problem_message", methods=["POST"])
def send_problem_message():
    """Отправляет сообщение о проблеме на email администратора."""
    if not session.get("user_id"):
        language = request.args.get('language') or (request.json.get('language') if request.json else None) or 'ru'
        return jsonify({"error": get_translation("error_unauthorized", language)}), 401
    
    user_id = session["user_id"]
    data = request.json or {}
    message = data.get("message", "").strip()
    
    if not message:
        language = data.get('language', 'ru')
        return jsonify({"error": get_translation("error_message_empty", language)}), 400
    
    try:
        user = User.query.get(user_id)
        if not user:
            language = request.args.get('language') or (request.json.get('language') if request.json else None) or 'ru'
            return jsonify({"error": get_translation("error_user_not_found", language)}), 404
        
        # Формируем письмо
        subject = f"Сообщение о проблеме от пользователя {user.email}"
        email_body = f"""Пользователь: {user.email}
Email пользователя: {user.email}

Сообщение:
{message}
"""
        
        # Отправляем на tirion2025@gmail.com
        admin_email = "tirion2025@gmail.com"
        if send_email_notification(admin_email, subject, email_body):
            print(f"✅ Сообщение о проблеме отправлено на {admin_email} от {user.email}")
            language = data.get('language', 'ru')
            return jsonify({"success": True, "message": get_translation("error_message_sent", language)})
        else:
            language = data.get('language', 'ru')
            return jsonify({"error": get_translation("error_message_failed", language)}), 500
    except Exception as e:
        print(f"⚠️ Ошибка отправки сообщения о проблеме: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# === API: Анализ стратегий и Auto Summary ===
@app.route("/api/strategy_analysis")
def strategy_analysis():
    """Возвращает анализ стратегий и Auto Summary для текущего пользователя."""
    if not session.get("user_id"):
        language = request.args.get('language', 'ru')
        return jsonify({"error": get_translation("error_unauthorized_short", language)}), 401
    
    user_id = session["user_id"]
    reports = ReportV2.query.filter_by(user_id=user_id).order_by(ReportV2.timestamp.desc()).all()
    
    if not reports:
        return jsonify({
            "error": "Нет данных",
            "strategy_stats": {},
            "auto_summary": "Недостаточно данных для анализа. Создайте несколько отчётов для получения статистики."
        })
    
    # Анализ стратегий
    strategy_stats = analyze_strategies_performance(reports)
    
    # Получаем язык из запроса (по умолчанию русский)
    language = request.args.get("language", "ru")
    if language not in ["ru", "en", "uk"]:
        language = "ru"
    
    # Auto Summary
    auto_summary = generate_auto_summary(reports, strategy_stats, language=language)
    
    # Benchmark сравнение
    benchmark_data = calculate_benchmark_comparison(reports)
    
    # Heatmap данных
    heatmap_data, heatmap_image_base64 = generate_heatmap_data(reports)
    
    return jsonify({
        "strategy_stats": strategy_stats,
        "auto_summary": auto_summary,
        "total_reports": len(reports),
        "benchmark": benchmark_data,
        "heatmap": heatmap_data,
        "heatmap_image": heatmap_image_base64
    })

# === ZIP: PDF диаграммы + Excel таблица ===
@app.route("/download_user_stats_bundle")
def download_user_stats_bundle():
    if not session.get("user_id"):
        language = request.args.get('language', 'ru')
        return jsonify({"error": get_translation("error_unauthorized_short", language)}), 401

    user_id = session["user_id"]
    reports = ReportV2.query.filter_by(user_id=user_id).all()
    if not reports:
        language = request.args.get('language', 'ru')
        return jsonify({"error": get_translation("error_no_data", language)}), 404

    # Подготовка данных
    # Используем ту же логику определения успешности, что и в analyze_strategies_performance
    # Приоритет: profit_loss_percent > 0, затем report.success
    symbols = [r.symbol or "N/A" for r in reports]
    successes = []
    for r in reports:
        if r.profit_loss_percent is not None:
            # Используем фактическую прибыль как основной критерий
            successes.append(1 if r.profit_loss_percent > 0 else 0)
        elif r.success is not None:
            # Fallback: используем report.success, если profit_loss_percent недоступен
            successes.append(1 if r.success else 0)
        else:
            successes.append(None)
    
    success_count = sum(1 for s in successes if s == 1)
    fail_count = sum(1 for s in successes if s == 0)

    symbol_counts = {}
    for s in symbols:
        symbol_counts[s] = symbol_counts.get(s, 0) + 1

    # 1) PDF с диаграммами
    buf_pdf = io.BytesIO()
    with PdfPages(buf_pdf) as pdf:
        # Страница 1: Заголовок и круговые диаграммы
        fig, axs = plt.subplots(1, 2, figsize=(11.69, 8.27))  # A4 landscape
        # Пирог 1: успех/неуспех
        axs[0].pie([success_count, fail_count], labels=["Успешные", "Неуспешные"],
                   autopct="%1.1f%%", colors=["#34D399", "#EF4444"], startangle=140)
        axs[0].set_title("Распределение сделок по результату")
        # Пирог 2: по символам
        labels = list(symbol_counts.keys())
        sizes = [symbol_counts[k] for k in labels]
        axs[1].pie(sizes, labels=labels, autopct="%1.1f%%", startangle=140)
        axs[1].set_title("Распределение сделок по инструментам")
        pdf.savefig(fig, bbox_inches="tight")
        plt.close(fig)

    buf_pdf.seek(0)

    # 2) Excel с таблицей всех сделок
    import pandas as pd  # локальный импорт, чтобы не ломать окружение
    cols = ["symbol","strategy","type","entry_price","exit_price","direction","profit_loss","profit_loss_percent","success","stop_loss","take_profit","date"]
    rows = []
    for r in reports:
        rows.append([
            r.symbol, r.strategy, r.trading_type,
            r.entry_price, r.exit_price, r.direction,
            r.profit_loss, r.profit_loss_percent,
            bool(r.success) if r.success is not None else None,
            r.stop_loss, r.take_profit,
            r.timestamp.strftime("%Y-%m-%d %H:%M"),
        ])
    df = pd.DataFrame(rows, columns=cols)
    buf_xlsx = io.BytesIO()
    with pd.ExcelWriter(buf_xlsx, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="user_stats")
    buf_xlsx.seek(0)

    # 3) ZIP обеих
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w") as z:
        z.writestr("user_stats.pdf", buf_pdf.getvalue())
        z.writestr("user_stats.xlsx", buf_xlsx.getvalue())
    zip_buf.seek(0)

    return send_file(zip_buf, as_attachment=True, download_name="user_stats_bundle.zip", mimetype="application/zip")


# === API: Smart Combine (автоподбор индикаторов) ===
@app.route("/api/smart_combine", methods=["POST"])
def api_smart_combine():
    if not session.get("user_id"):
        language = request.args.get('language') or (request.json.get('language') if request.json else None) or 'ru'
        return jsonify({"error": get_translation("error_unauthorized", language)}), 401

    data = request.json or {}
    language = data.get("language", "ru")
    symbol = data.get("symbol")
    trading_type = data.get("trading_type")
    timeframe = data.get("timeframe")
    
    # Если таймфрейм "auto" или не указан - используем None (будет использован дефолтный)
    if timeframe == "auto" or timeframe == "" or timeframe is None:
        timeframe = None

    if not symbol or not trading_type:
        return jsonify({"error": get_translation("error_symbol_required", language) or "Не указаны symbol и trading_type"}), 400

    try:
        indicators, reason = smart_combine_indicators(symbol, trading_type, timeframe)
        return jsonify({
            "ok": True,
            "indicators": indicators,
            "reason": reason
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# === API: Экспорт в TradingView ===
@app.route("/api/export_tradingview", methods=["POST"])
def export_tradingview():
    """Экспортирует данные анализа в формат TradingView (JSON)."""
    if not session.get("user_id"):
        language = request.args.get('language') or (request.json.get('language') if request.json else None) or 'ru'
        return jsonify({"error": get_translation("error_unauthorized", language)}), 401
    
    data = request.json or {}
    symbol = data.get("symbol")
    entry_price = data.get("entry_price")
    stop_loss = data.get("stop_loss")
    take_profit = data.get("take_profit")
    direction = data.get("direction")
    
    if not symbol or not entry_price:
        return jsonify({"error": "Недостаточно данных для экспорта"}), 400
    
    try:
        # Формируем JSON в формате TradingView
        tradingview_data = {
            "symbol": symbol,
            "entry_price": float(entry_price),
            "stop_loss": float(stop_loss) if stop_loss else None,
            "take_profit": float(take_profit) if take_profit else None,
            "direction": direction,
            "timestamp": datetime.now().isoformat(),
            "format": "TradingView JSON v1.0"
        }
        
        # Конвертируем в JSON строку
        json_str = json.dumps(tradingview_data, indent=2, ensure_ascii=False)
        
        # Создаем response с JSON файлом
        response = make_response(json_str)
        response.headers['Content-Type'] = 'application/json; charset=utf-8'
        response.headers['Content-Disposition'] = f'attachment; filename=tradingview_{symbol.replace("/", "_")}_{datetime.now().strftime("%Y%m%d")}.json'
        
        return response
    except Exception as e:
        print(f"⚠️ Ошибка экспорта в TradingView: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# === API: Сохранение настроек автоматических сигналов ===
@app.route("/api/auto_signals/settings", methods=["POST"])
def save_auto_signals_settings():
    """Сохраняет настройки автоматических сигналов пользователя."""
    if not session.get("user_id"):
        language = request.args.get('language') or (request.json.get('language') if request.json else None) or 'ru'
        return jsonify({"error": get_translation("error_unauthorized", language)}), 401
    
    user_id = session["user_id"]
    data = request.json or {}
    
    try:
        user = User.query.get(user_id)
        if not user:
            language = request.args.get('language') or (request.json.get('language') if request.json else None) or 'ru'
            return jsonify({"error": get_translation("error_user_not_found", language)}), 404
        
        # Обновляем настройки
        if "auto_signals_enabled" in data:
            user.auto_signals_enabled = bool(data.get("auto_signals_enabled", False))
        if "auto_signal_symbol" in data:
            user.auto_signal_symbol = data.get("auto_signal_symbol", "").strip() if data.get("auto_signal_symbol") else None
        if "auto_signal_capital" in data:
            capital = data.get("auto_signal_capital")
            user.auto_signal_capital = float(capital) if capital else None
        if "auto_signal_trading_type" in data:
            user.auto_signal_trading_type = data.get("auto_signal_trading_type", "").strip() if data.get("auto_signal_trading_type") else None
        if "auto_signal_strategy" in data:
            user.auto_signal_strategy = data.get("auto_signal_strategy", "").strip() if data.get("auto_signal_strategy") else None
        if "auto_signal_risk" in data:
            risk = data.get("auto_signal_risk")
            user.auto_signal_risk = float(risk) if risk else None
        if "auto_signal_confirmation" in data:
            user.auto_signal_confirmation = data.get("auto_signal_confirmation", "").strip() if data.get("auto_signal_confirmation") else None
        if "auto_signal_min_reliability" in data:
            min_rel = data.get("auto_signal_min_reliability")
            user.auto_signal_min_reliability = float(min_rel) if min_rel else 60.0
        if "auto_signal_check_interval" in data:
            interval = data.get("auto_signal_check_interval")
            user.auto_signal_check_interval = int(interval) if interval else 60
            user.auto_signal_min_reliability = float(data.get("min_reliability", 60.0))
        if "check_interval" in data:
            user.auto_signal_check_interval = int(data.get("check_interval", 60))
        
        db.session.commit()
        language = data.get('language', 'ru')
        return jsonify({"success": True, "message": get_translation("error_settings_saved", language)})
    except Exception as e:
        db.session.rollback()
        logger.error(f"⚠️ Ошибка сохранения настроек автоматических сигналов: {e}")
        return jsonify({"error": str(e)}), 500

# === API: Загрузка настроек автоматических сигналов ===
@app.route("/api/auto_signals/settings")
def get_auto_signals_settings():
    """Возвращает настройки автоматических сигналов пользователя."""
    if not session.get("user_id"):
        language = request.args.get('language') or (request.json.get('language') if request.json else None) or 'ru'
        return jsonify({"error": get_translation("error_unauthorized", language)}), 401
    
    user_id = session["user_id"]
    try:
        user = User.query.get(user_id)
        if not user:
            language = request.args.get('language') or (request.json.get('language') if request.json else None) or 'ru'
            return jsonify({"error": get_translation("error_user_not_found", language)}), 404
        
        return jsonify({
            "auto_signals_enabled": getattr(user, 'auto_signals_enabled', False) or False,
            "auto_signal_symbol": getattr(user, 'auto_signal_symbol', None) or "",
            "auto_signal_capital": getattr(user, 'auto_signal_capital', None) or 10000,
            "auto_signal_trading_type": getattr(user, 'auto_signal_trading_type', None) or "",
            "auto_signal_strategy": getattr(user, 'auto_signal_strategy', None) or "",
            "auto_signal_risk": getattr(user, 'auto_signal_risk', None) or 1.0,
            "auto_signal_confirmation": getattr(user, 'auto_signal_confirmation', None) or "",
            "auto_signal_min_reliability": getattr(user, 'auto_signal_min_reliability', None) or 60.0,
            "auto_signal_check_interval": getattr(user, 'auto_signal_check_interval', None) or 60,
            "auto_signal_last_check": user.auto_signal_last_check.isoformat() if getattr(user, 'auto_signal_last_check', None) else None
        })
    except Exception as e:
        logger.error(f"⚠️ Ошибка загрузки настроек автоматических сигналов: {e}")
        return jsonify({"error": str(e)}), 500

# === API: Тестовая проверка автоматических сигналов ===
@app.route("/api/auto_signals/test", methods=["POST"])
def test_auto_signals():
    """Ручная проверка автоматических сигналов (для тестирования)."""
    if not session.get("user_id"):
        language = request.args.get('language') or (request.json.get('language') if request.json else None) or 'ru'
        return jsonify({"error": get_translation("error_unauthorized", language)}), 401
    
    user_id = session["user_id"]
    try:
        user = User.query.get(user_id)
        if not user:
            language = request.args.get('language') or (request.json.get('language') if request.json else None) or 'ru'
            return jsonify({"error": get_translation("error_user_not_found", language)}), 404
        
        if not getattr(user, 'auto_signals_enabled', False):
            return jsonify({"error": "Автоматические сигналы не включены"}), 400
        
        # Импортируем функцию проверки
        from auto_signals_worker import run_analysis_for_user, send_signal_notifications
        
        result = run_analysis_for_user(user)
        
        if result and result.get("signal_found"):
            send_signal_notifications(user, result)
            # Обновляем информацию о последнем сигнале
            user.auto_signal_last_signal_price = result.get("entry_price")
            user.auto_signal_last_signal_direction = result.get("direction")
            user.auto_signal_last_check = datetime.utcnow()
            db.session.commit()
            
            return jsonify({
                "success": True,
                "message": "Сигнал найден и уведомления отправлены",
                "signal": result
            })
        else:
            user.auto_signal_last_check = datetime.utcnow()
            db.session.commit()
            return jsonify({
                "success": True,
                "message": "Сигнал не найден или надежность недостаточна",
                "signal": result
            })
            
    except Exception as e:
        logger.error(f"⚠️ Ошибка тестовой проверки автоматических сигналов: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# === Корректное закрытие соединений при завершении ===
def cleanup_connections():
    """Закрывает все HTTP соединения и ресурсы при завершении приложения."""
    try:
        # Отключаем предупреждения urllib3
        urllib3.disable_warnings()
        # Закрываем соединение с БД
        try:
            db.session.close()
            db.engine.dispose()
        except:
            pass
    except:
        pass  # Игнорируем ошибки при завершении

def signal_handler(signum, frame):
    """Обработчик сигналов для корректного завершения."""
    print("\n🛑 Получен сигнал завершения, закрываю соединения...")
    cleanup_connections()
    exit(0)

# Регистрируем обработчики
atexit.register(cleanup_connections)
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

# Для Windows также обрабатываем CTRL+C и CTRL+BREAK
if hasattr(signal, 'SIGBREAK'):
    signal.signal(signal.SIGBREAK, signal_handler)

# === Запуск ===
if __name__ == "__main__":
    port = 5051  # Изменён с 5050 на 5051 из-за конфликта портов
    print(f"🖥️ Flask сервер запущен на http://127.0.0.1:{port}")
    try:
        app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False, threaded=True)
    except KeyboardInterrupt:
        print("\n🛑 Получен сигнал прерывания (Ctrl+C)")
        cleanup_connections()
    except OSError as e:
        if "address already in use" in str(e).lower() or "access" in str(e).lower():
            print(f"❌ Ошибка: Порт {port} занят или недоступен. Попробуйте другой порт или закройте другие приложения.")
        else:
            print(f"❌ Ошибка запуска сервера: {e}")
        raise
    finally:
        cleanup_connections()
