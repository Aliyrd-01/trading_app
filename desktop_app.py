import sys
import threading
import time
import base64
from PyQt5.QtWidgets import QApplication, QMainWindow, QFileDialog
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtWebChannel import QWebChannel
from PyQt5.QtCore import QObject, pyqtSlot, QUrl
from app import app  # Flask backend

class Bridge(QObject):
    def __init__(self):
        super().__init__()
        self.last_zip_base64 = None
        self.last_symbol = "report"

    @pyqtSlot(str, str)
    def setZipBase64(self, base64data, symbol):
        self.last_zip_base64 = base64data
        self.last_symbol = symbol.replace("/", "_")
        print(f"✅ ZIP для {self.last_symbol} получен и готов к скачиванию")

    @pyqtSlot()
    def downloadReport(self):
        if not self.last_zip_base64:
            print("⚠️ Нет данных для скачивания")
            return
        default_name = f"{self.last_symbol}_report.zip"
        options = QFileDialog.Options()
        save_path, _ = QFileDialog.getSaveFileName(None, "Сохранить отчёт", default_name, "ZIP Files (*.zip)", options=options)
        if save_path:
            with open(save_path, "wb") as f:
                f.write(base64.b64decode(self.last_zip_base64))
            print(f"✅ Файл сохранён: {save_path}")

def run_flask():
    app.run(debug=False, port=5000, use_reloader=False)

def wait_for_server(url="http://127.0.0.1:5000", timeout=10):
    import requests
    for _ in range(timeout * 10):
        try:
            r = requests.get(url)
            if r.status_code == 200:
                return True
        except:
            pass
        time.sleep(0.1)
    return False

# --- 🟢 Главный запуск приложения ---
if __name__ == "__main__":
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()

    print("⏳ Запуск Flask-сервера...")
    if not wait_for_server():
        print("⚠️ Сервер не запустился вовремя")

    app_qt = QApplication(sys.argv)
    window = QMainWindow()
    window.setWindowTitle("Crypto Trading Analyzer")
    window.resize(1200, 800)
    window.setMinimumSize(1200, 800)

    web = QWebEngineView()

    # 🟢 Добавляем уникальный параметр, чтобы сбросить кеш
    cache_buster = int(time.time())
    web.setUrl(QUrl(f"http://127.0.0.1:5000?nocache={cache_buster}"))

    channel = QWebChannel()
    bridge = Bridge()
    channel.registerObject("pyjs", bridge)
    web.page().setWebChannel(channel)

    window.setCentralWidget(web)
    window.show()
    sys.exit(app_qt.exec_())
