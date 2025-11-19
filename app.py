import os
import base64
import io
import zipfile
import csv
import traceback
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for, session
from werkzeug.security import check_password_hash
import bcrypt
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func
from trading_app import run_analysis, smart_combine_indicators, fetch_ohlcv  # твой модуль анализа
import requests
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Загрузка переменных окружения из .env файла (если есть)
try:
    from dotenv import load_dotenv
    load_dotenv()
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
app.secret_key = os.urandom(24)

# === Настройки уведомлений ===
# Сначала пытаемся загрузить из config_notifications.py (упрощенная настройка)
try:
    from config_notifications import (
        TELEGRAM_BOT_TOKEN as CONFIG_TELEGRAM_TOKEN,
        SMTP_HOST as CONFIG_SMTP_HOST,
        SMTP_PORT as CONFIG_SMTP_PORT,
        SMTP_USER as CONFIG_SMTP_USER,
        SMTP_PASSWORD as CONFIG_SMTP_PASSWORD
    )
    # Используем настройки из config_notifications.py, если они заполнены
    TELEGRAM_BOT_TOKEN = CONFIG_TELEGRAM_TOKEN if CONFIG_TELEGRAM_TOKEN else os.getenv("TELEGRAM_BOT_TOKEN", "")
    SMTP_HOST = CONFIG_SMTP_HOST if CONFIG_SMTP_HOST else os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(CONFIG_SMTP_PORT) if CONFIG_SMTP_PORT else int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = CONFIG_SMTP_USER if CONFIG_SMTP_USER else os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = CONFIG_SMTP_PASSWORD if CONFIG_SMTP_PASSWORD else os.getenv("SMTP_PASSWORD", "")
except ImportError:
    # Если config_notifications.py не существует, используем переменные окружения
    TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    print("ℹ️ Файл config_notifications.py не найден. Используются переменные окружения.")
except Exception as e:
    print(f"⚠️ Ошибка загрузки config_notifications.py: {e}. Используются переменные окружения.")
    TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
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


with app.app_context():
    db.create_all()

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
    return stored_hash == plain_password


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
        return jsonify({"error": "Пользователь не найден"}), 404

    if not verify_password(password, user.password):
        return jsonify({"error": "Неверный пароль"}), 401

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
    return jsonify({"logged_in": bool(session.get("user_id"))})


# === Страницы ===
@app.route("/login")
def login_page():
    return render_template("login.html")

@app.route("/")
def index_page():
    if not session.get("user_id"):
        return redirect(url_for("login_page"))
    return render_template("index.html")


