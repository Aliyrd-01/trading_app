import sys
import threading
import time
import base64
import requests
import os

from PyQt5.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget, QFileDialog
from PyQt5.QtWebEngineWidgets import QWebEngineView, QWebEngineSettings
from PyQt5.QtWebChannel import QWebChannel
from PyQt5.QtCore import QObject, pyqtSlot, QUrl
from PyQt5.QtGui import QIcon

# импорт твоего backend Flask
from app import app  # Flask backend на 5050


# --- WebBridge для взаимодействия с JS (сохранение ZIP, уведомление о login) ---
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

    # ✅ НОВОЕ: Метод для сохранения JSON файлов
    @pyqtSlot(str, str, result=str)
    def saveJsonFile(self, json_content, suggested_name):
        try:
            path, _ = QFileDialog.getSaveFileName(
                None, "Сохранить JSON файл", suggested_name, "JSON Files (*.json)"
            )
            if not path:
                return "cancel"
            # json_content уже строка JSON, записываем в файл
            with open(path, "w", encoding="utf-8") as f:
                f.write(json_content)
            return "ok"
        except Exception as e:
            print("Ошибка при сохранении JSON:", e)
            return "cancel"

    @pyqtSlot(str)
    def loginSuccess(self, payload_json):
        # JS сообщает о успешном логине
        print("Login payload from JS:", payload_json)


# --- Функция запуска Flask в отдельном потоке ---
def run_flask():
    app.run(debug=False, port=5050, use_reloader=False, threaded=True)


def wait_for_server(url="http://127.0.0.1:5050", timeout=10):
    for _ in range(timeout * 10):
        try:
            r = requests.get(url, timeout=1.0)
            if r.status_code in (200, 302):
                return True
        except Exception:
            pass
        time.sleep(0.1)
    return False


# --- Главное окно с QWebEngineView ---
class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Crypto Trading Analyzer")
        self.resize(1200, 800)
        self.setMinimumSize(1200, 800)

        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        central.setLayout(layout)

        self.web = QWebEngineView()
        layout.addWidget(self.web)

        # Ускорение WebEngine
        self.web.settings().setAttribute(QWebEngineSettings.Accelerated2dCanvasEnabled, True)
        self.web.settings().setAttribute(QWebEngineSettings.WebGLEnabled, True)

        # WebChannel
        self.channel = QWebChannel()
        self.bridge = WebBridge()
        self.channel.registerObject("pyjs", self.bridge)
        self.web.page().setWebChannel(self.channel)

        # Загружаем страницу логина
        self.web.setUrl(QUrl("http://127.0.0.1:5050/login"))

        self.web.loadFinished.connect(self._on_page_load)

    def _on_page_load(self, ok):
        if not ok:
            print("Не удалось загрузить страницу")
            return


# --- Основной запуск ---
if __name__ == "__main__":
    def _resource_path(relative_path: str) -> str:
        try:
            base_path = sys._MEIPASS  # type: ignore[attr-defined]
        except Exception:
            base_path = os.path.abspath(".")
        return os.path.join(base_path, relative_path)

    # Запуск Flask в отдельном потоке
    threading.Thread(target=run_flask, daemon=True).start()
    print("Запуск Flask-сервера...")
    if not wait_for_server():
        print("⚠️ Сервер не доступен на http://127.0.0.1:5050")

    app_qt = QApplication(sys.argv)
    app_qt.setStyleSheet("QPushButton { outline: none; } QPushButton:focus { outline: none; }")

    try:
        icon_path = _resource_path(os.path.join("assets", "favicon.ico"))
        if not os.path.exists(icon_path):
            icon_path = os.path.join(os.path.abspath("."), "server-php", "public", "favicon.ico")
        APP_ICON = QIcon(icon_path)
        app_qt.setWindowIcon(APP_ICON)
    except Exception as e:
        APP_ICON = QIcon()
        print("⚠️ Не удалось установить иконку приложения:", e)

    main_window = MainWindow()
    try:
        main_window.setWindowIcon(APP_ICON)
    except Exception:
        pass
    main_window.show()

    sys.exit(app_qt.exec_())
