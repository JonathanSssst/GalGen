"""一键生成 .exe 的构建器（project.md 第 7 节）。

流程：项目校验 → 资源收集/组装（复用 runtime.stage）→ PyInstaller 构建 → 产物输出。
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Callable, Optional

from manager.core.gg_format import GalGenProject
from manager.core.validator import ProjectValidator
from runtime.stage import build_stage

RELEASE_ENTRY = Path(__file__).resolve().parents[2] / "runtime" / "release_main.py"

_LOG_CB: Callable[[str, Optional[float]], None] = lambda msg, progress: None


def _log(msg: str, progress: Optional[float] = None) -> None:
    _LOG_CB(msg, progress)


def safe_name(name: str) -> str:
    """去除文件名非法字符。"""
    cleaned = "".join(c for c in name if c not in '<>:"/\\|?*')
    return (cleaned.strip() or "GalGenGame")


def validate(project: GalGenProject) -> list:
    """返回错误列表（空表示可生成）。"""
    issues = ProjectValidator(project).validate()
    return [i for i in issues if i.severity == "error"]


def build_command(project: GalGenProject, publish: Path, work_dir: Path, dist_dir: Path, onefile: bool = True) -> list:
    """构造 PyInstaller 命令（便于测试）。--noconsole 去除 cmd 窗口。"""
    base_name = f"{safe_name(project.project.name)}_v{project.project.version}"
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm", "--clean", "--noconsole",
        "--name", base_name,
        "--distpath", str(dist_dir),
        "--workpath", str(work_dir / "build"),
        "--specpath", str(work_dir),
    ]
    if onefile:
        cmd.append("--onefile")
    else:
        cmd.append("--onedir")
    # 自定义 exe 图标（ico 资产）
    icon_asset_id = getattr(project.project, "exe_icon", "")
    if icon_asset_id:
        icon_asset = project.find_by_id("assets", icon_asset_id)
        if icon_asset:
            icon_path = project.asset_path(icon_asset)
            if icon_path.exists() and icon_path.suffix.lower() == ".ico":
                cmd += ["--icon", str(icon_path)]
    for item in publish.iterdir():
        if item.name in ("launcher.py", "__pycache__"):
            continue
        if item.is_dir():
            cmd += ["--add-data", f"{item}{os.pathsep}{item.name}"]
        else:
            cmd += ["--add-data", f"{item}{os.pathsep}."]
    cmd.append(str(publish / "launcher.py"))
    return cmd


def build_exe(
    project: GalGenProject,
    output_dir: Path,
    onefile: bool = True,
    log: Optional[Callable[[str, Optional[float]], None]] = None,
    keep_work: bool = False,
) -> dict:
    """执行完整构建，返回结果字典。"""
    global _LOG_CB
    _LOG_CB = log or (lambda msg, progress: None)

    # 1) 项目校验
    _log("① 校验项目…", 0.05)
    errors = validate(project)
    if errors:
        _log("   校验未通过", 1.0)
        return {"ok": False, "stage": "校验", "errors": [str(e) for e in errors]}
    _log("   校验通过", 0.12)

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    work_dir = Path(tempfile.mkdtemp(prefix="galgen_build_"))
    dist_dir = output_dir / "dist"

    try:
        # 2+4) 组装发布目录
        _log("② 组装发布目录（数据与资产）…", 0.2)
        publish = build_stage(project, work_dir / "publish")
        shutil.copy2(RELEASE_ENTRY, publish / "launcher.py")
        _log(f"   发布目录：{publish}", 0.3)

        # 3) 构建
        cmd = build_command(project, publish, work_dir, dist_dir, onefile=onefile)
        mode = "单文件" if onefile else "目录"
        _log(f"③ 调用 PyInstaller 构建（{mode}，无控制台窗口）…", 0.35)
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            cwd=work_dir,
        )
        line_count = 0
        assert proc.stdout is not None
        for line in proc.stdout:
            line = line.rstrip()
            if line:
                _log("   " + line)
            line_count += 1
            if line_count % 3 == 0:
                # 构建阶段缓慢推进进度，封顶 0.88
                _log(None, min(0.88, 0.36 + line_count * 0.0005))
        proc.wait()
        if proc.returncode != 0:
            _log("   PyInstaller 失败", 1.0)
            return {"ok": False, "stage": "构建", "errors": ["PyInstaller 返回错误码 " + str(proc.returncode)]}
        _log("   PyInstaller 构建完成", 0.9)

        # 4) 产物
        base_name = f"{safe_name(project.project.name)}_v{project.project.version}"
        exe_name = f"{base_name}.exe"
        exe = dist_dir / exe_name
        _log(f"④ 产物：{exe}", 0.95)
        if not exe.exists():
            return {"ok": False, "stage": "产物", "errors": [f"未找到生成文件：{exe}"]}
        return {"ok": True, "exe": str(exe), "mode": mode}
    finally:
        if not keep_work:
            shutil.rmtree(work_dir, ignore_errors=True)
