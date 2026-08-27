"""管理器本地配置（如上次打开的项目路径）。"""

from __future__ import annotations

import json
import os
from pathlib import Path

_CONFIG_DIR_NAME = ".galgen"
_CONFIG_FILE_NAME = "config.json"


def config_dir() -> Path:
    return Path.home() / _CONFIG_DIR_NAME


def config_file() -> Path:
    return config_dir() / _CONFIG_FILE_NAME


def load() -> dict:
    try:
        path = config_file()
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        pass
    return {}


def save(data: dict) -> None:
    try:
        config_dir().mkdir(parents=True, exist_ok=True)
        config_file().write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n"
        )
    except OSError:
        pass


def get_last_project() -> str:
    return load().get("last_project", "")


def set_last_project(path) -> None:
    cfg = load()
    cfg["last_project"] = str(path)
    save(cfg)
