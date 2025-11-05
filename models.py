from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = "user"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True)
    # другие поля...

class ReportV2(db.Model):
    __tablename__ = "report_v2"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
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
    report_text = db.Column(db.Text)
    result_summary = db.Column(db.String(200))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    # связь с пользователем
    user = db.relationship("User", backref="reports_v2")
