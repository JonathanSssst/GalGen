"""游戏端装配：将 .gg 项目与资产复制为可运行的 Web 发布目录。

对应 project.md 第 7 节「组装」阶段（开发态预览版）。
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from manager.core.gg_format import GalGenProject

WEB_DIR = Path(__file__).resolve().parent / "web"


def build_stage(project: GalGenProject, out_dir) -> Path:
    """生成发布目录：Web 前端 + data.json + assets/。返回目录路径。"""
    out = Path(out_dir)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True, exist_ok=True)

    shutil.copytree(WEB_DIR, out, dirs_exist_ok=True)

    asset_dir = out / "assets"
    asset_dir.mkdir(exist_ok=True)
    asset_map = {}
    for asset in project.assets:
        src = project.asset_path(asset)
        if src.exists():
            dest_name = f"{asset.id}{src.suffix.lower()}"
            shutil.copy2(src, asset_dir / dest_name)
            asset_map[asset.id] = f"assets/{dest_name}"

    data = project.to_dict()["data"]
    data["_asset_map"] = asset_map
    data["_project_name"] = project.project.name or "未命名项目"
    (out / "data.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n"
    )
    return out
