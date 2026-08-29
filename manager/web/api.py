"""pywebview 后端桥接层（JS API）。

前端通过 window.pywebview.api 调用这些方法。所有返回值为 JSON 可序列化的
基本类型 / dict / list。文件对话框通过可注入的 dialog 回调实现，便于单元测试。
"""

from __future__ import annotations

import base64
import os
import threading
from pathlib import Path
from typing import Callable, Optional

from ..builder import build as build_mod
from ..core import ai as ai_core
from ..core import assets as assets_core
from ..core import config as config_core
from ..core import export as export_core
from ..core import fonts as fonts_core
from ..core import references as refs_core
from ..core.gg_format import FORMAT_VERSION, GalGenProject, from_dict, now_iso
from ..core.models import Asset, Character, Chapter, Dialog, Effect, Ending, Option, ProjectInfo, Scene, Script
from ..core.validator import ProjectValidator

DEFAULT_FILE_TYPES = ("GalGen 项目 (*.gg)",)
ASSET_FILE_TYPES = (
    "支持的文件 (*.png;*.jpg;*.jpeg;*.webp;*.mp3;*.ogg;*.wav;*.mp4;*.webm)",
)
TXT_FILE_TYPES = ("文本文件 (*.txt)",)

# 顶层 data 各集合与模型的映射，用于 set_data 应用数据。
_COLLECTION_MODELS = {
    "project": ProjectInfo,
    "characters": Character,
    "scenes": Scene,
    "chapters": Chapter,
    "scripts": Script,
    "assets": Asset,
    "endings": Ending,
}


