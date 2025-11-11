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
from trading_app import run_analysis  # твой модуль анализа
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
import numpy as np

# === Flask app ===
app = Flask(__name__)
app.secret_key = os.urandom(24)

# === MySQL ===
app.config['SQLALCHEMY_DATABASE_URI'] = "mysql+pymysql://u543957720_crypto:AgUbbkD1h!@auth-db936.hstgr.io/u543957720_cryptoprice"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {"pool_recycle": 280, "pool_pre_ping": True}

db = SQLAlchemy(app)

# === Модели ===
class User(db.Model):
    __tablename__ = "user"
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    plan = db.Column(db.String(20), default="free")


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

    if not verify_password(password, user.password_hash):
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
            take_profit
        ) = run_analysis(
            data.get("symbol"),
            None,
            data.get("strategy"),
            data.get("trading_type"),
            float(data.get("capital", 10000)),
            float(data.get("risk", 1)) / 100,
            None,
            data.get("confirmation")
        )

        profit_loss = ((exit_price - entry_price) * data.get("capital", 0) / entry_price) if entry_price and exit_price else None
        profit_loss_percent = ((exit_price - entry_price) / entry_price * 100) if entry_price and exit_price else None
        success = ((exit_price > entry_price) if direction == "long" else (exit_price < entry_price)) if entry_price and exit_price and direction else None

        report = ReportV2(
            user_id=user_id,
            symbol=symbol,
            strategy=data.get("strategy"),
            trading_type=data.get("trading_type"),
            capital=float(data.get("capital", 0)),
            risk=float(data.get("risk", 0)),
            confirmation=str(data.get("confirmation", "")),
            report_text=report_text,
            rr_long=rr_long,
            rr_short=rr_short,
            trend=trend,
            entry_price=entry_price,
            exit_price=exit_price,
            direction=direction,
            stop_loss=stop_loss,
            take_profit=take_profit,
            profit_loss=profit_loss,
            profit_loss_percent=profit_loss_percent,
            success=success,
            result_summary="Анализ завершён"
        )

        db.session.add(report)
        db.session.commit()
        print(f"💾 Отчёт сохранён: id={report.id}, user={user_id}")

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
            "zip_base64": zip_base64
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
    symbols = [r.symbol or "N/A" for r in reports]
    successes = [(1 if r.success else 0) if r.success is not None else None for r in reports]
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


# === Запуск ===
if __name__ == "__main__":
    port = 5050
    print(f"🖥️ Flask сервер запущен на http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False, threaded=True)
