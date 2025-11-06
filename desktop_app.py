import sys
import threading
import time
import base64
from PyQt5.QtWidgets import QApplication, QMainWindow, QFileDialog, QPushButton, QVBoxLayout, QWidget
from PyQt5.QtWebEngineWidgets import QWebEngineView, QWebEngineSettings
from PyQt5.QtWebChannel import QWebChannel
from PyQt5.QtCore import QObject, pyqtSlot, QUrl, Qt
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
                None, "Сохранить отчёт", suggested_name, "ZIP Files (*.zip)", options=options
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


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Crypto Trading Analyzer")
        self.resize(1200, 800)
        self.setMinimumSize(1200, 800)

        # Основной виджет и layout
        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        central.setLayout(layout)

        # QWebEngineView
        self.web = QWebEngineView()
        layout.addWidget(self.web)

        # аппаратное ускорение
        self.web.settings().setAttribute(QWebEngineSettings.Accelerated2dCanvasEnabled, True)
        self.web.settings().setAttribute(QWebEngineSettings.WebGLEnabled, True)

        # кэш-бастер
        cache_buster = int(time.time())
        self.web.setUrl(QUrl(f"http://127.0.0.1:5000?nocache={cache_buster}"))

        # WebChannel
        self.channel = QWebChannel()
        self.bridge = WebBridge()
        self.channel.registerObject("pyjs", self.bridge)
        self.web.page().setWebChannel(self.channel)

    def resizeEvent(self, event):
        # минимизируем лишние перерисовки при ресайзе
        self.web.resize(self.size())
        super().resizeEvent(event)


if __name__ == "__main__":
    # Flask сервер в отдельном потоке
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()

    print("⏳ Запуск Flask-сервера...")
    if not wait_for_server():
        print("⚠️ Сервер не запустился вовремя")

    app_qt = QApplication(sys.argv)

    # убираем пунктир вокруг всех QPushButton по умолчанию
    app_qt.setStyleSheet("""
        QPushButton { outline: none; }
        QPushButton:focus { outline: none; }
    """)

    window = MainWindow()
    window.show()
    sys.exit(app_qt.exec_())
