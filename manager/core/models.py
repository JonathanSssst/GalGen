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
    font_cn: str = "微软雅黑"
    font_en: str = "Microsoft YaHei"
    font_size: int = 24
    window_width: int = 1280
    window_height: int = 720


@dataclass
class ProjectInfo:
    """项目设置，对应 .gg 中 data.project。

    version 字段：字符串形式（如 1.0.2）；同时以 version_major/minor/patch
    结构化存储，便于设置页分栏编辑。auto_patch_on_save / auto_minor_on_build
    控制版本自动递增开关。
    """

    name: str = "未命名项目"
    author: str = ""
    version: str = "1.0.0"
    version_major: int = 1
    version_minor: int = 0
    version_patch: int = 0
    description: str = ""
    auto_patch_on_save: bool = True
    auto_minor_on_build: bool = True
    exe_icon: str = ""
    defaults: ProjectDefaults = field(default_factory=ProjectDefaults)

    def sync_version(self) -> None:
        """将 version 字符串与 major/minor/patch 同步（以结构化字段为准）。"""
        self.version = f"{self.version_major}.{self.version_minor}.{self.version_patch}"


@dataclass
class CharacterStandee:
    """角色立绘项：名称（如 normal/happy）+ 引用资产 ID。"""

    name: str = ""
    asset_id: str = ""


@dataclass
class Character:
    """角色，对应 .gg 中 data.characters 数组元素。

    labels：显示名列表（如「孩子」「康斯坦丁」），用于剧情中作为 speaker_label
    下拉选项，覆盖角色默认名显示。
    standees：立绘列表（列表式管理，取代旧的 expressions 表情映射）。
    default_standee：默认立绘资产 ID（保持兼容）。
    """

    id: str = ""
    name: str = ""
    description: str = ""
    personality: str = ""
    variables: dict = field(default_factory=dict)
    constants: dict = field(default_factory=dict)
    default_standee: str = ""
    standees: List[CharacterStandee] = field(default_factory=list)
    voice: str = ""
    labels: List[str] = field(default_factory=list)


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
    """选项。

    action_id：引用的全局函数 ID（v2.1 起）。旧字段 jump_to / effects /
    unlock_* / ending_id 保留用于读取旧文件，编辑器隐藏，保存时写入函数。
    """

    id: str = ""
    content: str = ""
    action_id: str = ""
    jump_to: str = ""
    effects: List[Effect] = field(default_factory=list)
    unlock_cg: str = ""
    unlock_script: str = ""
    ending_id: str = ""


@dataclass
class SoundEffect:
    """音效模块（sfx 类型剧情使用）。

    play_mode：play（播放后立即下一条）/ play_and_wait（播完再下一条）/
    loop_until（循环直到 stop_script_id 剧情）。
    exclusive（互斥）：有其它声音（角色语音/视频）播放时暂停，停止后恢复。
    """

    id: str = ""
    play_mode: str = "play"  # play / play_and_wait / loop_until
    asset_id: str = ""
    fade_in: float = 0.0
    fade_out: float = 0.0
    rate: float = 1.0
    exclusive: bool = True
    stop_script_id: str = ""


@dataclass
class Dialog:
    """一条对话单元（text / choice / sfx / video）。

    - 一条剧情（Script）对应一个 Dialog；
    - speaker_label：说话者显示名覆盖，为空用角色名；
    - actions：功能引用列表（仅 text / choice 可用），引用全局函数；
    - sfx：音效模块列表（sfx 类型使用）；
    - video_asset_id：视频资产（video 类型使用）。
    """

    id: str = ""
    type: str = "text"  # text / choice / sfx / video
    character_id: str = ""
    speaker_label: str = ""
    standee: str = ""
    expression: str = ""
    voice: str = ""
    scene_id: str = ""
    content: str = ""
    options: List[Option] = field(default_factory=list)
    actions: List[str] = field(default_factory=list)
    sfx: List[SoundEffect] = field(default_factory=list)
    video_asset_id: str = ""
    video_skippable: bool = True


@dataclass
class Script:
    """剧情 = 一个对话单元（text / choice / sfx / video）。

    order：同章节内播放顺序（游戏端按章节 order + 剧情 order 自动推进）。
    兼容旧文件：旧脚本可能含多条 dialogs，加载时拆分为多个单条剧情。
    """

    id: str = ""
    chapter_id: str = ""
    order: int = 0
    dialogs: List[Dialog] = field(default_factory=list)


@dataclass
class Function:
    """函数（动作集合），供剧情/选项引用。

    包含：跳转、解锁结局/隐藏剧情/隐藏CG、修改变量。一个函数可组合多个动作。
    """

    id: str = ""
    name: str = ""
    description: str = ""
    jump_to: str = ""
    unlock_cg: str = ""
    unlock_script: str = ""
    ending_id: str = ""
    effects: List[Effect] = field(default_factory=list)


@dataclass
class Asset:
    """资产。"""

    id: str = ""
    type: str = "image"  # image / audio / video
    category: str = "bg"  # bg / scene / standee / cg / ui / bgm / se / voice / video / ico
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
DIALOG_TYPES = ("text", "choice", "sfx", "video")
SFX_PLAY_MODES = ("play", "play_and_wait", "loop_until")
OPERATIONS = ("add", "sub", "set")
ENDING_TYPES = ("good", "bad", "normal", "hidden")
ASSET_TYPES = ("image", "audio", "video")
ASSET_CATEGORIES = ("bg", "scene", "standee", "cg", "ui", "bgm", "se", "voice", "video", "ico")
ID_PREFIXES = {
    "characters": "char",
    "scenes": "scene",
    "chapters": "chap",
    "scripts": "script",
    "assets": "asset",
    "endings": "end",
    "functions": "fn",
}
