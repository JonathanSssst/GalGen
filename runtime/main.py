"""游戏端入口：装配并启动 pywebview 游戏窗口。

用法：
    python -m runtime <项目.gg>
    或省略参数，自动打开最近一次在管理器中使用的项目。
"""

import argparse
import sys
import tempfile
from pathlib import Path

import webview

from manager.core import config as config_core
from manager.core.gg_format import GalGenProject
from runtime.game_api import GameApi
from runtime.stage import build_stage


def main(argv=None):
    parser = argparse.ArgumentParser(description="GalGen 游戏端")
    parser.add_argument("project", nargs="?", help=".gg 项目文件路径")
    args = parser.parse_args(argv)

    path = args.project
    if not path:
        path = config_core.get_last_project()
    if not path or not Path(path).exists():
        print("未找到项目文件。用法：python -m runtime <项目.gg>")
        return 1

    project = GalGenProject.load(path)
    stage_dir = build_stage(project, Path(tempfile.gettempdir()) / "galgen_runtime")
    index = stage_dir / "index.html"

    window = webview.create_window(
        f"{project.project.name or '未命名项目'} - GalGen",
        url=str(index),
        fullscreen=True,
        min_size=(800, 600),
        background_color="#1a1d24",
        js_api=GameApi(),
    )
    webview.start()
    return 0


if __name__ == "__main__":
    sys.exit(main())
