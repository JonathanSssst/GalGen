"""对游戏端装配（stage）的单元测试。"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from manager.core.gg_format import GalGenProject  # noqa: E402
from manager.core.models import Character, Dialog, Ending, Option, Scene, Script  # noqa: E402
from runtime.stage import build_stage  # noqa: E402


def _make_project(root: Path):
    p = GalGenProject.new()
    p.project.name = "测试游戏"
    p.characters = [Character(id="char_0001", name="林晓")]
    p.scenes = [Scene(id="scene_0001", name="天台", background="")]
    p.scripts = [
        Script(
            id="script_0001",
            dialogs=[
                Dialog(id="dlg_0001", type="text", character_id="char_0001", content="你好呀。"),
                Dialog(
                    id="dlg_0002",
                    type="choice",
                    content="接下来去哪？",
                    options=[
                        Option(
                            id="opt_0001",
                            content="去天台",
                            jump_to="dlg_0003",
                            effects=[{"target": "char_0001", "variable": "affection", "operation": "add", "value": 5}],
                        ),
                        Option(id="opt_0002", content="回教室", ending_id="end_0001"),
                    ],
                ),
                Dialog(id="dlg_0003", type="text", content="天台的风好大。"),
            ],
        )
    ]
    p.endings = [Ending(id="end_0001", name="回家结局", description="你选择了回家。")]
    p.save(root / "proj.gg")
    return p


class TestStage(unittest.TestCase):
    def test_build_stage_outputs(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            proj = _make_project(td)
            out = build_stage(proj, td / "stage")
            self.assertTrue((out / "index.html").exists())
            self.assertTrue((out / "css" / "style.css").exists())
            self.assertTrue((out / "js" / "game.js").exists())
            self.assertTrue((out / "data.json").exists())

            data = json.loads((out / "data.json").read_text(encoding="utf-8"))
            self.assertEqual(data["_project_name"], "测试游戏")
            self.assertIn("script_0001", [s["id"] for s in data["scripts"]])
            self.assertIn("_asset_map", data)

    def test_build_stage_copies_assets(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            proj = _make_project(td)
            # 手动添加一个资产并写入文件
            from manager.core.assets import import_asset

            src = td / "bg.png"
            src.write_bytes(b"\x89PNG fake")
            asset = import_asset(proj, src, category="bg")
            out = build_stage(proj, td / "stage")
            data = json.loads((out / "data.json").read_text(encoding="utf-8"))
            mapped = data["_asset_map"][asset.id]
            self.assertTrue((out / mapped).exists())
            self.assertEqual((out / mapped).read_bytes(), b"\x89PNG fake")

    def test_build_stage_idempotent(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            proj = _make_project(td)
            out1 = build_stage(proj, td / "stage")
            out2 = build_stage(proj, td / "stage")
            self.assertEqual(out1, out2)
            self.assertTrue((out2 / "index.html").exists())


if __name__ == "__main__":
    unittest.main()
