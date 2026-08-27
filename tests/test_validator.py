"""对校验器的单元测试。"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from manager.core.gg_format import GalGenProject  # noqa: E402
from manager.core.models import (  # noqa: E402
    Asset,
    Branch,
    Chapter,
    Character,
    Dialog,
    Ending,
    Option,
    Scene,
    Script,
)
from manager.core.validator import ProjectValidator  # noqa: E402


def _make_project():
    p = GalGenProject.new()
    p.characters = [Character(id="char_0001", name="林晓")]
    p.scenes = [Scene(id="scene_0001", name="天台")]
    p.assets = [Asset(id="asset_0001", type="image", category="bg", file_name="bg.png", rel_path="")]
    p.endings = [Ending(id="end_0001", name="结局")]
    p.scripts = [
        Script(
            id="script_0001",
            chapter_id="chap_0001",
            dialogs=[
                Dialog(id="dlg_0001", type="text", character_id="char_0001", content="你好"),
                Dialog(
                    id="dlg_0002",
                    type="choice",
                    content="选择",
                    options=[
                        Option(id="opt_0001", content="A", jump_to="dlg_0001"),
                        Option(id="opt_0002", content="B", jump_to="dlg_0001"),
                    ],
                ),
            ],
        )
    ]
    p.chapters = [Chapter(id="chap_0001", name="第一章", order=1, start_script="script_0001")]
    return p


class TestValidator(unittest.TestCase):
    def test_valid_project_no_errors(self):
        p = _make_project()
        issues = ProjectValidator(p).validate()
        self.assertEqual([i for i in issues if i.severity == "error"], [])

    def test_broken_jump_detected(self):
        p = _make_project()
        p.scripts[0].dialogs[1].options[0].jump_to = "dlg_9999"
        issues = ProjectValidator(p).validate()
        self.assertTrue(any("dlg_9999" in i.message for i in issues if i.severity == "error"))

    def test_cross_script_jump_allowed(self):
        p = _make_project()
        p.scripts.append(Script(id="script_0002", dialogs=[Dialog(id="d1", type="text", content="x")]))
        p.scripts[0].dialogs[1].options[0].jump_to = "script_0002"
        issues = ProjectValidator(p).validate()
        self.assertFalse(any("跳转目标不存在" in i.message for i in issues if i.severity == "error"))

    def test_missing_asset_file_detected(self):
        p = _make_project()
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "proj.gg"
            p.save(path)
            p.assets[0].rel_path = "assets/images/bg/nonexistent.png"
            issues = ProjectValidator(p).validate()
            self.assertTrue(any("不存在" in i.message for i in issues if i.severity == "error"))

    def test_duplicate_ids_detected(self):
        p = _make_project()
        p.characters.append(Character(id="char_0001"))
        issues = ProjectValidator(p).validate()
        self.assertTrue(any("重复" in i.message for i in issues if i.severity == "error"))

    def test_bad_ending_ref_detected(self):
        p = _make_project()
        p.chapters[0].branches = [Branch(id="br_0001", name="分支", ending_id="end_9999")]
        issues = ProjectValidator(p).validate()
        self.assertTrue(any("结局不存在" in i.message for i in issues if i.severity == "error"))

    def test_choice_without_options_detected(self):
        p = _make_project()
        p.scripts[0].dialogs[1].options = []
        issues = ProjectValidator(p).validate()
        self.assertTrue(any("缺少选项" in i.message for i in issues if i.severity == "error"))

    def test_high_format_version_detected(self):
        p = _make_project()
        p.format_version = 999
        issues = ProjectValidator(p).validate()
        self.assertTrue(any("格式版本" in i.message for i in issues if i.severity == "error"))


if __name__ == "__main__":
    unittest.main()
