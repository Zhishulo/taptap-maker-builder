#!/usr/bin/env python3
"""发布物料核对（离线、只读）。

用法：
  python check_publish_materials.py materials.json
  python check_publish_materials.py materials.json --root <项目根> --json

退出码：0 通过；1 缺项/不合规；2 输入错误。

materials.json 示例：
{
  "orientation": "portrait",
  "first_release": true,
  "name": "星际捡垃圾",
  "intro": "拖动飞船躲避陨石并收集零件，坚持越久分数越高。",
  "developer_note": "这是我们第一次做小游戏，欢迎在反馈里告诉我们哪里难。",
  "materials": {
    "icon": "assets/ui/icon.png",
    "screenshots": ["assets/ui/shot1.png", "assets/ui/shot2.png", "assets/ui/shot3.png"],
    "promo_image": "assets/ui/promo.png",
    "landscape_cover": "assets/ui/cover_l.png",
    "portrait_cover": "assets/ui/cover_p.png",
    "square_promo": "assets/ui/square.png",
    "video": "assets/ui/demo.mp4"
  }
}

规则来自官方发布物料清单；尺寸、比例、格式以发布面板提示为准，本脚本不做像素级判断。
"""

import json
import os
import sys

MIN_TEXT = 10
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp"}
VIDEO_EXT = {".mp4", ".mov"}
SIZE_CAP = 16 * 1024 * 1024
VIDEO_CAP = 50 * 1024 * 1024

REQUIRED = [
    ("icon", "游戏图标"),
    ("promo_image", "宣传图"),
    ("landscape_cover", "横版封面"),
    ("portrait_cover", "竖版封面"),
]


def cjk_len(text):
    return len("".join(str(text).split()))


def resolve(root, rel):
    if not rel:
        return None
    p = rel if os.path.isabs(rel) else os.path.join(root, rel)
    return p


def check_file(root, rel, label, expect, problems):
    if not rel:
        problems.append("%s：缺失。" % label)
        return None
    p = resolve(root, rel)
    if not os.path.isfile(p):
        problems.append("%s：文件不存在：%s" % (label, rel))
        return None
    ext = os.path.splitext(p)[1].lower()
    if expect == "image" and ext not in IMAGE_EXT:
        problems.append("%s：扩展名 %s 不像图片（允许 %s）。" % (label, ext, "/".join(sorted(IMAGE_EXT))))
    if expect == "video" and ext not in VIDEO_EXT:
        problems.append("%s：扩展名 %s 不像视频（允许 %s）。" % (label, ext, "/".join(sorted(VIDEO_EXT))))
    size = os.path.getsize(p)
    cap = VIDEO_CAP if expect == "video" else SIZE_CAP
    if size > cap:
        problems.append("%s：%s 超过 %.0f MB 上限。" % (label, rel, cap / 1024.0 / 1024.0))
    return p


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    as_json = "--json" in argv
    root = "."
    if "--root" in argv:
        i = argv.index("--root")
        if i + 1 < len(argv):
            root = argv[i + 1]
            args = [a for a in args if a != root]
    if len(args) < 2:
        print("用法：python check_publish_materials.py <materials.json> [--root <项目根>] [--json]")
        return 2

    try:
        with open(args[1], "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print("[错误] 找不到文件：%s" % args[1])
        return 2
    except json.JSONDecodeError as e:
        print("[错误] JSON 解析失败：第 %s 行第 %s 列：%s" % (e.lineno, e.colno, e.msg))
        return 2
    if not isinstance(data, dict):
        print("[错误] 顶层必须是 JSON 对象")
        return 2

    root = os.path.abspath(root)
    problems = []
    warnings = []
    passed_items = []

    orientation = str(data.get("orientation", "")).strip().lower()
    if orientation not in ("portrait", "landscape", "竖屏", "横屏"):
        warnings.append("orientation 建议填 portrait（竖屏）或 landscape（横屏），当前为 %r。" % orientation)
    portrait = orientation in ("portrait", "竖屏")

    first_release = bool(data.get("first_release", True))

    name = str(data.get("name", "")).strip()
    if not name:
        problems.append("游戏名称：缺失。")
    elif len(name) > 20:
        warnings.append("游戏名称较长（%d 字），展示位可能截断，建议 <= 20 字。" % len(name))
    else:
        passed_items.append("游戏名称：" + name)

    intro = str(data.get("intro", ""))
    n = cjk_len(intro)
    if n < MIN_TEXT:
        problems.append("游戏简介：%d 字，官方要求不少于 %d 字。" % (n, MIN_TEXT))
    else:
        passed_items.append("游戏简介：%d 字" % n)

    dev = str(data.get("developer_note", ""))
    n2 = cjk_len(dev)
    if n2 < MIN_TEXT:
        problems.append("开发者的话：%d 字，官方要求不少于 %d 字。" % (n2, MIN_TEXT))
    else:
        passed_items.append("开发者的话：%d 字" % n2)
    if dev.strip() and dev.strip() == intro.strip():
        warnings.append("开发者的话与简介完全相同，建议写成不同的口吻。")

    mats = data.get("materials")
    if not isinstance(mats, dict):
        mats = {}
    for key, label in REQUIRED:
        if check_file(root, mats.get(key) or data.get(key), label, "image", problems):
            passed_items.append(label + "：已就位")

    shots = mats.get("screenshots") or data.get("screenshots") or []
    if isinstance(shots, str):
        shots = [shots]
    shots = [s for s in shots if str(s).strip()]
    if len(shots) < 3:
        problems.append("游戏截图：%d 张，官方要求至少 3 张。" % len(shots))
    else:
        ok = 0
        for i, s in enumerate(shots, 1):
            if check_file(root, s, "截图 %d" % i, "image", problems):
                ok += 1
        if ok >= 3:
            passed_items.append("游戏截图：%d 张已就位" % ok)
        if len(set(shots)) != len(shots):
            warnings.append("截图列表有重复项。")

    square = mats.get("square_promo") or data.get("square_promo")
    if portrait:
        if check_file(root, square, "方形宣传图（竖屏游戏必需）", "image", problems):
            passed_items.append("方形宣传图：已就位")
    elif square:
        check_file(root, square, "方形宣传图", "image", problems)

    video = mats.get("video") or data.get("video")
    if first_release:
        if check_file(root, video, "实机测试视频（首次发布必需）", "video", problems):
            passed_items.append("实机测试视频：已就位")
    elif video:
        check_file(root, video, "实机测试视频", "video", problems)

    if as_json:
        print(json.dumps({
            "passed": not problems,
            "problems": problems,
            "warnings": warnings,
            "passed_items": passed_items,
            "root": root,
        }, ensure_ascii=False, indent=2))
        return 0 if not problems else 1

    print("== 发布物料核对 ==")
    print("项目根：%s" % root)
    print("方向：%s  首次发布：%s" % ("竖屏" if portrait else ("横屏" if orientation in ("landscape", "横屏") else "未指定"), "是" if first_release else "否"))
    print()
    for p in passed_items:
        print("  [OK] " + p)
    for w in warnings:
        print("  [告警] " + w)
    for p in problems:
        print("  [缺项] " + p)
    print()
    if problems:
        print("结论：还差 %d 项，补齐后再进入发布流程。" % len(problems))
        return 1
    print("结论：清单级检查通过。尺寸、比例、内容合规仍以发布面板与人工确认为准。")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
