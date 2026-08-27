"""剧情导出。

格式规范见 project.md 4.3 节：
- 编码 UTF-8（无 BOM）、换行 LF；
- 每行一条对话，按「角色名：对话内容」输出；
- 选项行以「→」开头，并标注绑定的跳转结果。
"""

from __future__ import annotations

from pathlib import Path

from .gg_format import GalGenProject
from .models import Dialog, Script


def _effect_summary(effect) -> str:
    name = effect.target if effect.target != "global" else "全局"
    op = {"add": "＋", "sub": "－", "set": "＝"}.get(effect.operation, effect.operation)
    return f"{name}.{effect.variable} {op} {effect.value}"


def format_option_line(project: GalGenProject, option) -> str:
    parts = [f"→ {option.content}"]
    details = []
    if option.jump_to:
        details.append(f"跳转：{option.jump_to}")
    if option.ending_id:
        details.append(f"结局：{option.ending_id}")
    for e in option.effects:
        details.append(_effect_summary(e))
    if option.unlock_cg:
        details.append(f"解锁CG：{option.unlock_cg}")
    if option.unlock_script:
        details.append(f"解锁剧情：{option.unlock_script}")
    if details:
        parts.append("（" + "；".join(details) + "）")
    return "".join(parts)


def format_dialog_line(project: GalGenProject, dialog: Dialog) -> str:
    if dialog.type == "choice":
        return "【选项】" + dialog.content
    name = "旁白"
    if dialog.character_id:
        char = project.find_by_id("characters", dialog.character_id)
        if char:
            name = char.name
    return f"{name}：{dialog.content}"


def export_script_txt(project: GalGenProject, script: Script, path) -> None:
    """将单个剧情导出为 txt。"""
    lines = [f"# 剧情 {script.id}", ""]
    for d in script.dialogs:
        lines.append(format_dialog_line(project, d))
        if d.type == "choice":
            for opt in d.options:
                lines.append(format_option_line(project, opt))
        lines.append("")
    _write_txt(path, "\n".join(lines).rstrip("\n") + "\n")


def export_project_txt(project: GalGenProject, path) -> None:
    """将整个项目的所有剧情按章节顺序导出为 txt。"""
    blocks = []
    for script in project.scripts:
        lines = [f"# 剧情 {script.id}", ""]
        for d in script.dialogs:
            lines.append(format_dialog_line(project, d))
            if d.type == "choice":
                for opt in d.options:
                    lines.append(format_option_line(project, opt))
            lines.append("")
        blocks.append("\n".join(lines).rstrip("\n"))
    _write_txt(path, "\n\n".join(blocks) + "\n")


def _write_txt(path, content: str) -> None:
    Path(path).write_text(content, encoding="utf-8", newline="\n")
