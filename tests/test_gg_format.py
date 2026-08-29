"""对 .gg 读写与数据模型的单元测试。"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from manager.core.gg_format import GalGenProject, from_dict, now_iso  # noqa: E402
from manager.core.models import Character, Dialog, Option, ProjectInfo, Script  # noqa: E402


class TestGalGenProject(unittest.TestCase):
    def test_new_project_has_timestamps(self):
        p = GalGenProject.new()
        self.assertTrue(p.created_at)
        self.assertTrue(p.updated_at)
        self.assertEqual(p.generator, "GalGen")

    def test_roundtrip_save_load(self):
        p = GalGenProject.new()
        p.project = ProjectInfo(name="测试项目", author="作者", version="1.2.3")
        p.characters = [Character(id="char_0001", name="林晓", variables={"affection": 0})]
        p.scripts = [
            Script(id="script_0001", chapter_id="", dialogs=[Dialog(id="dlg_0001", type="text", content="你好")]),
            Script(id="script_0002", chapter_id="", dialogs=[
                Dialog(
                    id="dlg_0002",
                    type="choice",
                    content="选择",
                    options=[Option(id="opt_0001", content="去", effects=[], jump_to="script_0001")],
                ),
            ]),
        ]

        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "proj.gg"
            p.save(path)
            self.assertTrue(path.exists())

            raw = path.read_text(encoding="utf-8")
            self.assertNotIn("\ufeff", raw)
            self.assertIn("\n  \"meta\"", raw)

            loaded = GalGenProject.load(path)
            self.assertEqual(loaded.project.name, "测试项目")
            self.assertEqual(loaded.characters[0].id, "char_0001")
            self.assertEqual(loaded.characters[0].variables["affection"], 0)
            self.assertEqual(loaded.scripts[1].dialogs[0].options[0].content, "去")
            self.assertEqual(loaded.file_path, str(path))

    def test_save_appends_gg_suffix(self):
        with tempfile.TemporaryDirectory() as td:
            p = GalGenProject.new()
            p.save(Path(td) / "proj")
            self.assertTrue((Path(td) / "proj.gg").exists())

    def test_from_dict_nested(self):
        data = {
            "project": {"name": "A", "defaults": {"text_speed": 10}},
            "characters": [{"id": "char_0001", "variables": {"affection": 5}}],
        }
        p = GalGenProject.from_dict({"meta": {}, "data": data})
        self.assertEqual(p.project.defaults.text_speed, 10)
        self.assertEqual(p.characters[0].variables["affection"], 5)

    def test_next_id(self):
        p = GalGenProject.new()
        self.assertEqual(p.next_id("characters"), "char_0001")
        p.characters = [Character(id="char_0001")]
        self.assertEqual(p.next_id("characters"), "char_0002")
        p.characters = [Character(id="char_0042"), Character(id="scene_0001")]
        self.assertEqual(p.next_id("characters"), "char_0043")

    def test_next_id_overflow_width(self):
        p = GalGenProject.new()
        p.characters = [Character(id="char_9999")]
        self.assertEqual(p.next_id("characters"), "char_10000")

    def test_roundtrip_json_valid(self):
        p = GalGenProject.new()
        p.project.name = "JSON 测试"
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "a.gg"
            p.save(path)
            loaded = GalGenProject.load(path)
        self.assertEqual(loaded.project.name, "JSON 测试")


if __name__ == "__main__":
    unittest.main()
