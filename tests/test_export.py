"""对剧情导出模块的单元测试。"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from manager.core.export import (  # noqa: E402
    export_project_txt,
    export_script_txt,
    format_dialog_line,
    format_option_line,
)
from manager.core.gg_format import GalGenProject  # noqa: E402
from manager.core.models import Character, Dialog, Effect, Option, Script  # noqa: E402


def _make_project():
    p = GalGenProject.new()
    p.characters = [Character(id="char_0001", name="林晓")]
    p.scripts = [
        Script(id="script_0001", dialogs=[Dialog(id="dlg_0001", type="text", character_id="char_0001", content="你也来了呀。")]),
        Script(id="script_0002", dialogs=[
            Dialog(
                id="dlg_0002",
                type="choice",
                content="接下来去哪？",
                options=[
                    Option(
                        id="opt_0001",
                        content="去天台",
                        jump_to="dlg_0003",
                        effects=[Effect(target="char_0001", variable="affection", operation="add", value=5)],
                        unlock_cg="asset_0203",
                    ),
                    Option(id="opt_0002", content="回教室", jump_to=""),
                ],
            ),
        ]),
    ]
    return p


class TestExport(unittest.TestCase):
    def test_format_dialog_line(self):
        p = _make_project()
        self.assertEqual(format_dialog_line(p, p.scripts[0].dialogs[0]), "林晓：你也来了呀。")

    def test_format_dialog_line_narrator(self):
        p = _make_project()
        from manager.core.models import Dialog

        self.assertEqual(format_dialog_line(p, Dialog(id="x", content="雨停了。")), "旁白：雨停了。")

    def test_format_option_line(self):
        p = _make_project()
        line = format_option_line(p, p.scripts[1].dialogs[0].options[0])
        self.assertIn("→ 去天台", line)
        self.assertIn("跳转：dlg_0003", line)
        self.assertIn("char_0001.affection ＋ 5", line)
        self.assertIn("解锁CG：asset_0203", line)

    def test_export_script_txt(self):
        p = _make_project()
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "script.txt"
            export_script_txt(p, p.scripts[1], path)
            content = path.read_text(encoding="utf-8")
            self.assertNotIn("\ufeff", content)
            self.assertIn("接下来去哪？", content)
            self.assertIn("→ 去天台（跳转：dlg_0003", content)

    def test_export_project_txt(self):
        p = _make_project()
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "all.txt"
            export_project_txt(p, path)
            content = path.read_text(encoding="utf-8")
            self.assertIn("script_0001", content)


if __name__ == "__main__":
    unittest.main()
