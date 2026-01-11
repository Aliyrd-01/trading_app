from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

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
    stop_loss = db.Column(db.Float, nullable=True)        # ← добавлено
    take_profit = db.Column(db.Float, nullable=True)      # ← добавлено
    report_text = db.Column(db.Text)
    result_summary = db.Column(db.String(200))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref="reports_v2")

