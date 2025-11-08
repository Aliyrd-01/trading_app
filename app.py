import sys
import threading
import time
import base64
import requests
from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for
import io
import zipfile
import csv
from concurrent.futures import ThreadPoolExecutor
from trading_app import run_analysis
import traceback
from datetime import datetime
from werkzeug.security import check_password_hash

# ✅ Импорт моделей
from models import db, User, ReportV2

# === Flask App ===
app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = (
    "mysql+pymysql://u543957720_crypto:AgUbbkD1h%21@srv936.hstgr.io/u543957720_cryptoprice"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_pre_ping": True,
    "pool_recycle": 280,
}

db.init_app(app)

executor = ThreadPoolExecutor(max_workers=2)

with app.app_context():
    db.create_all()
    print("✅ Таблицы созданы или уже существуют в MySQL")

app.config["CURRENT_USER"] = None
app.config["CURRENT_USER_EMAIL"] = None


# ---------------------------
# Проверка пароля (только werkzeug, как на сайте)
# ---------------------------
def verify_password(plain_password: str, stored_hash: str) -> bool:
    if not stored_hash:
        return False
    plain_password = plain_password.strip()
    stored_hash = stored_hash.strip()
    try:
        return check_password_hash(stored_hash, plain_password)
    except Exception as e:
        print("Ошибка проверки пароля:", e)
        return False


# --- WebBridge для взаимодействия с JS ---
from PyQt5.QtCore import QObject, pyqtSlot
from PyQt5.QtWidgets import QFileDialog

class WebBridge(QObject):
    @pyqtSlot(str, str, result=str)
    def saveZipFile(self, zip_base64, suggested_name):
        try:
            path, _ = QFileDialog.getSaveFileName(
                None, "Сохранить отчёт", suggested_name, "ZIP Files (*.zip)"
            )
            if not path:
                return "cancel"
            data = base64.b64decode(zip_base64)
            with open(path, "wb") as f:
                f.write(data)
            return "ok"
        except Exception as e:
            print("Ошибка при сохранении ZIP:", e)
            return "cancel"

    @pyqtSlot(str)
    def loginSuccess(self, payload_json):
        print("Login payload from JS:", payload_json)


# === API логина ===
@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.json or {}
    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()

    if not email or not password:
        return jsonify({"error": "Email и пароль обязательны"}), 400

    try:
        user = User.query.filter_by(email=email).first()
    except Exception as e:
        print("❌ Ошибка обращения к БД:", e)
        return jsonify({"error": "Ошибка доступа к БД"}), 500

    if not user:
        return jsonify({"error": "Пользователь не найден"}), 404

    if not verify_password(password, user.password_hash):
        return jsonify({"error": "Неверный пароль"}), 401

    token = base64.b64encode(f"{email}:{password}".encode()).decode()

    return jsonify({
        "ok": True,
        "token": token,
        "user": {"id": user.id, "email": user.email, "plan": user.plan}
    })


@app.route("/session_set", methods=["POST"])
def session_set():
    data = request.json or {}
    user_id = data.get("user_id")
    email = data.get("email")
    if user_id is None:
        return jsonify({"error": "user_id required"}), 400

    try:
        app.config["CURRENT_USER"] = int(user_id)
    except Exception:
        app.config["CURRENT_USER"] = None
    app.config["CURRENT_USER_EMAIL"] = email
    print(f"👤 Текущий пользователь установлен: {app.config['CURRENT_USER']} ({email})")

    return jsonify({"ok": True, "current_user": app.config["CURRENT_USER"], "email": email}), 200


@app.route("/login")
def login():
    return render_template("login.html")


@app.route("/")
def index():
    if not app.config.get("CURRENT_USER"):
        return redirect(url_for("login"))
    return render_template("index.html")


