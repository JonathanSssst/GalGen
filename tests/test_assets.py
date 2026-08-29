"""对资产管理函数的单元测试。"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from manager.core.assets import import_asset, infer_asset_type, is_supported_file, reclassify_asset, rename_asset  # noqa: E402
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

            with self.assertRaises(ValueError):
                reclassify_asset(p, asset, "nope")

    def test_rename_asset_updates_file_and_path(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            p = GalGenProject.new()
            p.save(td / "proj.gg")
            src = td / "char.png"
            src.write_bytes(b"\x89PNG fake")
            asset = import_asset(p, src, category="standee")
            old_abs = td / asset.rel_path
            self.assertTrue(old_abs.exists())

            rename_asset(p, asset, "hero_rename.png")
            self.assertEqual(asset.file_name, "hero_rename.png")
            self.assertTrue(asset.rel_path.endswith("hero_rename.png"))
            self.assertFalse(old_abs.exists())
            self.assertTrue((td / asset.rel_path).exists())
            self.assertEqual((td / asset.rel_path).read_bytes(), b"\x89PNG fake")

    def test_rename_asset_keeps_extension(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            p = GalGenProject.new()
            p.save(td / "proj.gg")
            src = td / "bg.png"
            src.write_bytes(b"x")
            asset = import_asset(p, src, category="bg")

            rename_asset(p, asset, "night_scene")
            self.assertEqual(asset.file_name, "night_scene.png")
            self.assertTrue((td / asset.rel_path).exists())

    def test_rename_asset_requires_name(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            p = GalGenProject.new()
            p.save(td / "proj.gg")
            src = td / "a.png"
            src.write_bytes(b"x")
            asset = import_asset(p, src, category="bg")

            with self.assertRaises(ValueError):
                rename_asset(p, asset, "   ") 
            self.assertEqual(asset.file_name, "a.png")


if __name__ == "__main__":
    unittest.main()
