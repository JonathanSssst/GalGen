"""GalGen 项目容器与 .gg 文件读写。

格式规范见 project.md 4.1 节：
- 编码 UTF-8（无 BOM）、换行 LF、JSON、缩进 2 空格、字段 snake_case。
"""

from __future__ import annotations

import dataclasses
import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import List, Type, TypeVar, get_args, get_origin, get_type_hints

from .models import (
    Asset,
    Branch,
    Chapter,
    Character,
    CharacterStandee,
    Dialog,
    Effect,
    Ending,
    Option,
    ProjectDefaults,
    ProjectInfo,
    Scene,
    Script,
)

T = TypeVar("T")

FORMAT_VERSION = 1
GENERATOR = "GalGen"

_ID_PATTERN = re.compile(r"^([a-z]+)_(\d+)$")


def now_iso() -> str:
    """返回带时区的 ISO 8601 时间字符串。"""
    return datetime.now().astimezone().isoformat()


def from_dict(cls: Type[T], data) -> T:
    """将 dict 递归转换为 dataclass 实例（含嵌套 dataclass / 列表 / 字典）。

    get_type_hints 结果按类缓存，避免为每个实例重复求值注解（显著提速）。
    """
    if data is None:
        return cls()
    if isinstance(data, cls):
        return data
    if dataclasses.is_dataclass(cls):
        hints = _type_hints_cached(cls)
        kwargs = {}
        for name in cls.__dataclass_fields__:
            if name in data:
                kwargs[name] = _convert(data[name], hints.get(name))
        return cls(**kwargs)
    return data


_TYPE_HINTS_CACHE: dict = {}


def _type_hints_cached(cls) -> dict:
    hints = _TYPE_HINTS_CACHE.get(cls)
    if hints is None:
        hints = get_type_hints(cls)
        _TYPE_HINTS_CACHE[cls] = hints
    return hints


def _convert(val, hint):
    if val is None or hint is None:
        return val
    origin = get_origin(hint)
    if origin is list:
        item = get_args(hint)[0]
        if dataclasses.is_dataclass(item):
            return [from_dict(item, v) for v in val]
        return val
    if origin is dict:
        _, val_t = get_args(hint)
        if dataclasses.is_dataclass(val_t):
            return {k: from_dict(val_t, v) for k, v in val.items()}
        return val
    if dataclasses.is_dataclass(hint):
        return from_dict(hint, val)
    return val


def _parse_version(value) -> tuple:
    """将版本字符串解析为 (major, minor, patch)；解析失败返回 (1, 0, 0)。"""
    m = re.match(r"^\s*(\d+)(?:[.\-_](\d+))?(?:[.\-_](\d+))?", str(value or ""))
    if not m:
        return (1, 0, 0)
    major = int(m.group(1) or 1)
    minor = int(m.group(2) or 0)
    patch = int(m.group(3) or 0)
    return (major, minor, patch)


def _project_from_dict(raw: dict) -> ProjectInfo:
    """项目设置构造，兼容旧格式：
    - version 字符串缺省结构字段时解析填充 major/minor/patch；
    - defaults.font 旧字段迁移为 font_cn / font_en。
    """
    raw = raw or {}
    project = from_dict(ProjectInfo, raw)
    if raw.get("version") and not raw.get("version_major") and "version_major" not in raw:
        major, minor, patch = _parse_version(raw.get("version"))
        project.version_major = major
        project.version_minor = minor
        project.version_patch = patch
    defaults = raw.get("defaults", {}) or {}
    if "font" in defaults and "font_cn" not in defaults:
        project.defaults.font_cn = defaults.get("font", "微软雅黑") or "微软雅黑"
        project.defaults.font_en = "Microsoft YaHei"
    return project


def _character_from_dict(raw: dict) -> Character:
    """角色构造，兼容旧格式：旧 expressions 映射迁移为 standees 列表。"""
    raw = raw or {}
    char = from_dict(Character, raw)
    expressions = raw.get("expressions") or {}
    if expressions and not raw.get("standees"):
        standees = []
        for name, asset_id in expressions.items():
            if isinstance(asset_id, str) and asset_id:
                standees.append(CharacterStandee(name=name, asset_id=asset_id))
        char.standees = standees
        if not char.default_standee:
            char.default_standee = expressions.get("normal") or next(iter(expressions.values()), "")
    return char