# ==== Flask анализ и скачивание отчётов (без изменений) ====
@app.route("/run_analysis", methods=["POST"])
def analyze():
    data = request.json or {}
    confirmation = data.get("confirmation")
    future = executor.submit(
        run_analysis,
        data.get("symbol"),
        None,
        data.get("strategy"),
        data.get("trading_type"),
        float(data.get("capital", 10000)),
        float(data.get("risk", 1)) / 100,
        None,
        confirmation
    )
    try:
        (
            ReportV2_text,
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
        ) = future.result()

        # вычисление прибыли/убытка
        if direction == "LONG":
            if stop_loss and entry_price > stop_loss:
                profit_loss = stop_loss - entry_price
                success = False
            elif take_profit and take_profit > entry_price:
                profit_loss = take_profit - entry_price
                success = True
            else:
                profit_loss = exit_price - entry_price
                success = profit_loss > 0
        else:
            if stop_loss and entry_price < stop_loss:
                profit_loss = entry_price - stop_loss
                success = False
            elif take_profit and entry_price < take_profit:
                profit_loss = entry_price - take_profit
                success = True
            else:
                profit_loss = entry_price - exit_price
                success = profit_loss > 0

        profit_loss_percent = (profit_loss / entry_price) * 100 if entry_price else 0

        user_id = app.config.get("CURRENT_USER")
        report = ReportV2(
            user_id=user_id,
            symbol=symbol,
            strategy=data.get("strategy"),
            trading_type=data.get("trading_type"),
            capital=float(data.get("capital", 0)),
            risk=float(data.get("risk", 0)),
            confirmation=str(data.get("confirmation", "")),
            report_text=ReportV2_text,
            result_summary="Анализ успешно выполнен",
            rr_long=rr_long,
            rr_short=rr_short,
            trend=trend,
        )
        db.session.add(report)
        db.session.commit()
        print(f"💾 Отчёт сохранён: id={report.id}, user_id={user_id}")

    except Exception as e:
        tb = traceback.format_exc()
        print("❌ Ошибка анализа или сохранения в БД:", tb)
        return jsonify({"error": f"Ошибка анализа: {str(e)}"}), 500

    chart_base64 = base64.b64encode(chart_bytes.getvalue()).decode() if chart_bytes else None
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr("ReportV2.txt", ReportV2_text)
        if chart_bytes:
            zf.writestr("chart.png", chart_bytes.getvalue())
        if excel_bytes:
            zf.writestr("data.xlsx", excel_bytes.getvalue())
    zip_base64 = base64.b64encode(zip_buffer.getvalue()).decode()

    return jsonify({
        "ReportV2_text": ReportV2_text,
        "chart_base64": chart_base64,
        "zip_base64": zip_base64
    })


@app.route("/download_user_stats")
def download_user_stats():
    user_id = app.config.get("CURRENT_USER") or 1
    ReportV2s = ReportV2.query.filter(
        (ReportV2.user_id == None) | (ReportV2.user_id == user_id)
    ).all()
    if not ReportV2s:
        return jsonify({"error": "Нет данных для отчёта"}), 404

    total = len(ReportV2s)
    summary = f"📊 Отчёт по пользователю {user_id}\nВсего отчётов: {total}\n"
    csv_buf = io.StringIO()
    writer = csv.writer(csv_buf)
    writer.writerow(["Symbol", "Strategy", "Trading Type", "Date"])
    for r in ReportV2s:
        writer.writerow([r.symbol, r.strategy, r.trading_type, r.timestamp.strftime("%Y-%m-%d %H:%M")])

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w") as z:
        z.writestr("summary.txt", summary)
        z.writestr("ReportV2s.csv", csv_buf.getvalue())

    zip_buf.seek(0)
    return send_file(zip_buf, as_attachment=True, download_name="user_stats.zip", mimetype="application/zip")


# --- Запуск ---
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        print("✅ Таблицы созданы или уже существуют в MySQL")
    print("🖥️ Flask backend starting on http://127.0.0.1:5050 ...")
    app.run(debug=False, port=5050, use_reloader=False, threaded=True)
