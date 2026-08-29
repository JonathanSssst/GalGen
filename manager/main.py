"""GalGen 管理器入口（pywebview）。"""

import sys
from pathlib import Path

import webview

from .web.api import Api

WEB_DIR = Path(__file__).resolve().parent / "web"


def main():
    api = Api()

    def on_loaded():
        try:
            webview.windows[0].maximize()
        except Exception:
            pass

    window = webview.create_window(
        "GalGen 管理器",
        url=str(WEB_DIR / "index.html"),
        js_api=api,
        width=1280,
        height=800,
        min_size=(960, 640),
        background_color="#f4f6fa",
    )
    webview.start(on_loaded)


if __name__ == "__main__":
    main()
