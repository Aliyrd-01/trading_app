from flask import Flask, render_template, request, jsonify
import base64
import io
import zipfile
from concurrent.futures import ThreadPoolExecutor
from trading_app import run_analysis
import traceback

app = Flask(__name__)
executor = ThreadPoolExecutor(max_workers=2)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/run_analysis", methods=["POST"])
def analyze():
    data = request.json or {}
    print("🔔 /run_analysis called with:", data)
    # normalization: confirmation может быть строкой, списком, None
    confirmation = data.get("confirmation")
    # Запускаем анализ в пуле
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
        report_text, chart_bytes, excel_bytes, symbol = future.result()
    except Exception as e:
        tb = traceback.format_exc()
        print("❌ Ошибка анализа:", tb)
        return jsonify({"error": f"Ошибка анализа: {str(e)}", "trace": tb}), 500

    chart_base64 = base64.b64encode(chart_bytes.getvalue()).decode()
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr("report.txt", report_text)
        zf.writestr("chart.png", chart_bytes.getvalue())
        zf.writestr("data.xlsx", excel_bytes.getvalue())

    # 🟢 добавляем имя архива по названию валютной пары
    zip_filename = f"{symbol}_report.zip"

    zip_base64 = base64.b64encode(zip_buffer.getvalue()).decode()

    # 🟢 добавляем zip_filename в JSON-ответ
    return jsonify({
        "report_text": report_text,
        "chart_base64": chart_base64,
        "zip_base64": zip_base64,
        "zip_filename": zip_filename
    })


if __name__ == "__main__":
    app.run(debug=False, port=5000, use_reloader=False, threaded=True)
