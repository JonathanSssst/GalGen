"""游戏端后端 API：窗口控制等由前端调用。"""

from __future__ import annotations

import webview


class GameApi:
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
