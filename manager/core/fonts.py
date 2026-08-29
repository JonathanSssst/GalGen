"""系统字体列表获取（中文前置，格式化名称）。"""

from __future__ import annotations

from typing import Dict, List

_CN_KEYWORDS = (
    "宋", "黑", "楷", "仿", "隶", "微软雅黑", "雅黑", "等线", "幼圆", "华文",
    "明体", "明朝", "新细明体", "标楷体", "仿宋", "方正", "汉仪", "方正舒体", "隶书",
    "圆体", "姚体", "中易", "STZhongsong", "DengXian", "Microsoft YaHei", "SimSun",
    "SimHei", "KaiTi", "FangSong", "STKaiti", "STSong", "STFangsong", "Microsoft JhengHei",
    "PMingLiU", "MingLiU", "DFKai", "Noto Sans CJK", "Noto Serif CJK",
    "微软雅黑 UI", "Microsoft YaHei UI",
)

_cache: Dict[str, list] = {}


def _enumerate_win_fonts() -> List[str]:
    """Windows 通过注册表枚举系统字体。"""
    try:
        import winreg

        families = set()
        for hive in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
            try:
                key = winreg.OpenKey(
                    hive,
                    r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts",
                )
                i = 0
                while True:
                    try:
                        name, value, _ = winreg.EnumValue(key, i)
                    except OSError:
                        break
                    i += 1
                    # 去掉字体名里的中文字体后缀（如 (TrueType)）
                    base = name.split("(")[0].strip()
                    if base and " " in base:
                        # 尝试还原通用名；简单起见保留原始名，稍后统一取更短形式
                        pass
                    families.add(base)
            except OSError:
                continue
        return sorted(f for f in families if f)
    except Exception:  # noqa: BLE001 非 Windows 或注册表不可用
        return []


def _is_chinese_font(name: str) -> bool:
    low = name.lower()
    if any(k.lower() in low for k in _CN_KEYWORDS):
        return True
    return any("\u4e00" <= ch <= "\u9fff" for ch in name)


def list_fonts() -> dict:
    """返回 {cn: [字体名...], en: [字体名...]}。中文前置、格式化。"""
    if "result" in _cache:
        return _cache["result"]

    raw = _enumerate_win_fonts()
    # 去重保序
    seen = set()
    uniq = []
    for name in raw:
        if name and name.lower() not in seen:
            seen.add(name.lower())
            uniq.append(name)

    cn_fonts = [f for f in uniq if _is_chinese_font(f)]
    en_fonts = [f for f in uniq if not _is_chinese_font(f)]
    result = {"cn": cn_fonts, "en": en_fonts}
    _cache["result"] = result
    return result


def reset_cache() -> None:
    _cache.clear()
