from flask import Flask, render_template, request, jsonify
import base64
import io
import zipfile
from trading_app import run_analysis

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/run_analysis", methods=["POST"])
def analyze():
    data = request.json

    # Получаем результаты анализа
    report_text, chart_bytes, excel_bytes = run_analysis(
        symbol=data.get("symbol"),
        strategy=data.get("strategy"),
        trading_type=data.get("trading_type"),
        capital=float(data.get("capital", 10000)),
        risk=float(data.get("risk", 1)) / 100
    )

    # Кодируем график в base64
    chart_base64 = base64.b64encode(chart_bytes.getvalue()).decode()

    # Создаем ZIP с отчётом, графиком и Excel
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr("report.txt", report_text)
        zf.writestr("chart.png", chart_bytes.getvalue())
        zf.writestr("data.xlsx", excel_bytes.getvalue())
    zip_base64 = base64.b64encode(zip_buffer.getvalue()).decode()

    # Отправляем JSON с результатами
    return jsonify({
        "report_text": report_text,
        "chart_base64": chart_base64,
        "zip_base64": zip_base64
    })

if __name__ == "__main__":
    # Для десктоп-приложения debug=False, use_reloader=False
    app.run(debug=False, port=5000, use_reloader=False)
