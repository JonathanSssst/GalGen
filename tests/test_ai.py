"""对 AI 语音模块（角色→声线映射、批量生成）的单元测试。

语音合成通过 monkeypatch 替换为本地桩函数，避免真实网络请求。
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from manager.core import ai as ai_core  # noqa: E402
from manager.core.gg_format import GalGenProject  # noqa: E402
from manager.core.models import Character, Dialog, Script  # noqa: E402


def make_project(td: Path) -> GalGenProject:
    proj = GalGenProject.new()
    proj.characters.append(Character(id="char_0001", name="林晓"))
    proj.characters.append(Character(id="char_0002", name="陈默"))
    proj.scripts.append(Script(
        id="script_0001",
        chapter_id="",
        dialogs=[
            Dialog(id="dlg_0001", type="text", character_id="char_0001", content="你好呀。"),
            Dialog(id="dlg_0002", type="text", character_id="char_0002", content="嗯。"),
            Dialog(id="dlg_0003", type="text", character_id="char_0001", content="", voice="asset_0009"),
            Dialog(id="dlg_0004", type="choice", character_id="char_0001", content="去吗？"),
        ],
    ))
    proj.save(td / "proj.gg")
    return proj


def _fake_synthesize(text, voice, out_path):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(b"FAKEMP3")


class TestVoices(unittest.TestCase):
    def setUp(self):
        ai_core._voices_cache = None

    def test_list_voices_non_empty(self):
        voices = ai_core.list_voices(force=True)
        self.assertIsInstance(voices, list)
        self.assertTrue(voices)
        self.assertIn("id", voices[0])
        self.assertIn("name", voices[0])
        self.assertIn("zh-CN-XiaoxiaoNeural", [v["id"] for v in voices])

    def test_list_voices_cached(self):
        first = ai_core.list_voices(force=True)
        second = ai_core.list_voices()
        self.assertIs(first, second)


class TestVoiceMap(unittest.TestCase):
    def setUp(self):
        self.td = Path(tempfile.mkdtemp())
        self.project = make_project(self.td)

    def test_voice_map_roundtrip(self):
        mapping = {"char_0001": "zh-CN-XiaoxiaoNeural"}
        self.assertTrue(ai_core.save_voice_map(self.project, mapping))
        self.assertEqual(ai_core.load_voice_map(self.project), mapping)

    def test_voice_map_missing_file_returns_empty(self):
        self.assertEqual(ai_core.load_voice_map(self.project), {})

    def test_voice_map_unsaved_project(self):
        unsaved = GalGenProject.new()
        self.assertIsNone(ai_core.ai_config_path(unsaved))
        self.assertFalse(ai_core.save_voice_map(unsaved, {"a": "b"}))
        self.assertEqual(ai_core.load_voice_map(unsaved), {})


class TestGenerate(unittest.TestCase):
    def setUp(self):
        ai_core._voices_cache = None
        self.td = Path(tempfile.mkdtemp())
        self.project = make_project(self.td)

    def test_requires_saved_project(self):
        unsaved = GalGenProject.new()
        result = ai_core.generate_voices(unsaved, {"char_0001": "zh-CN-XiaoxiaoNeural"})
        self.assertFalse(result["ok"])
        self.assertTrue(result["errors"])

    def test_requires_valid_mapping(self):
        result = ai_core.generate_voices(self.project, {"char_0001": "not-a-real-voice"})
        self.assertFalse(result["ok"])
        self.assertIn("映射", result["errors"][0])

    def test_generates_and_assigns_voice(self):
        mapping = {
            "char_0001": "zh-CN-XiaoxiaoNeural",
            "char_0002": "zh-CN-YunxiNeural",
        }
        with patch("manager.core.ai.synthesize", side_effect=_fake_synthesize):
            result = ai_core.generate_voices(self.project, mapping)

        self.assertTrue(result["ok"])
        self.assertEqual(result["generated"], 2)  # dlg_0003 无内容 / dlg_0004 为选项，跳过

        # 生成两个 voice 资产，且回写 dialog.voice
        voices = [a for a in self.project.assets if a.category == "voice"]
        self.assertEqual(len(voices), 2)
        self.assertTrue(self.project.find_by_id("assets", self.project.scripts[0].dialogs[0].voice))
        self.assertTrue(self.project.find_by_id("assets", self.project.scripts[0].dialogs[1].voice))

        # 文件已写入项目目录
        for a in voices:
            self.assertTrue((self.td / a.rel_path).exists())

    def test_overwrite_regenerates(self):
        mapping = {"char_0001": "zh-CN-XiaoxiaoNeural"}
        with patch("manager.core.ai.synthesize", side_effect=_fake_synthesize):
            first = ai_core.generate_voices(self.project, mapping)
            second = ai_core.generate_voices(self.project, mapping)
            third = ai_core.generate_voices(self.project, mapping, overwrite=True)
        self.assertEqual(first["generated"], 1)
        # 已分配语音且未覆盖 → 跳过
        self.assertEqual(second["generated"], 0)
        self.assertEqual(second["message"], "没有需要生成的新语音（可勾选「覆盖已有」）")

        self.assertEqual(third["generated"], 1)
        self.assertEqual(len([a for a in self.project.assets if a.category == "voice"]), 1)

    def test_script_scope(self):
        mapping = {"char_0001": "zh-CN-XiaoxiaoNeural"}
        self.project.scripts.append(Script(
            id="script_0002",
            dialogs=[Dialog(
                id="dlg_0101", type="text", character_id="char_0001", content="第二段。"
            )],
        ))
        with patch("manager.core.ai.synthesize", side_effect=_fake_synthesize):
            result = ai_core.generate_voices(self.project, mapping, script_id="script_0002")
        self.assertEqual(result["generated"], 1)
        self.assertEqual(len([a for a in self.project.assets if a.category == "voice"]), 1)


if __name__ == "__main__":
    unittest.main()
