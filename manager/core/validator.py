"""项目校验器。

用于生成前检查项目完整性（project.md 第 7 节第 1 阶段：项目校验）。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

from .gg_format import FORMAT_VERSION, GalGenProject
from .models import (
    ASSET_CATEGORIES,
    ASSET_TYPES,
    DIALOG_TYPES,
    ENDING_TYPES,
    OPERATIONS,
)


@dataclass
class Issue:
    """一条校验问题。"""

    severity: str  # error / warning
    location: str
    message: str

    def __str__(self):
        return f"[{self.severity.upper()}] {self.location}: {self.message}"


class ProjectValidator:
    """对 GalGenProject 执行完整性校验，返回问题列表。"""

    def __init__(self, project: GalGenProject):
        self.project = project
        self.issues: List[Issue] = []

    # ------------------------------------------------------------------ 入口

    def validate(self) -> List[Issue]:
        self.issues.clear()
        self._check_format_version()
        self._check_meta()
        self._check_duplicate_ids()
        self._check_characters()
        self._check_scenes()
        self._check_assets()
        self._check_chapters()
        self._check_scripts()
        self._check_endings()
        self._check_references()
        return list(self.issues)

    # ------------------------------------------------------------------ 各检查项

    def _check_format_version(self):
        if self.project.format_version > FORMAT_VERSION:
            self._error("meta.format_version", f"格式版本 {self.project.format_version} 高于当前支持的 {FORMAT_VERSION}")

    def _check_meta(self):
        if not self.project.created_at:
            self._warning("meta.created_at", "缺少创建时间")
        if not self.project.updated_at:
            self._warning("meta.updated_at", "缺少最近修改时间")

    def _check_duplicate_ids(self):
        for name in ("characters", "scenes", "chapters", "scripts", "assets", "endings"):
            seen = set()
            for item in getattr(self.project, name):
                if item.id in seen:
                    self._error(name, f"重复的 ID：{item.id}")
                seen.add(item.id)

    def _check_characters(self):
        for c in self.project.characters:
            if not c.name:
                self._warning(c.id or "character", "角色缺少名称")

    def _check_scenes(self):
        for s in self.project.scenes:
            if not s.name:
                self._warning(s.id or "scene", "场景缺少名称")

    def _check_assets(self):
        for a in self.project.assets:
            loc = a.id or "asset"
            if a.type not in ASSET_TYPES:
                self._error(loc, f"非法资产类型：{a.type}")
            if a.category not in ASSET_CATEGORIES:
                self._error(loc, f"非法资产分类：{a.category}")
            if not a.file_name:
                self._warning(loc, "资产缺少文件名")
            if self.project.file_path and a.rel_path:
                path = self.project.project_dir() / a.rel_path
                if not Path(path).exists():
                    self._error(loc, f"资产文件不存在：{a.rel_path}")

    def _check_chapters(self):
        for ch in self.project.chapters:
            loc = ch.id or "chapter"
            if not ch.name:
                self._warning(loc, "章节缺少名称")
            if ch.start_script and not self.project.find_by_id("scripts", ch.start_script):
                self._error(loc, f"起始剧情不存在：{ch.start_script}")

    def _check_scripts(self):
        for sc in self.project.scripts:
            loc = sc.id or "script"
            dialog_ids = {d.id for d in sc.dialogs if d.id}
            if sc.dialogs and any(not d.id for d in sc.dialogs):
                self._error(loc, "存在缺少 ID 的对话")
            for d in sc.dialogs:
                dloc = f"{sc.id or 'script'}/{d.id or '?'}"
                if d.type not in DIALOG_TYPES:
                    self._error(dloc, f"非法对话类型：{d.type}")
                if d.type == "choice" and not d.options:
                    self._error(dloc, "选项类型对话缺少选项")
                for opt in d.options:
                    if opt.jump_to and opt.jump_to not in dialog_ids:
                        # 支持跨脚本跳转（jump_to 指向另一个脚本 ID）
                        if not self.project.find_by_id("scripts", opt.jump_to):
                            self._error(dloc, f"选项跳转目标不存在：{opt.jump_to}")
                    for e in opt.effects:
                        if not e.variable:
                            self._error(dloc, "效果缺少变量名")
                        if e.operation not in OPERATIONS:
                            self._error(dloc, f"非法操作：{e.operation}")
                        if e.target != "global" and not self.project.find_by_id("characters", e.target):
                            self._error(dloc, f"效果目标角色不存在：{e.target}")

    def _check_endings(self):
        for e in self.project.endings:
            loc = e.id or "ending"
            if e.ending_type not in ENDING_TYPES:
                self._error(loc, f"非法结局类型：{e.ending_type}")
            if not e.name:
                self._warning(loc, "结局缺少名称")

    def _check_references(self):
        self._check_reference("assets", "background", "scenes")
        self._check_reference("assets", "default_standee", "characters")
        self._check_reference("assets", "cg", "endings")
        self._check_chapter_branch_endings()
        self._check_dialog_asset_refs()
        self._check_character_refs()

    def _check_reference(self, ref_collection: str, attr: str, owner_collection: str):
        for owner in getattr(self.project, owner_collection):
            ref_id = getattr(owner, attr, "")
            if ref_id and not self.project.find_by_id(ref_collection, ref_id):
                self._error(f"{owner_collection}/{owner.id or '?'}", f"{attr} 引用不存在：{ref_id}")

    def _check_chapter_branch_endings(self):
        for ch in self.project.chapters:
            for br in ch.branches:
                if br.ending_id and not self.project.find_by_id("endings", br.ending_id):
                    self._error(f"chapters/{ch.id or '?'}", f"分支 {br.id or '?'} 指向的结局不存在：{br.ending_id}")

    def _check_dialog_asset_refs(self):
        for sc in self.project.scripts:
            for d in sc.dialogs:
                loc = f"scripts/{sc.id or '?'}/{d.id or '?'}"
                for attr in ("standee", "voice", "scene_id", "bgm"):
                    ref = getattr(d, attr)
                    if ref and not self.project.find_by_id("assets" if attr != "scene_id" else "scenes", ref):
                        self._error(loc, f"{attr} 引用不存在：{ref}")
                if d.character_id and not self.project.find_by_id("characters", d.character_id):
                    self._error(loc, f"角色引用不存在：{d.character_id}")

    def _check_character_refs(self):
        for c in self.project.characters:
            loc = f"characters/{c.id or '?'}"
            if c.default_standee and not self.project.find_by_id("assets", c.default_standee):
                self._error(loc, f"默认立绘引用不存在：{c.default_standee}")
            if c.voice and not self.project.find_by_id("assets", c.voice):
                self._error(loc, f"默认语音引用不存在：{c.voice}")
            for st in c.standees:
                if st.asset_id and not self.project.find_by_id("assets", st.asset_id):
                    self._error(loc, f"立绘「{st.name or st.asset_id}」引用不存在：{st.asset_id}")

    # ------------------------------------------------------------------ 辅助

    def _error(self, location: str, message: str):
        self.issues.append(Issue("error", location, message))

    def _warning(self, location: str, message: str):
        self.issues.append(Issue("warning", location, message))