class Api:
    def __init__(self, dialog: Optional[Callable] = None):
        # dialog(kind, **kwargs) -> str 或 None；kind 为 "open" / "save"
        self._dialog = dialog
        self.project: Optional[GalGenProject] = None
        self.dirty = False
        self._build: Optional[dict] = None
        self._ai: Optional[dict] = None

    # ------------------------------------------------------------------ 对话框

    def _ask(self, kind: str, **kwargs) -> Optional[str]:
        if self._dialog is None:
            try:
                import webview

                win = webview.windows[0]
                file_types = kwargs.get("file_types", DEFAULT_FILE_TYPES)
                if kind == "open":
                    result = win.create_file_dialog(webview.FileDialog.OPEN, file_types=file_types)
                else:
                    result = win.create_file_dialog(
                        webview.FileDialog.SAVE,
                        save_filename=kwargs.get("save_filename", ""),
                        file_types=file_types,
                    )
                return result[0] if result else None
            except Exception:
                return None
        return self._dialog(kind, **kwargs)

    # ------------------------------------------------------------------ 项目生命周期

    def new_project(self) -> Optional[dict]:
        self.project = GalGenProject.new()
        self.dirty = False
        return self._payload()

    def open_project(self) -> Optional[dict]:
        path = self._ask("open", file_types=DEFAULT_FILE_TYPES)
        if not path:
            return None
        return self.load_path(path)

    def load_path(self, path: str) -> Optional[dict]:
        try:
            self.project = GalGenProject.load(path)
        except Exception as exc:
            return {"error": str(exc)}
        config_core.set_last_project(path)
        self.dirty = False
        return self._payload()

    def save_project(self) -> bool:
        if not self.project:
            return False
        if not self.project.file_path:
            return self.save_project_as()
        self._bump_patch()
        self.project.save()
        self.dirty = False
        return True

    def save_project_as(self) -> bool:
        if not self.project:
            return False
        name = self.project.project.name or "项目"
        path = self._ask("save", save_filename=f"{name}.gg", file_types=DEFAULT_FILE_TYPES)
        if not path:
            return False
        self._bump_patch()
        self.project.save(path)
        config_core.set_last_project(path)
        self.dirty = False
        return True

    def _bump_patch(self) -> None:
        """按设置自动递增小版本（保存时）。"""
        p = self.project.project
        if getattr(p, "auto_patch_on_save", True):
            p.version_patch = (p.version_patch or 0) + 1
            p.sync_version()

    def _bump_minor(self) -> None:
        """按设置自动递增大版本并清零小版本（生成 exe 时）。"""
        p = self.project.project
        if getattr(p, "auto_minor_on_build", True):
            p.version_minor = (p.version_minor or 0) + 1
            p.version_patch = 0
            p.sync_version()

    def get_last_project(self) -> str:
        return config_core.get_last_project()

    def set_window_title(self, title: str) -> None:
        try:
            import webview

            webview.windows[0].set_title(title)
        except Exception:
            pass

    def is_dirty(self) -> bool:
        return bool(self.dirty)

    # ------------------------------------------------------------------ 数据

    def get_data(self) -> Optional[dict]:
        return self._payload()

    def set_data(self, data: dict) -> bool:
        if not self.project or not isinstance(data, dict):
            return False
        for key, model in _COLLECTION_MODELS.items():
            if key not in data:
                continue
            if key == "project":
                self.project.project = from_dict(ProjectInfo, data[key])
            elif isinstance(data[key], list):
                items = [from_dict(model, item) for item in data[key]]
                setattr(self.project, {
                    "project": "project", "characters": "characters", "scenes": "scenes",
                    "chapters": "chapters", "scripts": "scripts", "assets": "assets", "endings": "endings",
                }.get(key, key), items)
        self.dirty = True
        return True

    def next_id(self, collection: str) -> str:
        if not self.project:
            return ""
        return self.project.next_id(collection)

    # ------------------------------------------------------------------ 资产

    def upload_asset(self, category: str) -> Optional[dict]:
        if not self.project:
            return {"error": "尚未创建项目"}
        if not self.project.file_path:
            # 尚未保存：先自动引导保存，再导入资产
            if not self.save_project_as():
                return None
        path = self._ask("open", file_types=ASSET_FILE_TYPES)
        if not path:
            return None
        try:
            asset = assets_core.import_asset(self.project, path, category=category)
        except Exception as exc:
            return {"error": str(exc)}
        self.dirty = True
        return _asset_to_dict(asset)

    def delete_asset(self, asset_id: str) -> bool:
        asset = self.project.find_by_id("assets", asset_id) if self.project else None
        if not asset:
            return False
        assets_core.remove_asset_file(self.project, asset)
        self.project.assets.remove(asset)
        self.dirty = True
        return True

    def change_asset_category(self, asset_id: str, category: str) -> bool:
        """更改资产分类（同时迁移磁盘文件）。"""
        if not self.project:
            return False
        asset = self.project.find_by_id("assets", asset_id)
        if not asset:
            return False
        try:
            assets_core.reclassify_asset(self.project, asset, category)
        except Exception:
            return False
        self.dirty = True
        return True

    def asset_preview(self, asset_id: str) -> Optional[dict]:
        """返回资产预览数据：图片 base64；音频/视频返回本地 file:// URL。"""
        if not self.project:
            return None
        asset = self.project.find_by_id("assets", asset_id)
        if not asset:
            return None
        path = self.project.asset_path(asset)
        if not path.exists():
            return None

        if asset.type == "image":
            mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp"}.get(
                path.suffix.lower().lstrip("."), "image/png"
            )
            try:
                data = base64.b64encode(path.read_bytes()).decode("ascii")
            except OSError:
                return None
            return {"type": "image", "mime": mime, "data": data}

        if asset.type == "audio":
            return {"type": "audio", "url": path.as_uri()}
        if asset.type == "video":
            return {"type": "video", "url": path.as_uri()}
        return None

    def asset_references(self) -> dict:
        """返回资产引用分析 {资产ID: {count, locations}}。"""
        if not self.project:
            return {}
        return refs_core.reference_summary(self.project)

    def list_fonts(self) -> dict:
        """返回系统字体列表（中文前置），供设置页字体下拉框。"""
        if not self.project:
            return {}
        return fonts_core.list_fonts()

    # ------------------------------------------------------------------ 校验 / 导出

    def validate(self) -> list:
        if not self.project:
            return []
        return [
            {"severity": i.severity, "location": i.location, "message": i.message}
            for i in ProjectValidator(self.project).validate()
        ]

    def export_script(self, script_id: str) -> bool:
        if not self.project:
            return False
        script = self.project.find_by_id("scripts", script_id)
        if not script:
            return False
        path = self._ask("save", save_filename=f"{script.id}.txt", file_types=TXT_FILE_TYPES)
        if not path:
            return False
        try:
            export_core.export_script_txt(self.project, script, path)
        except OSError:
            return False
        return True

    # ------------------------------------------------------------------ AI 语音生成

    def ai_list_voices(self, force: bool = False) -> list:
        """返回可用声线列表 [{id, name}, ...]。"""
        return ai_core.list_voices(force=bool(force))

    def ai_load_voice_map(self) -> dict:
        if not self.project:
            return {}
        return ai_core.load_voice_map(self.project)

    def ai_save_voice_map(self, voice_map: dict) -> bool:
        if not self.project:
            return False
        return ai_core.save_voice_map(self.project, voice_map)

    def ai_voice_generate(self, overwrite: bool = False, script_id: str = "") -> dict:
        """在后台线程批量生成对话语音，立即返回。"""
        if not self.project:
            return {"error": "尚未创建项目"}
        if not self.project.file_path:
            if not self.save_project_as():
                return {"error": "需要先保存项目"}
        if self._ai and self._ai.get("running"):
            return {"error": "语音生成进行中，请稍候"}

        voice_map = ai_core.load_voice_map(self.project)
        state = {"running": True, "done": False, "ok": None, "errors": [], "logs": [], "progress": 0.0}
        self._ai = state

        def log(msg: Optional[str], progress: Optional[float] = None) -> None:
            if msg:
                state["logs"].append(msg)
                if len(state["logs"]) > 300:
                    state["logs"] = state["logs"][-300:]
            if progress is not None:
                state["progress"] = min(1.0, max(0.0, progress))

        def run() -> None:
            try:
                result = ai_core.generate_voices(
                    self.project, voice_map, log=log, overwrite=bool(overwrite), script_id=script_id
                )
                state.update(result)
                state["ok"] = bool(result.get("ok"))
                if not result.get("ok"):
                    state["errors"] = result.get("errors", [])
                else:
                    self.dirty = True
            except Exception as exc:  # noqa: BLE001
                state["ok"] = False
                state["errors"] = [str(exc)]
            finally:
                state["running"] = False
                state["done"] = True

        threading.Thread(target=run, daemon=True).start()
        return {"started": True}

    def ai_voice_status(self) -> dict:
        if not self._ai:
            return {"running": False, "done": False, "ok": None, "errors": [], "logs": [], "last": "", "progress": 0.0}
        a = self._ai
        return {
            "running": bool(a["running"]),
            "done": bool(a["done"]),
            "ok": a["ok"],
            "errors": list(a.get("errors", [])),
            "logs": list(a.get("logs", [])),
            "last": a["logs"][-1] if a.get("logs") else "",
            "progress": a.get("progress", 0.0),
            "generated": a.get("generated", 0),
            "skipped": a.get("skipped", 0),
        }

    # ------------------------------------------------------------------ 一键生成 .exe

    def build_start(self, onefile: bool = True) -> dict:
        """在后台线程启动构建，立即返回。"""
        if not self.project:
            return {"error": "尚未创建项目"}
        if not self.project.file_path:
            if not self.save_project_as():
                return {"error": "需要先保存项目"}
        if self._build and self._build.get("running"):
            return {"error": "构建进行中，请稍候"}

        self._bump_minor()
        self.project.save()
        self.dirty = False

        state = {"running": True, "done": False, "ok": None, "exe": "", "errors": [], "logs": [], "progress": 0.0}
        self._build = state

        def log(msg: Optional[str], progress: Optional[float] = None) -> None:
            if msg:
                state["logs"].append(msg)
                if len(state["logs"]) > 300:
                    state["logs"] = state["logs"][-300:]
            if progress is not None:
                state["progress"] = min(1.0, max(0.0, progress))

        def run() -> None:
            try:
                out_dir = Path(self.project.file_path).parent / "dist"
                result = build_mod.build_exe(self.project, out_dir, onefile=bool(onefile), log=log)
                state.update(result)
                state["ok"] = bool(result.get("ok"))
                state["exe"] = result.get("exe", "")
                if not result.get("ok"):
                    state["errors"] = result.get("errors", [])
            except Exception as exc:  # noqa: BLE001
                state["ok"] = False
                state["errors"] = [str(exc)]
            finally:
                state["running"] = False
                state["done"] = True

        threading.Thread(target=run, daemon=True).start()
        return {"started": True}

    def build_status(self) -> dict:
        if not self._build:
            return {"running": False, "done": False, "ok": None, "exe": "", "errors": [], "logs": [], "last": "", "progress": 0.0}
        b = self._build
        return {
            "running": bool(b["running"]),
            "done": bool(b["done"]),
            "ok": b["ok"],
            "exe": b.get("exe", ""),
            "errors": list(b.get("errors", [])),
            "logs": list(b.get("logs", [])),
            "last": b["logs"][-1] if b.get("logs") else "",
            "progress": b.get("progress", 0.0),
        }

    def open_explorer(self, path: str) -> bool:
        try:
            target = Path(path)
            if target.is_file():
                target = target.parent
            if not target.exists():
                return False
            os.startfile(str(target))
            return True
        except Exception:
            return False

    # ------------------------------------------------------------------ 内部

    def _payload(self) -> Optional[dict]:
        if not self.project:
            return None
        raw = self.project.to_dict()
        return {
            "meta": raw["meta"],
            "data": raw["data"],
            "file_path": self.project.file_path or "",
            "dirty": bool(self.dirty),
        }


def _asset_to_dict(asset: Asset) -> dict:
    return {
        "id": asset.id,
        "type": asset.type,
        "category": asset.category,
        "file_name": asset.file_name,
        "rel_path": asset.rel_path,
        "tags": list(asset.tags),
        "created_at": asset.created_at,
        "reference_count": asset.reference_count,
    }
