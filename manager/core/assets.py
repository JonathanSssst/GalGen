"""资产文件管理：上传、分类目录、Asset 记录创建。"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import List

from .gg_format import GalGenProject, now_iso
from .models import ASSET_TYPES, Asset

# 各分类对应的子目录与默认资产类型（类型主要按扩展名推断）。
CATEGORY_DIRS = {
    "bg": ("images/bg", "image"),
    "scene": ("images/scene", "image"),
    "standee": ("images/standee", "image"),
    "cg": ("images/cg", "image"),
    "ui": ("images/ui", "image"),
    "bgm": ("audio/bgm", "audio"),
    "se": ("audio/se", "audio"),
    "voice": ("audio/voice", "audio"),
    "video": ("video", "video"),
    "ico": ("images/ico", "image"),
}

_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".ico"}
_AUDIO_EXT = {".mp3", ".ogg", ".wav"}
_VIDEO_EXT = {".mp4", ".webm"}


def infer_asset_type(file_name: str) -> str:
    """根据扩展名推断资产类型；无法识别时返回 'image'。"""
    ext = Path(file_name).suffix.lower()
    if ext in _AUDIO_EXT:
        return "audio"
    if ext in _VIDEO_EXT:
        return "video"
    return "image"


def is_supported_file(file_name: str) -> bool:
    ext = Path(file_name).suffix.lower()
    return ext in _IMAGE_EXT or ext in _AUDIO_EXT or ext in _VIDEO_EXT


def import_asset(project: GalGenProject, src_path, category: str, tags: List[str] = None) -> Asset:
    """将外部文件复制进项目资产目录，并创建 Asset 记录。

    要求项目已保存（存在 file_path），否则无法确定相对路径。
    """
    if not project.file_path:
        raise ValueError("项目尚未保存，无法导入资产，请先保存项目")

    src = Path(src_path)
    if not src.is_file():
        raise FileNotFoundError(f"源文件不存在：{src}")

    category = category if category in CATEGORY_DIRS else "bg"
    subdir, default_type = CATEGORY_DIRS[category]

    type_ = infer_asset_type(src.name)
    if type_ not in ASSET_TYPES:
        type_ = default_type

    # 目标文件名为「前缀_原始名」，避免不同分类目录下同名冲突。
    dest_dir = project.project_dir() / "assets" / subdir
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / src.name
    dest = _unique_path(dest)

    shutil.copy2(src, dest)

    rel = dest.relative_to(project.project_dir()).as_posix()
    asset = Asset(
        id=project.next_id("assets"),
        type=type_,
        category=category,
        file_name=src.name,
        rel_path=rel,
        tags=list(tags or []),
        created_at=now_iso(),
        reference_count=0,
    )
    project.assets.append(asset)
    return asset


def remove_asset_file(project: GalGenProject, asset: Asset) -> None:
    """删除资产对应的磁盘文件（不影响项目记录本身）。"""
    if asset.rel_path:
        path = project.asset_path(asset)
        if path.exists():
            path.unlink()


def reclassify_asset(project: GalGenProject, asset: Asset, new_category: str) -> Asset:
    """更改资产分类，并将磁盘文件迁移到对应分类目录，同步更新 rel_path。"""
    if new_category not in CATEGORY_DIRS:
        raise ValueError(f"未知分类：{new_category}")
    if asset.category == new_category:
        return asset

    subdir, _ = CATEGORY_DIRS[new_category]
    old_path = project.asset_path(asset)
    new_dir = project.project_dir() / "assets" / subdir
    new_dir.mkdir(parents=True, exist_ok=True)
    new_path = _unique_path(new_dir / asset.file_name)

    if old_path.exists():
        old_path.replace(new_path)

    asset.category = new_category
    asset.rel_path = new_path.relative_to(project.project_dir()).as_posix()
    return asset


def _unique_path(path: Path) -> Path:
    if not path.exists():
        return path
    n = 1
    while True:
        candidate = path.with_name(f"{path.stem}_{n}{path.suffix}")
        if not candidate.exists():
            return candidate
        n += 1
