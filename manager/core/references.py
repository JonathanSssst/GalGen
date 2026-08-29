"""资产引用分析：统计每个资产被引用的次数与具体位置。

引用来源：
- 角色：default_standee、voice、standees[].asset_id
- 场景：background
- 剧情对话：standee、voice、bgm；选项：unlock_cg
- 结局：cg
"""

from __future__ import annotations

from typing import Dict, List

from .gg_format import GalGenProject


def analyze_asset_references(project: GalGenProject) -> Dict[str, List[dict]]:
    """返回 {资产ID: [{location, field}, ...]}，location 形如 characters/char_0001。"""
    refs: Dict[str, List[dict]] = {}

    def add(asset_id: str, location: str, field: str) -> None:
        if not asset_id:
            return
        refs.setdefault(asset_id, []).append({"location": location, "field": field})

    for c in project.characters:
        loc = f"characters/{c.id or '?'}"
        add(c.default_standee, loc, "default_standee")
        add(c.voice, loc, "voice")
        for st in c.standees:
            add(st.asset_id, loc, f"立绘「{st.name or st.asset_id}」")

    for s in project.scenes:
        add(s.background, f"scenes/{s.id or '?'}", "background")

    for sc in project.scripts:
        for d in sc.dialogs:
            loc = f"scripts/{sc.id or '?'}"
            add(d.standee, loc, "standee")
            add(d.voice, loc, "voice")
            add(d.video_asset_id, loc, "video")
            for sfx in d.sfx:
                add(sfx.asset_id, loc, "音效")
            for o in d.options:
                add(o.unlock_cg, loc, "选项解锁CG")

    for fn in project.functions:
        loc = f"functions/{fn.id or '?'}"
        add(fn.unlock_cg, loc, "解锁CG")

    for e in project.endings:
        add(e.cg, f"endings/{e.id or '?'}", "cg")

    return refs


def reference_summary(project: GalGenProject) -> Dict[str, dict]:
    """返回 {资产ID: {count, locations}} 汇总，供资产列表展示与排序。"""
    refs = analyze_asset_references(project)
    result = {}
    for asset_id, locs in refs.items():
        result[asset_id] = {"count": len(locs), "locations": locs}
    return result