# === API: Анализ ===
@app.route("/api/analyze", methods=["POST"])
def run_analysis_route():
    if not session.get("user_id"):
        return jsonify({"error": "Требуется авторизация"}), 401

    data = request.json or {}
    user_id = session["user_id"]

    try:
        # Получаем параметры трейлинга
        enable_trailing = bool(data.get("enable_trailing", False))
        trailing_percent = float(data.get("trailing_percent", 50)) / 100 if enable_trailing else None
        
        # Получаем таймфрейм: если передан конкретный - используем его, иначе None (будет использован дефолтный)
        timeframe = data.get("timeframe")
        if timeframe == "auto" or timeframe == "" or timeframe is None:
            timeframe = None  # Используется дефолтный таймфрейм для типа торговли
        
        (
            report_text,
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
            reliability_rating
        ) = run_analysis(
            data.get("symbol"),
            timeframe,  # Передаем выбранный таймфрейм (None для автоматического)
            data.get("strategy"),
            data.get("trading_type"),
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
            trailing_percent=trailing_percent
        )

        profit_loss = ((exit_price - entry_price) * data.get("capital", 0) / entry_price) if entry_price and exit_price else None
        profit_loss_percent = ((exit_price - entry_price) / entry_price * 100) if entry_price and exit_price else None
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
            if hasattr(value, 'item'):  # numpy scalar
                return value.item()
            return float(value) if isinstance(value, (np.integer, np.floating)) else value
        
        report = ReportV2(
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

        db.session.add(report)
        try:
            db.session.commit()
            print(f"💾 Отчёт сохранён: id={report.id}, user={user_id}")
        except Exception as db_error:
            db.session.rollback()
            error_str = str(db_error)
            # Проверяем, является ли это ошибкой "MySQL server has gone away"
            if "2006" in error_str or "MySQL server has gone away" in error_str or "ConnectionResetError" in error_str:
                print(f"⚠️ Потеряно соединение с БД, пытаемся переподключиться...")
                try:
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
                    print(f"💾 Отчёт сохранён после переподключения: id={report_retry.id}, user={user_id}")
                except Exception as retry_error:
                    print(f"⚠️ Ошибка сохранения отчёта после переподключения: {retry_error}")
                    # Продолжаем работу, даже если не удалось сохранить в БД
                    pass
            else:
                print(f"⚠️ Ошибка сохранения отчёта: {db_error}")
                # Продолжаем работу, даже если не удалось сохранить в БД
                pass

        # === Уведомления (закомментировано - будет полезно при добавлении автоматического мониторинга) ===
        # При ручном запуске анализа результаты сразу видны на экране, поэтому уведомления не нужны
        # Раскомментируйте этот блок, если добавите автоматический мониторинг рынка в фоне
        """
        user = User.query.get(user_id)
        
        # Email уведомления (опционально, только если пользователь включил)
        enable_email_request = bool(data.get("enable_email", False))
        enable_email_db = user and user.enable_email_notifications
        enable_email = enable_email_request or enable_email_db
        
        # Минимальный рейтинг (из запроса или из БД)
        alert_min_reliability = float(data.get("alert_min_reliability", user.alert_min_reliability if user else 60))
        
        # Отправляем Email уведомление только если включено и рейтинг достаточен
        if enable_email and user and user.email and reliability_rating >= alert_min_reliability:
            alert_message = format_alert_message(
                symbol, direction, entry_price, stop_loss, take_profit,
                reliability_rating, data.get("strategy"), trend
            )
            
            email_subject = f"🚨 Новый торговый сигнал: {symbol} {direction.upper()}"
            email_message = alert_message.replace("<b>", "").replace("</b>", "").replace("🚨", "🚨").replace("📊", "📊")
            print(f"📧 Попытка отправить Email уведомление на {user.email} (SMTP_USER: {SMTP_USER})")
            if send_email_notification(user.email, email_subject, email_message):
                print(f"✅ Email уведомление отправлено на {user.email}")
            else:
                print(f"⚠️ Не удалось отправить Email уведомление на {user.email}. Проверьте SMTP настройки в config_notifications.py.")
        """

        chart_base64 = base64.b64encode(chart_bytes.getvalue()).decode() if chart_bytes else None
        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf, "w") as z:
            z.writestr("report.txt", report_text)
            if chart_bytes:
                z.writestr("chart.png", chart_bytes.getvalue())
            if excel_bytes:
                z.writestr("data.xlsx", excel_bytes.getvalue())
        zip_base64 = base64.b64encode(zip_buf.getvalue()).decode()

        return jsonify({
            "report_text": report_text,
            "chart_base64": chart_base64,
            "zip_base64": zip_base64,
            "symbol": symbol,
            "entry_price": float(entry_price) if entry_price is not None else None,
            "stop_loss": float(stop_loss) if stop_loss is not None else None,
            "take_profit": float(take_profit) if take_profit is not None else None,
            "direction": direction
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# === API: Скачивание статистики ===
@app.route("/download_user_stats")
def download_user_stats():
    if not session.get("user_id"):
        return jsonify({"error": "Неавторизован"}), 401

    user_id = session["user_id"]
    reports = ReportV2.query.filter_by(user_id=user_id).all()
    if not reports:
        return jsonify({"error": "Нет данных"}), 404

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
    
    for report in reports:
        strategy = report.strategy or "Не указана"
        
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

def generate_auto_summary(reports, strategy_stats):
    """
    Генерирует автоматический текстовый отчёт (AI Summary) на основе данных.
    """
    if not reports:
        return "Недостаточно данных для анализа."
    
    summary_parts = []
    
    # Общая статистика
    total_trades = len(reports)
    # Определяем успешность на основе фактической прибыли, если доступна
    successful = sum(1 for r in reports if (r.profit_loss_percent is not None and r.profit_loss_percent > 0) or (r.profit_loss_percent is None and r.success == True))
    failed = sum(1 for r in reports if (r.profit_loss_percent is not None and r.profit_loss_percent <= 0) or (r.profit_loss_percent is None and r.success == False))
    total_success_rate = (successful / (successful + failed) * 100) if (successful + failed) > 0 else 0
    
    # Определяем общую тенденцию
    avg_profit = np.mean([r.profit_loss_percent for r in reports if r.profit_loss_percent is not None]) if any(r.profit_loss_percent is not None for r in reports) else 0
    trend = "бычья" if avg_profit > 0 else "медвежья" if avg_profit < 0 else "нейтральная"
    
    # Лучшая стратегия
    best_strategy = None
    best_avg_profit = float('-inf')
    if strategy_stats:
        for strategy, stats in strategy_stats.items():
            if stats["avg_profit_percent"] > best_avg_profit:
                best_avg_profit = stats["avg_profit_percent"]
                best_strategy = strategy
    
    # Наиболее используемый инструмент
    symbols = [r.symbol for r in reports if r.symbol]
    symbol_counts = {}
    for s in symbols:
        symbol_counts[s] = symbol_counts.get(s, 0) + 1
    most_used_symbol = max(symbol_counts.items(), key=lambda x: x[1])[0] if symbol_counts else None
    
    # Формируем текст
    summary_parts.append(f"📊 **Общая статистика:** Всего сделок: {total_trades}, успешных: {successful} ({total_success_rate:.1f}%), неудачных: {failed}.")
    
    summary_parts.append(f"📈 **Основная тенденция:** {trend.capitalize()} (средняя прибыль: {avg_profit:+.2f}%).")
    
    if best_strategy:
        summary_parts.append(f"🏆 **Лучшая стратегия:** {best_strategy} (средняя прибыль: {best_avg_profit:+.2f}%, Win Rate: {strategy_stats[best_strategy]['win_rate']:.1f}%).")
    
    if most_used_symbol:
        summary_parts.append(f"💎 **Наиболее используемый инструмент:** {most_used_symbol} ({symbol_counts[most_used_symbol]} сделок).")
    
    # Анализ по типам торговли
    trading_types = {}
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
            summary_parts.append(f"⏰ **Наиболее прибыльный тип торговли:** {best_type[0]} (средняя прибыль: {avg_type_profit:+.2f}%).")
    
    return " ".join(summary_parts)

# === Функции отправки уведомлений ===
def send_telegram_notification(username_or_chat_id, message, bot_token=None):
    """
    Отправляет уведомление в Telegram.
    
    Параметры:
    - username_or_chat_id: Telegram username (с @ или без) или Chat ID
    - message: текст сообщения
    - bot_token: токен бота (если не указан, используется глобальный)
    
    Возвращает: True если успешно, False если ошибка
    """
    try:
        token = bot_token or TELEGRAM_BOT_TOKEN
        if not token:
            print(f"⚠️ TELEGRAM_BOT_TOKEN не настроен.")
            print(f"   Решение: Откройте файл config_notifications.py и заполните TELEGRAM_BOT_TOKEN")
            print(f"   Или установите переменную окружения: export TELEGRAM_BOT_TOKEN='ваш_токен'")
            return False
        
        if not username_or_chat_id or not username_or_chat_id.strip():
            print(f"⚠️ Telegram Chat ID не указан. Пользователь должен указать свой Chat ID в настройках.")
            return False
        
        # Очищаем от пробелов
        chat_id_clean = str(username_or_chat_id).strip()
        
        # Убираем @ в начале, если есть (на случай, если пользователь ввел @ перед числом)
        if chat_id_clean.startswith('@'):
            chat_id_clean = chat_id_clean[1:]
        
        # Проверяем, что это число (Chat ID)
        if not chat_id_clean.isdigit():
            print(f"⚠️ Неверный формат Chat ID: '{chat_id_clean}'")
            print(f"   Chat ID должен быть числом (например: 123456789)")
            print(f"   Получите Chat ID у бота @userinfobot в Telegram")
            return False
        
        if len(chat_id_clean) < 5:
            print(f"⚠️ Chat ID слишком короткий: '{chat_id_clean}'")
            print(f"   Chat ID обычно содержит 9-10 цифр")
            print(f"   Получите Chat ID у бота @userinfobot в Telegram")
            return False
        
        # Используем Chat ID как есть (число)
        chat_identifier = chat_id_clean
        
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        response = requests.post(url, json={
            "chat_id": chat_identifier,
            "text": message,
            "parse_mode": "HTML"
        }, timeout=10)
        
        if response.status_code == 200:
            print(f"✅ Telegram уведомление успешно отправлено на {chat_identifier}")
            return True
        else:
            error_data = response.json() if response.text else {}
            error_desc = error_data.get("description", "Неизвестная ошибка")
            error_code = error_data.get("error_code", 0)
            print(f"⚠️ Ошибка отправки Telegram уведомления: {response.status_code} - {error_desc}")
            
            if response.status_code == 401:
                print(f"   Возможная причина: Неверный TELEGRAM_BOT_TOKEN. Проверьте токен в config_notifications.py")
            elif response.status_code == 400:
                if "chat not found" in error_desc.lower() or "user not found" in error_desc.lower():
                    print(f"   ⚠️ Пользователь с Chat ID ({chat_identifier}) не найден. Возможные причины:")
                    print(f"   1. Пользователь не начал диалог с ботом")
                    print(f"      → Решение: Пользователь должен найти бота @CryptoTradingAnalyzer в Telegram и отправить ему /start")
                    print(f"   2. Chat ID указан неправильно (проверьте, нет ли лишних пробелов или символов)")
                    print(f"      → Решение: Получите Chat ID заново у бота @userinfobot")
                    print(f"   3. Пользователь заблокировал бота")
                    print(f"      → Решение: Пользователь должен разблокировать бота в настройках Telegram")
                else:
                    print(f"   Возможная причина: Неверный Chat ID ({chat_identifier}). Убедитесь, что пользователь указал правильный Chat ID")
            elif response.status_code == 403:
                print(f"   Возможная причина: Пользователь заблокировал бота или бот не может отправлять сообщения")
                print(f"   → Решение: Пользователь должен разблокировать бота и отправить ему /start")
            return False
    except requests.exceptions.Timeout:
        print(f"⚠️ Таймаут при отправке Telegram уведомления. Проверьте интернет-соединение.")
        return False
    except Exception as e:
        print(f"⚠️ Ошибка отправки Telegram уведомления: {e}")
        print(f"   Проверьте: 1) TELEGRAM_BOT_TOKEN в config_notifications.py, 2) Chat ID пользователя, 3) Интернет-соединение")
        return False

def send_email_notification(email, subject, message):
    """
    Отправляет уведомление на Email.
    
    Параметры:
    - email: адрес получателя (email пользователя из БД)
    - subject: тема письма
    - message: текст сообщения
    
    Возвращает: True если успешно, False если ошибка
    
    Примечание: Письмо отправляется с адреса SMTP_USER (из .env) на адрес пользователя (email).
    """
    try:
        if not SMTP_USER or not SMTP_PASSWORD or not email:
            print(f"⚠️ SMTP настройки неполные:")
            print(f"   SMTP_USER: {'✅ установлен' if SMTP_USER else '❌ не установлен'}")
            print(f"   SMTP_PASSWORD: {'✅ установлен' if SMTP_PASSWORD else '❌ не установлен'}")
            print(f"   email получателя: {email if email else '❌ не указан'}")
            print(f"   Решение: Откройте файл config_notifications.py и заполните SMTP_USER и SMTP_PASSWORD")
            return False
        
        msg = MIMEMultipart()
        msg['From'] = SMTP_USER  # От кого (адрес из .env)
        msg['To'] = email        # Кому (email пользователя из БД)
        msg['Subject'] = subject
        
        msg.attach(MIMEText(message, 'html', 'utf-8'))
        
        print(f"📧 Подключение к SMTP серверу: {SMTP_HOST}:{SMTP_PORT}")
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        print(f"✅ Email успешно отправлен с {SMTP_USER} на {email}")
        return True
    except smtplib.SMTPAuthenticationError as e:
        print(f"⚠️ Ошибка аутентификации SMTP: {e}")
        print(f"   Возможные причины:")
        print(f"   1. Неверный пароль приложения (для Gmail используйте пароль приложения, не обычный пароль!)")
        print(f"   2. Неверный email (SMTP_USER должен совпадать с email аккаунта)")
        print(f"   3. Включите 'Менее безопасные приложения' или используйте пароль приложения")
        print(f"   Инструкция для Gmail: https://support.google.com/accounts/answer/185833")
        return False
    except smtplib.SMTPException as e:
        print(f"⚠️ Ошибка SMTP: {e}")
        print(f"   Проверьте настройки SMTP_HOST и SMTP_PORT в config_notifications.py")
        return False
    except Exception as e:
        print(f"⚠️ Ошибка отправки Email уведомления: {e}")
        print(f"   Проверьте: 1) SMTP настройки в config_notifications.py, 2) Интернет-соединение, 3) Пароль приложения")
        return False

def format_alert_message(symbol, direction, entry_price, stop_loss, take_profit, reliability_rating, strategy, trend):
    """
    Форматирует сообщение для уведомления.
    """
    direction_emoji = "🟢" if direction == "long" else "🔴"
    direction_text = "ЛОНГ" if direction == "long" else "ШОРТ"
    trend_text = "Бычий" if trend == "Uptrend" else "Медвежий"
    
    message = f"""
🚨 <b>Новый торговый сигнал!</b>

📊 <b>Инструмент:</b> {symbol}
{direction_emoji} <b>Направление:</b> {direction_text}
📈 <b>Тренд:</b> {trend_text}
🎯 <b>Стратегия:</b> {strategy}

💰 <b>Уровни:</b>
• Вход: ${entry_price:.2f}
• Stop Loss: ${stop_loss:.2f}
• Take Profit: ${take_profit:.2f}

⭐ <b>Рейтинг сигнала:</b> {reliability_rating:.1f}%

⏰ <b>Время:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
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
        return jsonify({"error": "Требуется авторизация"}), 401
    
    user_id = session["user_id"]
    data = request.json or {}
    
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "Пользователь не найден"}), 404
        
        # Обновляем настройки
        # Сохраняем только Email настройки (Telegram убран для упрощения)
        if "enable_email" in data:
            user.enable_email_notifications = bool(data.get("enable_email", False))
        if "alert_min_reliability" in data:
            user.alert_min_reliability = float(data.get("alert_min_reliability", 60))
        
        db.session.commit()
        return jsonify({"success": True, "message": "Настройки сохранены"})
    except Exception as e:
        db.session.rollback()
        print(f"⚠️ Ошибка сохранения настроек: {e}")
        return jsonify({"error": str(e)}), 500

# === API: Загрузка настроек уведомлений ===
@app.route("/api/get_notification_settings")
def get_notification_settings():
    """Возвращает настройки уведомлений пользователя."""
    if not session.get("user_id"):
        return jsonify({"error": "Требуется авторизация"}), 401
    
    user_id = session["user_id"]
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "Пользователь не найден"}), 404
        
        return jsonify({
            "enable_email": user.enable_email_notifications or False,
            "alert_min_reliability": user.alert_min_reliability or 60.0
        })
    except Exception as e:
        print(f"⚠️ Ошибка загрузки настроек: {e}")
        return jsonify({"error": str(e)}), 500

# === API: Анализ стратегий и Auto Summary ===
@app.route("/api/strategy_analysis")
def strategy_analysis():
    """Возвращает анализ стратегий и Auto Summary для текущего пользователя."""
    if not session.get("user_id"):
        return jsonify({"error": "Неавторизован"}), 401
    
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
    
    # Auto Summary
    auto_summary = generate_auto_summary(reports, strategy_stats)
    
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
        return jsonify({"error": "Неавторизован"}), 401

    user_id = session["user_id"]
    reports = ReportV2.query.filter_by(user_id=user_id).all()
    if not reports:
        return jsonify({"error": "Нет данных"}), 404

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
        return jsonify({"error": "Требуется авторизация"}), 401

    data = request.json or {}
    symbol = data.get("symbol")
    trading_type = data.get("trading_type")
    timeframe = data.get("timeframe")
    
    # Если таймфрейм "auto" или не указан - используем None (будет использован дефолтный)
    if timeframe == "auto" or timeframe == "" or timeframe is None:
        timeframe = None

    if not symbol or not trading_type:
        return jsonify({"error": "Не указаны symbol и trading_type"}), 400

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


# === Запуск ===
if __name__ == "__main__":
    port = 5051  # Изменён с 5050 на 5051 из-за конфликта портов
    print(f"🖥️ Flask сервер запущен на http://127.0.0.1:{port}")
    try:
        app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False, threaded=True)
    except OSError as e:
        if "address already in use" in str(e).lower() or "access" in str(e).lower():
            print(f"❌ Ошибка: Порт {port} занят или недоступен. Попробуйте другой порт или закройте другие приложения.")
        else:
            print(f"❌ Ошибка запуска сервера: {e}")
        raise
