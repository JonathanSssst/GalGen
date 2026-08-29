"""AI 功能核心逻辑：角色→音色映射、语音批量生成（基于 edge-tts）。

语音生成依赖 edge-tts（微软 Edge 在线 TTS，免费、无需 API Key），
见 requirements.txt。映射配置按项目保存于项目目录下 ai_config.json，
不写入 .gg 文件，避免污染项目格式。
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Callable, Dict, List, Optional

from .gg_format import GalGenProject, now_iso
from .models import Asset

# 常用中文声线（edge-tts 在线音色），键为声线名，值为展示名。
CURATED_VOICES = [
    ("zh-CN-XiaoxiaoNeural", "晓晓（女 · 温和）"),
    ("zh-CN-XiaoyiNeural", "晓伊（女 · 活泼）"),
    ("zh-CN-YunjianNeural", "云健（男 · 体育）"),
    ("zh-CN-YunxiNeural", "云希（男 · 少年）"),
    ("zh-CN-YunyangNeural", "云扬（男 · 新闻）"),
    ("zh-CN-YunxiaNeural", "云夏（男 · 童声）"),
    ("zh-CN-liaoning-XiaobeiNeural", "晓北（女 · 东北）"),
    ("zh-CN-shaanxi-XiaoniNeural", "晓妮（女 · 陕西）"),
    ("zh-HK-HiuMaanNeural", "曉曼（女 · 粤语）"),
    ("zh-TW-HsiaoChenNeural", "曉臻（女 · 台湾）"),
    ("zh-TW-HsiaoYuNeural", "曉雨（女 · 台湾）"),
    ("zh-TW-YunJheNeural", "雲哲（男 · 台湾）"),
]

AI_CONFIG_FILE = "ai_config.json"
DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural"

_voices_cache: Optional[List[dict]] = None


def list_voices(force: bool = False) -> List[dict]:
    """返回可用声线列表（仅中英文音色；优先尝试 edge-tts，失败回退内置清单）。"""
    global _voices_cache
    if _voices_cache is not None and not force:
        return _voices_cache
    try:
        import edge_tts  # noqa: F401

        voices = asyncio.run(edge_tts.list_voices())
        result = []
        seen = set()
        for v in voices:
            short = v.get("ShortName", "")
            if not short or short in seen:
                continue
            # 仅保留中文与英文音色
            if not (short.startswith("zh-") or short.startswith("en-")):
                continue
            seen.add(short)
            gender = v.get("Gender", "")
            name = v.get("FriendlyName", short)
            if gender:
                name = f"{name}（{'女' if gender == 'Female' else '男'}）"
            result.append({"id": short, "name": name})
        if result:
            _voices_cache = result
            return result
    except Exception:  # noqa: BLE001 网络不可用 / 未安装
        pass
    result = [{"id": vid, "name": vname} for vid, vname in CURATED_VOICES]
    _voices_cache = result
    return result


def ai_config_path(project: GalGenProject) -> Optional[Path]:
    """项目对应的 ai_config.json 路径；项目未保存返回 None。"""
    if not project.file_path:
        return None
    return project.project_dir() / AI_CONFIG_FILE


def load_voice_map(project: GalGenProject) -> dict:
    """读取角色→声线映射 {角色ID: 声线名}。"""
    path = ai_config_path(project)
    if not path or not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data.get("voice_map", {}) or {}
    except (OSError, json.JSONDecodeError):
        return {}


def save_voice_map(project: GalGenProject, voice_map: dict) -> bool:
    """保存角色→声线映射；项目未保存或保存失败返回 False。"""
    path = ai_config_path(project)
    if not path:
        return False
    try:
        path.write_text(
            json.dumps({"voice_map": voice_map or {}}, ensure_ascii=False, indent=2),
            encoding="utf-8",
            newline="\n",
        )
        return True
    except OSError:
        return False


def synthesize(text: str, voice: str, out_path: Path) -> None:
    """使用 edge-tts 将文本合成为 MP3 并写入 out_path。"""
    import edge_tts

    async def _run() -> None:
        communicate = edge_tts.Communicate(text or "", voice or DEFAULT_VOICE)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "wb") as f:
            async for chunk in communicate.stream():
                if chunk.get("type") == "audio" and chunk.get("data"):
                    f.write(chunk["data"])

    asyncio.run(_run())


# 旁白（无角色）声线专用键，存储在 voice_map 中。
NARRATION_KEY = "__narration__"


def _character_voice_map(project: GalGenProject, voice_map: dict) -> dict:
    """建立 角色ID → 声线 的有效映射；缺失声线或未映射角色不生成。

    旁白（NARRATION_KEY）始终保留，供 character_id 为空的对话使用。
    """
    valid = {v["id"] for v in list_voices()}
    effective = {}
    for c in project.characters:
        voice = (voice_map or {}).get(c.id, "")
        if voice in valid:
            effective[c.id] = voice
    narration = (voice_map or {}).get(NARRATION_KEY, "")
    if narration in valid:
        effective[NARRATION_KEY] = narration
    return effective


def generate_voices(
    project: GalGenProject,
    voice_map: dict,
    log: Callable[[Optional[str], Optional[float]], None] = None,
    overwrite: bool = False,
    script_id: str = "",
) -> dict:
    """按角色→声线映射批量生成对话语音。

    - 仅处理 text 类型且存在内容、有可用声线的对话（含旁白 character_id 为空）；
    - 已分配语音（dialog.voice 非空）默认跳过，overwrite=True 时重新生成；
    - 生成文件存放于 assets/audio/voice/，创建 voice 类资产并回写 dialog.voice。
    """
    if not project.file_path:
        return {"ok": False, "errors": ["项目尚未保存，请先保存项目"]}

    effective = _character_voice_map(project, voice_map)
    if not effective:
        return {"ok": False, "errors": ["尚未配置任何有效的角色→声线映射，请先在 AI 页设置"]}

    scripts = [s for s in project.scripts if not script_id or s.id == script_id]
    if not scripts:
        return {"ok": False, "errors": [f"未找到剧情：{script_id or '(全部)'}"]}

    targets = []
    for sc in scripts:
        for d in sc.dialogs:
            if d.type != "text" or not d.content:
                continue
            if d.voice and not overwrite:
                continue
            voice = effective.get(d.character_id) or effective.get(NARRATION_KEY)
            if not voice:
                continue
            targets.append((sc, d, voice))

    if not targets:
        return {"ok": True, "generated": 0, "skipped": 0, "errors": [], "message": "没有需要生成的新语音（可勾选「覆盖已有」）"}

    total = len(targets)
    generated = 0
    errors = []

    def _log(msg: str, progress: Optional[float] = None) -> None:
        if log:
            log(msg, progress)

    _log(f"开始生成 {total} 条语音…", 0.0)
    for i, (sc, d, voice) in enumerate(targets):
        file_name = f"voice_{d.id}.mp3"
        rel_path = f"assets/audio/voice/{file_name}"
        out_path = project.project_dir() / rel_path
        try:
            synthesize(d.content, voice, out_path)
        except Exception as exc:  # noqa: BLE001 网络 / 服务异常
            errors.append(f"{d.id}：{exc}")
            _log(f"[失败] {d.id}（{d.content[:12]}…）：{exc}", (i + 1) / total)
            continue

        existing = None
        if d.voice:
            existing = project.find_by_id("assets", d.voice)
        if existing:
            existing.rel_path = rel_path
            existing.file_name = file_name
        else:
            asset = Asset(
                id=project.next_id("assets"),
                type="audio",
                category="voice",
                file_name=file_name,
                rel_path=rel_path,
                tags=[d.character_id],
                created_at=now_iso(),
                reference_count=1,
            )
            project.assets.append(asset)
            d.voice = asset.id
        generated += 1
        _log(f"[完成] {d.id} → {voice}（{i + 1}/{total}）", (i + 1) / total)

    return {"ok": True, "generated": generated, "skipped": total - generated - len(errors), "errors": errors}
