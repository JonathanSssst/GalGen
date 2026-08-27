"""打包后游戏端入口（由 builder 复制进发布目录，自包含无外部项目依赖）。

通过 sys._MEIPASS 定位打包内嵌的资源（index.html、css、js、data.json、assets）。
"""

import json
import os
import sys

import webview


class _GameApi:
    def quit(self) -> None:
        try:
            webview.windows[0].destroy()
        except Exception:
            pass

    def toggle_fullscreen(self) -> None:
        try:
            webview.windows[0].toggle_fullscreen()
        except Exception:
            pass


def resource_path(relative: str) -> str:
    base = getattr(sys, "_MEIPASS", os.path.abspath(os.path.dirname(__file__)))
    return os.path.join(base, relative)


def main():
    title = "GalGen 游戏"
    try:
        data_path = resource_path("data.json")
        if os.path.exists(data_path):
            with open(data_path, encoding="utf-8") as f:
                title = (json.load(f).get("_project_name") or title) + " - GalGen"
    except Exception:
        pass

    webview.create_window(
        title,
        url=resource_path("index.html"),
        js_api=_GameApi(),
        fullscreen=True,
        min_size=(800, 600),
        background_color="#1a1d24",
    )
    webview.start()


if __name__ == "__main__":
    main()
