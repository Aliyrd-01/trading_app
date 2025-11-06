import sys
import threading
import time
import base64
from PyQt5.QtWidgets import QApplication, QMainWindow, QFileDialog
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtWebChannel import QWebChannel
from PyQt5.QtCore import QObject, pyqtSlot, QUrl
from app import app  # Flask backend


class WebBridge(QObject):
    def __init__(self):
        super().__init__()

    @pyqtSlot(str, str, result=str)
    def saveZipFile(self, zip_base64, suggested_name):
        """
        Слот вызывается из JS: получает base64 и предлагает пользователю сохранить файл.
        Возвращает "ok" при успешном сохранении или "cancel", если пользователь отменил.
        """
        try:
            options = QFileDialog.Options()
            path, _ = QFileDialog.getSaveFileName(
                None,
                "Сохранить отчёт",
                suggested_name,
                "ZIP Files (*.zip)",
                options=options
            )
            if not path:
                print("⚠️ Пользователь отменил сохранение")
                return "cancel"

            data = base64.b64decode(zip_base64)
            with open(path, "wb") as f:
                f.write(data)
            print(f"✅ Файл сохранён: {path}")
            return "ok"

        except Exception as e:
            print("❌ Ошибка при сохранении ZIP:", e)
            return "cancel"


def run_flask():
    # Запуск Flask в отдельном потоке
    app.run(debug=False, port=5000, use_reloader=False)


def wait_for_server(url="http://127.0.0.1:5000", timeout=10):
    import requests
    for _ in range(timeout * 10):
        try:
            r = requests.get(url)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(0.1)
    return False


if __name__ == "__main__":
    # --- Запуск Flask ---
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()

    print("⏳ Запуск Flask-сервера...")
    if not wait_for_server():
        print("⚠️ Сервер не запустился вовремя")

    # --- Запуск PyQt приложения ---
    app_qt = QApplication(sys.argv)
    window = QMainWindow()
    window.setWindowTitle("Crypto Trading Analyzer")
    window.resize(1200, 800)
    window.setMinimumSize(1200, 800)

    web = QWebEngineView()
    # кэш-бастер, чтобы всегда загружалась последняя версия фронтенда
    cache_buster = int(time.time())
    web.setUrl(QUrl(f"http://127.0.0.1:5000?nocache={cache_buster}"))

    # --- Настройка WebChannel для связи JS <-> Python ---
    channel = QWebChannel()
    bridge = WebBridge()
    channel.registerObject("pyjs", bridge)
    web.page().setWebChannel(channel)

    window.setCentralWidget(web)
    window.show()
    sys.exit(app_qt.exec_())