@dataclasses.dataclass
class GalGenProject:
    """内存中的项目容器，对应 .gg 文件整体（meta + data）。"""

    format_version: int = FORMAT_VERSION
    generator: str = GENERATOR
    generator_version: str = "1.0.0"
    created_at: str = ""
    updated_at: str = ""

    project: ProjectInfo = dataclasses.field(default_factory=ProjectInfo)
    characters: List[Character] = dataclasses.field(default_factory=list)
    scenes: List[Scene] = dataclasses.field(default_factory=list)
    chapters: List[Chapter] = dataclasses.field(default_factory=list)
    scripts: List[Script] = dataclasses.field(default_factory=list)
    assets: List[Asset] = dataclasses.field(default_factory=list)
    endings: List[Ending] = dataclasses.field(default_factory=list)

    # 非序列化字段
    file_path: str = dataclasses.field(default="", repr=False, compare=False)

    # ------------------------------------------------------------------ 构造

    @classmethod
    def new(cls) -> "GalGenProject":
        """新建项目，初始化 meta 时间戳。"""
        now = now_iso()
        return cls(created_at=now, updated_at=now)

    # ------------------------------------------------------------------ 序列化

    def to_dict(self) -> dict:
        meta = {
            "format_version": self.format_version,
            "generator": self.generator,
            "generator_version": self.generator_version,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        # 版本同步：以结构化字段为准刷新 version 字符串
        self.project.sync_version()
        data = {
            "project": dataclasses.asdict(self.project),
            "characters": [dataclasses.asdict(c) for c in self.characters],
            "scenes": [dataclasses.asdict(s) for s in self.scenes],
            "chapters": [dataclasses.asdict(c) for c in self.chapters],
            "scripts": [dataclasses.asdict(s) for s in self.scripts],
            "assets": [dataclasses.asdict(a) for a in self.assets],
            "endings": [dataclasses.asdict(e) for e in self.endings],
        }
        return {"meta": meta, "data": data}

    @classmethod
    def from_dict(cls, raw: dict) -> "GalGenProject":
        meta = raw.get("meta", {}) or {}
        data = raw.get("data", {}) or {}
        project_raw = data.get("project", {}) or {}
        project = _project_from_dict(project_raw)
        return cls(
            format_version=meta.get("format_version", FORMAT_VERSION),
            generator=meta.get("generator", GENERATOR),
            generator_version=meta.get("generator_version", "1.0.0"),
            created_at=meta.get("created_at", ""),
            updated_at=meta.get("updated_at", ""),
            project=project,
            characters=[_character_from_dict(c) for c in data.get("characters", [])],
            scenes=[from_dict(Scene, s) for s in data.get("scenes", [])],
            chapters=[from_dict(Chapter, c) for c in data.get("chapters", [])],
            scripts=[from_dict(Script, s) for s in data.get("scripts", [])],
            assets=[from_dict(Asset, a) for a in data.get("assets", [])],
            endings=[from_dict(Ending, e) for e in data.get("endings", [])],
        )

    # ------------------------------------------------------------------ 读写

    def save(self, path=None) -> None:
        """写入 .gg 文件：UTF-8 无 BOM、LF 换行、缩进 2 空格。"""
        path = Path(path) if path else Path(self.file_path)
        if not str(path).endswith(".gg"):
            path = path.with_suffix(".gg")
        self.updated_at = now_iso()
        content = json.dumps(self.to_dict(), ensure_ascii=False, indent=2)
        path.write_text(content, encoding="utf-8", newline="\n")
        self.file_path = str(path)

    @classmethod
    def load(cls, path) -> "GalGenProject":
        """从 .gg 文件加载项目。"""
        path = Path(path)
        raw = json.loads(path.read_text(encoding="utf-8"))
        proj = cls.from_dict(raw)
        proj.file_path = str(path)
        return proj

    # ------------------------------------------------------------------ ID 生成

    def next_id(self, collection_name: str) -> str:
        """生成「前缀 + 递增序号」的 ID，如 char_0001（见 project.md 4.4 节）。"""
        items = getattr(self, collection_name)
        prefix = {
            "characters": "char",
            "scenes": "scene",
            "chapters": "chap",
            "scripts": "script",
            "assets": "asset",
            "endings": "end",
        }[collection_name]
        max_n = 0
        for item in items:
            m = _ID_PATTERN.match(item.id or "")
            if m and m.group(1) == prefix:
                max_n = max(max_n, int(m.group(2)))
        n = max_n + 1
        width = max(4, len(str(n)))
        return f"{prefix}_{n:0{width}d}"

    # ------------------------------------------------------------------ 常用查询

    def find_by_id(self, collection_name: str, item_id: str):
        for item in getattr(self, collection_name):
            if item.id == item_id:
                return item
        return None

    def project_dir(self) -> Path:
        """项目文件所在目录；未保存时返回空路径。"""
        return Path(self.file_path).parent if self.file_path else Path()

    def asset_path(self, asset: Asset) -> Path:
        """根据资产 rel_path 计算磁盘绝对路径（相对项目目录）。"""
        return self.project_dir() / asset.rel_path if self.file_path else Path(asset.rel_path)

    @property
    def is_dirty(self) -> bool:
        return False
