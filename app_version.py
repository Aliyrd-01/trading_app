import os

APP_NAME = "Crypto Trading Analyzer"
APP_VERSION = "1.1.7"

DEFAULT_UPDATE_MANIFEST_URL = "https://cryptoanalyz.net/downloads/latest.json"
UPDATE_MANIFEST_URL = os.getenv("CRYPTOINSIGHTX_UPDATE_MANIFEST_URL", DEFAULT_UPDATE_MANIFEST_URL)



