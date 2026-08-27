"""对构建器（builder）的单元测试（不实际运行 PyInstaller）。"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from manager.builder import build as build_mod  # noqa: E402
from manager.core.gg_format import GalGenProject  # noqa: E402
from manager.core.models import Character, Dialog, Option, Script  # noqa: E402


class TestBuild(unittest.TestCase):
    def test_safe_name(self):
        self.assertEqual(build_mod.safe_name('A/B:C*'), 'ABC')
        self.assertEqual(build_mod.safe_name('   '), 'GalGenGame')

    def test_build_command(self):
        p = GalGenProject.new()
        p.project.name = '测试游戏'
        p.project.version = '1.2.3'
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            publish = td / 'publish'
            (publish / 'css').mkdir(parents=True)
            (publish / 'index.html').write_text('<html></html>', encoding='utf-8')
            (publish / 'data.json').write_text('{}', encoding='utf-8')
            (publish / 'css' / 'style.css').write_text('', encoding='utf-8')
            cmd = build_mod.build_command(p, publish, td / 'work', td / 'dist', onefile=True)
            joined = ' '.join(cmd)
            self.assertIn('--onefile', joined)
            self.assertIn(f'--name 测试游戏_v1.2.3', joined)
            self.assertIn('--add-data', joined)
            self.assertTrue(any(f'index.html{os.pathsep}.' in c for c in cmd))
            self.assertTrue(any(f'css{os.pathsep}css' in c for c in cmd))

    def test_validate_blocks_invalid_project(self):
        p = GalGenProject.new()
        p.project.name = '坏项目'
        p.scripts = [
            Script(id='script_0001', dialogs=[Dialog(id='d1', type='text', content='x')]),
        ]
        # 加入一个坏的跳转引用
        p.scripts[0].dialogs.append(
            Dialog(
                id='d2',
                type='choice',
                content='选择',
                options=[Option(id='o1', content='a', jump_to='nope')],
            )
        )
        with tempfile.TemporaryDirectory() as td:
            result = build_mod.build_exe(p, Path(td) / 'out')
            self.assertFalse(result['ok'])
            self.assertEqual(result['stage'], '校验')
            self.assertTrue(result['errors'])

    def test_valid_project_passes_validation(self):
        p = GalGenProject.new()
        p.project.name = '好项目'
        p.scripts = [Script(id='script_0001', dialogs=[Dialog(id='d1', type='text', content='x')])]
        errors = build_mod.validate(p)
        self.assertEqual(errors, [])


if __name__ == "__main__":
    unittest.main()
