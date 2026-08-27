"""数据模型。

对应 project.md 第 4.1 节定义的 .gg 文件格式。所有字段使用 snake_case。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List


@dataclass
class ProjectDefaults:
    """游戏端默认配置，对应 .gg 中 project.defaults。"""

    text_speed: int = 30
    auto_advance_delay: float = 3.0
    font: str = "微软雅黑"
    font_size: int = 24
    window_width: int = 1280
    window_height: int = 720


@dataclass
class ProjectInfo:
    """项目设置，对应 .gg 中 data.project。"""

    name: str = "未命名项目"
    author: str = ""
    version: str = "1.0.0"
    description: str = ""
    defaults: ProjectDefaults = field(default_factory=ProjectDefaults)


@dataclass
class Character:
    """角色，对应 .gg 中 data.characters 数组元素。"""

    id: str = ""
    name: str = ""
    description: str = ""
    personality: str = ""
    variables: dict = field(default_factory=dict)
    constants: dict = field(default_factory=dict)
    default_standee: str = ""
    expressions: dict = field(default_factory=dict)
    voice: str = ""


@dataclass
class Scene:
    """场景，对应 .gg 中 data.scenes 数组元素。"""

    id: str = ""
    name: str = ""
    background: str = ""
    description: str = ""


@dataclass
class Branch:
    """章节分支，每个分支指向一个结局。"""

    id: str = ""
    name: str = ""
    condition: str = ""
    ending_id: str = ""


@dataclass
class Chapter:
    """章节，对应 .gg 中 data.chapters 数组元素。"""

    id: str = ""
    name: str = ""
    order: int = 1
    start_script: str = ""
    branches: List[Branch] = field(default_factory=list)


@dataclass
class Effect:
    """变量修改效果。"""

    target: str = "global"
    variable: str = ""
    operation: str = "add"  # add / sub / set
    value: int = 0


@dataclass
class Option:
    """选项。"""

    id: str = ""
    content: str = ""
    jump_to: str = ""
    effects: List[Effect] = field(default_factory=list)
    unlock_cg: str = ""
    unlock_script: str = ""
    ending_id: str = ""


@dataclass
class Dialog:
    """一条对话，text 或 choice 类型。"""

    id: str = ""
    type: str = "text"  # text / choice
    character_id: str = ""
    standee: str = ""
    expression: str = ""
    voice: str = ""
    scene_id: str = ""
    bgm: str = ""
    content: str = ""
    options: List[Option] = field(default_factory=list)


@dataclass
class Script:
    """剧情，包含一组按顺序播放的对话。"""

    id: str = ""
    chapter_id: str = ""
    dialogs: List[Dialog] = field(default_factory=list)


@dataclass
class Asset:
    """资产。"""

    id: str = ""
    type: str = "image"  # image / audio / video
    category: str = "bg"  # bg / scene / standee / cg / ui / bgm / se / voice / video
    file_name: str = ""
    rel_path: str = ""
    tags: List[str] = field(default_factory=list)
    created_at: str = ""
    reference_count: int = 0


@dataclass
class Ending:
    """结局。"""

    id: str = ""
    name: str = ""
    ending_type: str = "good"  # good / bad / normal / hidden
    description: str = ""
    cg: str = ""
    is_hidden: bool = False


# 枚举取值约束（与 project.md 4.1 节一致），供校验与 UI 使用。
DIALOG_TYPES = ("text", "choice")
OPERATIONS = ("add", "sub", "set")
ENDING_TYPES = ("good", "bad", "normal", "hidden")
ASSET_TYPES = ("image", "audio", "video")
ASSET_CATEGORIES = ("bg", "scene", "standee", "cg", "ui", "bgm", "se", "voice", "video")
ID_PREFIXES = {
    "characters": "char",
    "scenes": "scene",
    "chapters": "chap",
    "scripts": "script",
    "assets": "asset",
    "endings": "end",
}
