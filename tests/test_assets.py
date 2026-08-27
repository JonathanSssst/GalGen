"""对资产管理函数的单元测试。"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from manager.core.assets import import_asset, infer_asset_type, is_supported_file  # noqa: E402
from manager.core.gg_format import GalGenProject  # noqa: E402


class TestAssets(unittest.TestCase):
    def test_infer_asset_type(self):
        self.assertEqual(infer_asset_type("a.png"), "image")
        self.assertEqual(infer_asset_type("a.mp3"), "audio")
        self.assertEqual(infer_asset_type("a.webm"), "video")
        self.assertEqual(infer_asset_type("a.unknown"), "image")

    def test_is_supported_file(self):
        self.assertTrue(is_supported_file("a.png"))
        self.assertTrue(is_supported_file("a.ogg"))
        self.assertTrue(is_supported_file("a.mp4"))
        self.assertFalse(is_supported_file("a.exe"))

    def test_import_asset_copies_and_records(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            project_path = td / "proj.gg"
            p = GalGenProject.new()
            p.project.name = "测试"
            p.save(project_path)

            src = td / "char.png"
            src.write_bytes(b"\x89PNG fake image")

            asset = import_asset(p, src, category="standee", tags=["林晓"])

            self.assertEqual(asset.id, "asset_0001")
            self.assertEqual(asset.category, "standee")
            self.assertEqual(asset.type, "image")
            self.assertTrue((td / asset.rel_path).exists())
            self.assertEqual((td / asset.rel_path).read_bytes(), b"\x89PNG fake image")

    def test_import_requires_saved_project(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            src = td / "a.png"
            src.write_bytes(b"x")
            p = GalGenProject.new()
            with self.assertRaises(ValueError):
                import_asset(p, src, category="bg")

    def test_import_unique_name(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            p = GalGenProject.new()
            p.save(td / "proj.gg")
            src = td / "a.png"
            src.write_bytes(b"x")
            a1 = import_asset(p, src, category="bg")
            a2 = import_asset(p, src, category="bg")
            self.assertNotEqual(a1.rel_path, a2.rel_path)
            self.assertEqual(len(p.assets), 2)

    def test_reclassify_asset_moves_file(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            p = GalGenProject.new()
            p.save(td / "proj.gg")
            src = td / "char.png"
            src.write_bytes(b"\x89PNG fake")
            asset = import_asset(p, src, category="standee")
            old_rel = asset.rel_path
            old_abs = td / old_rel
            self.assertTrue(old_abs.exists())

            from manager.core.assets import reclassify_asset

            reclassify_asset(p, asset, "cg")
            self.assertEqual(asset.category, "cg")
            self.assertNotEqual(asset.rel_path, old_rel)
            self.assertTrue(asset.rel_path.startswith("assets/images/cg/"))
            self.assertFalse(old_abs.exists())
            self.assertTrue((td / asset.rel_path).exists())
            self.assertEqual((td / asset.rel_path).read_bytes(), b"\x89PNG fake")

    def test_reclassify_unknown_category_raises(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            p = GalGenProject.new()
            p.save(td / "proj.gg")
            src = td / "a.png"
            src.write_bytes(b"x")
            asset = import_asset(p, src, category="bg")
            from manager.core.assets import reclassify_asset

            with self.assertRaises(ValueError):
                reclassify_asset(p, asset, "nope")


if __name__ == "__main__":
    unittest.main()
