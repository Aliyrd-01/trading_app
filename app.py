from flask import Flask, render_template, request, jsonify
import base64
import io
import zipfile
from concurrent.futures import ThreadPoolExecutor
from trading_app import run_analysis
import traceback
from models import db, ReportV2

# === Flask App ===
app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "mysql+pymysql://u543957720_crypto:AgUbbkD1h!@srv936.hstgr.io/u543957720_cryptoprice"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db.init_app(app)

# создаём пул потоков
executor = ThreadPoolExecutor(max_workers=2)

# Создаём таблицы при запуске
with app.app_context():
    db.create_all()
    print("✅ Таблицы созданы или уже существуют в MySQL")



@app.route("/")
def index():
    return render_template("index.html")


@app.route("/run_analysis", methods=["POST"])
def analyze():
    data = request.json or {}
    print("🔔 /run_analysis called with:", data)
    confirmation = data.get("confirmation")

    # --- Запуск анализа в отдельном потоке ---
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
    report_text,
    chart_bytes,
    excel_bytes,
    symbol,
    rr_long,
    rr_short,
    entry_price,
    exit_price,
    direction,
    trend
    ) = future.result()

    except Exception as e:
        tb = traceback.format_exc()
        print("❌ Ошибка анализа:", tb)
        return jsonify({"error": f"Ошибка анализа: {str(e)}", "trace": tb}), 500

    # --- Сохраняем отчёт в БД ---
    try:
        new_report = ReportV2(
    user_id=None,  # если есть связь с пользователем, иначе None
    symbol=symbol,
    strategy=data.get("strategy"),
    trading_type=data.get("trading_type"),
    capital=float(data.get("capital", 0)),
    risk=float(data.get("risk", 0)),
    confirmation=str(data.get("confirmation", "")),
    report_text=report_text,
    result_summary="Анализ успешно выполнен",
    rr_long=rr_long,
    rr_short=rr_short,
    entry_price=entry_price,
    exit_price=exit_price,
    direction=direction,
    trend=trend
    )
        db.session.add(new_report)
        db.session.commit()
        print(f"💾 Отчёт сохранён в БД: id={new_report.id}")
    except Exception as e:
        print("⚠️ Не удалось сохранить отчёт в БД:", e)

    # --- Формируем ответ ---
    chart_base64 = base64.b64encode(chart_bytes.getvalue()).decode()
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr("report.txt", report_text)
        zf.writestr("chart.png", chart_bytes.getvalue())
        zf.writestr("data.xlsx", excel_bytes.getvalue())

    zip_filename = f"{symbol}_report.zip"
    zip_base64 = base64.b64encode(zip_buffer.getvalue()).decode()

    return jsonify({
        "report_text": report_text,
        "chart_base64": chart_base64,
        "zip_base64": zip_base64,
        "zip_filename": zip_filename
    })


# === Вспомогательный эндпоинт для просмотра сохранённых отчётов ===
@app.route("/reports")
def reports():
    reports = ReportV2.query.order_by(ReportV2.created_at.desc()).limit(20).all()
    return jsonify([
        {
            "id": r.id,
            "symbol": r.symbol,
            "strategy": r.strategy,
            "trading_type": r.trading_type,
            "timestamp": r.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        } for r in reports
    ])


if __name__ == "__main__":
    with app.app_context():
        db.create_all()  # ✅ создаём таблицы при первом запуске
    app.run(debug=False, port=5000, use_reloader=False, threaded=True)
