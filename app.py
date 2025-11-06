from flask import Flask, render_template, request, jsonify, send_file
import base64
import io
import zipfile
import csv
from concurrent.futures import ThreadPoolExecutor
from trading_app import run_analysis
import traceback
from models import db, ReportV2

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
            trend,
            stop_loss,
            take_profit
        ) = future.result()

        # --- Вычисление прибыли/успеха ---
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
            elif take_profit and take_profit < entry_price:
                profit_loss = entry_price - take_profit
                success = True
            else:
                profit_loss = entry_price - exit_price
                success = profit_loss > 0

        profit_loss_percent = (profit_loss / entry_price) * 100 if entry_price else 0

        # --- Сохраняем в БД ---
        new_report = ReportV2(
            user_id=None,
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
            trend=trend,
            stop_loss=stop_loss,
            take_profit=take_profit,
            profit_loss=profit_loss,
            profit_loss_percent=profit_loss_percent,
            success=success
        )
        db.session.add(new_report)
        db.session.commit()
        print(f"💾 Отчёт сохранён в БД: id={new_report.id}")

    except Exception as e:
        tb = traceback.format_exc()
        print("❌ Ошибка анализа или сохранения в БД:", tb)
        return jsonify({"error": f"Ошибка анализа: {str(e)}", "trace": tb}), 500

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
def reports_list():
    reports = ReportV2.query.order_by(ReportV2.timestamp.desc()).limit(20).all()
    return jsonify([
        {
            "id": r.id,
            "symbol": r.symbol,
            "strategy": r.strategy,
            "trading_type": r.trading_type,
            "timestamp": r.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        } for r in reports
    ])


# === Эндпоинт для скачивания статистики по пользователю ===
@app.route("/download_user_stats")
def download_user_stats():
    user_id = 1  # временно — потом заменим на current_user.id

    reports = ReportV2.query.filter(
        (ReportV2.user_id == None) | (ReportV2.user_id == 1)
    ).all()
    if not reports:
        return jsonify({"error": "Нет данных для отчёта"}), 404


    if reports:
        total = len(reports)
        wins = sum(1 for r in reports if getattr(r, "success", False))
        avg_profit = sum((r.profit_loss_percent or 0) for r in reports) / total
    else:
        return jsonify({"error": "Нет данных для отчёта"}), 404


    # — текстовый summary
    summary_text = f"""
📊 Отчёт по торговле пользователя #{user_id}
-----------------------------------------
Всего сделок: {total}
Win rate: {wins / total * 100:.2f}%
Средняя прибыль: {avg_profit:.2f}%
Успешные: {wins}
Неуспешные: {total - wins}
    """

    # — CSV со статистикой по символам
    symbol_stats = {}
    for r in reports:
        sym = getattr(r, "symbol", "N/A")
        if sym not in symbol_stats:
            symbol_stats[sym] = {"trades": 0, "win": 0, "loss": 0}
        symbol_stats[sym]["trades"] += 1
        if getattr(r, "success", False):
            symbol_stats[sym]["win"] += 1
        else:
            symbol_stats[sym]["loss"] += 1

    csv_buffer = io.StringIO()
    writer = csv.writer(csv_buffer)
    writer.writerow(["Symbol", "Trades", "Win", "Loss", "Win Rate (%)"])
    for s, v in symbol_stats.items():
        win_rate = (v["win"] / v["trades"]) * 100 if v["trades"] > 0 else 0
        writer.writerow([s, v["trades"], v["win"], v["loss"], f"{win_rate:.2f}"])

    # — создаём ZIP
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr("summary.txt", summary_text)
        zf.writestr("by_symbol.csv", csv_buffer.getvalue())

    zip_buffer.seek(0)
    return send_file(
        zip_buffer,
        as_attachment=True,
        download_name="user_stats.zip",
        mimetype="application/zip"
    )


# === Запуск сервера ===
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        print("✅ Таблицы созданы или уже существуют в MySQL")
    app.run(debug=False, port=5000, use_reloader=False, threaded=True)
