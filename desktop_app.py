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

    @pyqtSlot(str, str)
    def saveZipFile(self, zip_base64, suggested_name):
        """
        Слот вызывается из JS: получает base64 и предлагает пользователю сохранить файл.
        """
        try:
            options = QFileDialog.Options()
            # Предлагаемый файл имением suggested_name
            path, _ = QFileDialog.getSaveFileName(None, "Сохранить отчёт", suggested_name, "ZIP Files (*.zip)", options=options)
            if not path:
                print("⚠️ Пользователь отменил сохранение")
                return
            data = base64.b64decode(zip_base64)
            with open(path, "wb") as f:
                f.write(data)
            print(f"✅ Файл сохранён: {path}")
        except Exception as e:
            print("❌ Ошибка при сохранении ZIP:", e)


def run_flask():
    # Запуск flask в том же процессе, в отдельном потоке
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

    # кэш-бастер
    cache_buster = int(time.time())
    web.setUrl(QUrl(f"http://127.0.0.1:5000?nocache={cache_buster}"))

    channel = QWebChannel()
    bridge = WebBridge()
    channel.registerObject("pyjs", bridge)
    web.page().setWebChannel(channel)

    window.setCentralWidget(web)
    window.show()
    sys.exit(app_qt.exec_())
