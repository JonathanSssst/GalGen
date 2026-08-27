"""对后端 Api（pywebview 桥接层）的单元测试，使用注入的伪对话框。"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from manager.web.api import Api  # noqa: E402


class FakeDialog:
    """可注入的对话框：按 kind 返回预设路径。"""

    def __init__(self, open_path=None, save_path=None):
        self.open_path = open_path
        self.save_path = save_path

    def __call__(self, kind, **kwargs):
        return self.open_path if kind == "open" else self.save_path


class TestApi(unittest.TestCase):
    def setUp(self):
        self.td = Path(tempfile.mkdtemp())
        self.api = Api(dialog=FakeDialog())

    def test_new_project_payload(self):
        payload = self.api.new_project()
        self.assertIsNotNone(payload)
        self.assertIn("data", payload)
        for key in ("project", "characters", "scenes", "chapters", "scripts", "assets", "endings"):
            self.assertIn(key, payload["data"])

    def test_set_data_applies_and_marks_dirty(self):
        self.api.new_project()
        data = self.api.get_data()["data"]
        data["project"]["name"] = "改名"
        data["characters"].append({"id": "char_0001", "name": "林晓", "variables": {}, "constants": {}, "expressions": {}})
        ok = self.api.set_data(data)
        self.assertTrue(ok)
        self.assertTrue(self.api.dirty)
        self.assertEqual(self.api.project.project.name, "改名")
        self.assertEqual(len(self.api.project.characters), 1)

    def test_next_id(self):
        self.api.new_project()
        self.api.set_data({"characters": [{"id": "char_0001", "name": "A"}]})
        self.assertEqual(self.api.next_id("characters"), "char_0002")

    def test_save_load_roundtrip(self):
        self.api.new_project()
        path = self.td / "proj.gg"
        self.api.project.save(path)
        loaded = self.api.load_path(str(path))
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded["file_path"], str(path))
        self.assertFalse(self.api.dirty)

    def test_open_project_dialog_cancel(self):
        self.api._dialog = FakeDialog(open_path=None)
        self.assertIsNone(self.api.open_project())

    def test_open_project_loads(self):
        self.api.new_project()
        path = self.td / "a.gg"
        self.api.project.save(path)
        self.api._dialog = FakeDialog(open_path=str(path))
        payload = self.api.open_project()
        self.assertEqual(payload["file_path"], str(path))

    def test_save_project_as_uses_dialog(self):
        self.api.new_project()
        self.api.project.project.name = "测试"
        self.api._dialog = FakeDialog(save_path=str(self.td / "b.gg"))
        self.assertTrue(self.api.save_project_as())
        self.assertTrue((self.td / "b.gg").exists())

    def test_validate_returns_issues(self):
        self.api.new_project()
        issues = self.api.validate()
        self.assertIsInstance(issues, list)

    def test_upload_and_delete_asset(self):
        self.api.new_project()
        path = self.td / "proj.gg"
        self.api.project.save(path)

        src = self.td / "bg.png"
        src.write_bytes(b"\x89PNG fake")
        self.api._dialog = FakeDialog(open_path=str(src))
        asset = self.api.upload_asset("bg")
        self.assertIsNotNone(asset)
        self.assertEqual(asset["category"], "bg")
        self.assertEqual(asset["type"], "image")
        self.assertEqual(len(self.api.project.assets), 1)
        self.assertTrue((self.td / asset["rel_path"]).exists())

        self.assertTrue(self.api.delete_asset(asset["id"]))
        self.assertEqual(len(self.api.project.assets), 0)

    def test_upload_asset_auto_saves_project(self):
        self.api.new_project()
        # 保存对话框取消 → 返回 None，不导入
        self.api._dialog = FakeDialog(save_path=None, open_path=None)
        self.assertIsNone(self.api.upload_asset("bg"))
        # 保存对话框确认 → 自动保存后再导入
        src = self.td / "x.png"
        src.write_bytes(b"x")
        self.api._dialog = FakeDialog(save_path=str(self.td / "auto.gg"), open_path=str(src))
        asset = self.api.upload_asset("bg")
        self.assertIsNotNone(asset)
        self.assertTrue((self.td / "auto.gg").exists())
        self.assertEqual(len(self.api.project.assets), 1)

    def test_export_script(self):
        self.api.new_project()
        self.api.set_data({
            "scripts": [{"id": "script_0001", "dialogs": [{"id": "dlg_0001", "type": "text", "content": "你好"}]}],
        })
        save_path = str(self.td / "s.txt")
        self.api._dialog = FakeDialog(save_path=save_path)
        self.assertTrue(self.api.export_script("script_0001"))
        self.assertIn("你好", Path(save_path).read_text(encoding="utf-8"))

    def test_asset_preview(self):
        self.api.new_project()
        path = self.td / "proj.gg"
        self.api.project.save(path)
        src = self.td / "img.png"
        src.write_bytes(b"\x89PNG\r\n\x1a\nfake")
        self.api._dialog = FakeDialog(open_path=str(src))
        asset = self.api.upload_asset("standee")
        pre = self.api.asset_preview(asset["id"])
        self.assertIsNotNone(pre)
        self.assertEqual(pre["mime"], "image/png")

    def test_ask_passes_plain_string_tuple(self):
        """回归：file_types 必须是字符串元组，不能二次包装成嵌套元组。"""
        import webview

        captured = {}

        class FakeWin:
            def create_file_dialog(self, dialog_type, **kwargs):
                captured.update(kwargs)
                return ("C:/fake/file.gg",)

        original = webview.windows
        webview.windows = [FakeWin()]
        try:
            api = Api()
            result = api._ask("open", file_types=("GalGen 项目 (*.gg)",))
            self.assertEqual(result, "C:/fake/file.gg")
            ft = captured["file_types"]
            self.assertIsInstance(ft, tuple)
            self.assertIsInstance(ft[0], str)
            self.assertEqual(ft[0], "GalGen 项目 (*.gg)")
        finally:
            webview.windows = original

    def test_build_status_initial(self):
        api = Api()
        st = api.build_status()
        self.assertFalse(st["running"])
        self.assertFalse(st["done"])

    def test_build_start_requires_saved_project(self):
        api = Api(dialog=None)
        api.new_project()
        res = api.build_start(True)
        self.assertIn("error", res)

    def test_open_explorer_missing_path(self):
        api = Api()
        self.assertFalse(api.open_explorer(str(self.td / "not_exist_dir")))


if __name__ == "__main__":
    unittest.main()
