import sys
import threading
import time
import base64
import requests
import os

import runpy


if __name__ == "__main__":
    _base_dir = os.path.dirname(os.path.abspath(__file__))
    _target = os.path.join(_base_dir, "crypto-analyzer", "desktop_app.py")
    if os.path.exists(_target):
        runpy.run_path(_target, run_name="__main__")
        raise SystemExit(0)

os.environ.setdefault("QT_OPENGL", "angle")
os.environ.setdefault(
    "QTWEBENGINE_CHROMIUM_FLAGS",
    "--use-gl=angle --use-angle=d3d11 --ignore-gpu-blocklist --disable-gpu-sandbox --no-sandbox --disable-gpu --disable-gpu-compositing",
)
os.environ.setdefault("QTWEBENGINE_DISABLE_SANDBOX", "1")

from PyQt5.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget, QFileDialog, QLabel, QPushButton
from PyQt5.QtCore import QObject, pyqtSlot, QUrl, Qt, QCoreApplication, QLibraryInfo, QTimer
from PyQt5.QtGui import QIcon

# импорт твоего backend Flask
from app import app  # Flask backend на 5050


_WEBENGINE_IMPORT_ERROR = None


def _setup_qt_runtime_paths():
    try:
        qt_bin = QLibraryInfo.location(QLibraryInfo.BinariesPath)
        qt_plugins = QLibraryInfo.location(QLibraryInfo.PluginsPath)
        if qt_bin and os.path.isdir(qt_bin):
            os.environ["PATH"] = qt_bin + os.pathsep + os.environ.get("PATH", "")
            process_path = os.path.join(qt_bin, "QtWebEngineProcess.exe")
            if os.path.exists(process_path):
                os.environ.setdefault("QTWEBENGINEPROCESS_PATH", process_path)
        if qt_plugins and os.path.isdir(qt_plugins):
            os.environ.setdefault("QT_PLUGIN_PATH", qt_plugins)
    except Exception:
        pass


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
        self.resize(1500, 900)
        self.setMinimumSize(1500, 900)

        self._initial_size_applied = False

        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        central.setLayout(layout)

        global _WEBENGINE_IMPORT_ERROR
        if _WEBENGINE_IMPORT_ERROR is not None:
            self._init_error_view(layout, e=_WEBENGINE_IMPORT_ERROR)
            return

        try:
            from PyQt5.QtWebEngineWidgets import QWebEngineView, QWebEngineSettings, QWebEngineProfile, QWebEnginePage
            from PyQt5.QtWebChannel import QWebChannel

            self.web = QWebEngineView()
            layout.addWidget(self.web)

            # ВАЖНО: это слой хранения браузера (cookies/localStorage) для "Запомнить меня".
            # НЕ ТРОГАТЬ авторизацию (логин/пароль/проверки) — только persistence WebEngine.
            base_root = os.environ.get('LOCALAPPDATA') or os.path.expanduser('~')
            base_dir = os.path.join(base_root, "CryptoInsightX", "qt_profile")
            os.makedirs(base_dir, exist_ok=True)

            self.profile = QWebEngineProfile("CryptoInsightX", self.web)
            self.profile.setPersistentStoragePath(base_dir)
            self.profile.setCachePath(base_dir)
            self.profile.setHttpCacheType(QWebEngineProfile.DiskHttpCache)
            self.profile.setPersistentCookiesPolicy(QWebEngineProfile.ForcePersistentCookies)

            self.page = QWebEnginePage(self.profile, self.web)
            self.web.setPage(self.page)

            self.web.settings().setAttribute(QWebEngineSettings.Accelerated2dCanvasEnabled, False)
            self.web.settings().setAttribute(QWebEngineSettings.WebGLEnabled, False)
            try:
                self.web.settings().setAttribute(QWebEngineSettings.SpellCheckEnabled, False)
            except Exception:
                pass

            try:
                self.profile.setSpellCheckEnabled(False)
            except Exception:
                try:
                    QWebEngineProfile.defaultProfile().setSpellCheckEnabled(False)
                except Exception:
                    pass

            self.channel = QWebChannel()
            self.bridge = WebBridge()
            self.channel.registerObject("pyjs", self.bridge)
            self.web.page().setWebChannel(self.channel)

            self.web.setUrl(QUrl("http://127.0.0.1:5050/login"))
            self.web.loadFinished.connect(self._on_page_load)
        except Exception as e:
            self._init_error_view(layout, e=e)

    def _apply_initial_size(self):
        try:
            self.resize(1500, 900)
            self.setMinimumSize(1500, 900)
        except Exception:
            pass

    def showEvent(self, event):
        try:
            if not self._initial_size_applied:
                self._initial_size_applied = True
                self._apply_initial_size()
                QTimer.singleShot(0, self._apply_initial_size)
        except Exception:
            pass
        return super().showEvent(event)

    def _init_error_view(self, layout, e=None):
        import webbrowser

        info = QLabel(
            "Не удалось запустить встроенный WebEngine (проблема с OpenGL/ANGLE DLL).\n"
            "Нужно, чтобы были доступны libEGL.dll/libGLESv2.dll/d3dcompiler_*.dll (обычно в папке Qt/PyQt5)."
        )
        info.setStyleSheet("padding:20px; white-space: pre-line;")

        btn = QPushButton("Открыть в браузере")
        btn.clicked.connect(lambda: webbrowser.open("http://127.0.0.1:5050/login"))

        wrap = QWidget()
        v = QVBoxLayout()
        v.addWidget(info)
        v.addWidget(btn)
        wrap.setLayout(v)
        layout.addWidget(wrap)

        if e is not None:
            try:
                print("WebEngine init error:", repr(e))
            except Exception:
                pass

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
            base_path = os.path.dirname(os.path.abspath(__file__))
        return os.path.join(base_path, relative_path)

    # Запуск Flask в отдельном потоке
    threading.Thread(target=run_flask, daemon=True).start()
    print("Запуск Flask-сервера...")
    if not wait_for_server():
        print("⚠️ Сервер не доступен на http://127.0.0.1:5050")

    _setup_qt_runtime_paths()
    QCoreApplication.setAttribute(Qt.AA_ShareOpenGLContexts, True)

    try:
        from PyQt5 import QtWebEngineWidgets  # noqa: F401
        _WEBENGINE_IMPORT_ERROR = None
    except Exception as e:
        _WEBENGINE_IMPORT_ERROR = e

    app_qt = QApplication(sys.argv)
    app_qt.setStyleSheet("QPushButton { outline: none; } QPushButton:focus { outline: none; }")

    try:
        icon_path = _resource_path(os.path.join("assets", "favicon.ico"))
        if not os.path.exists(icon_path):
            _here = os.path.dirname(os.path.abspath(__file__))
            icon_path = os.path.join(_here, "server-php", "public", "favicon.ico")
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
