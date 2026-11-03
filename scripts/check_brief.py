#!/usr/bin/env python3
"""五要素完整性检查（离线、确定性）。

用法：
  python check_brief.py brief.json            # 检查并输出报告
  python check_brief.py brief.json --json     # 输出 JSON 结论

退出码：0 通过；1 存在缺失或提示；2 输入错误（文件不存在 / JSON 非法 / 顶层不是对象）。

brief.json 建议结构：
{
  "game_name": "示例",
  "five_elements": {
    "gameplay_goal": "玩家控制...",
    "presentation": "2D 竖屏，像素风",
    "controls": "手指按住屏幕下半区左右拖动",
    "core_loop": "躲避障碍 -> 得分 -> 速度变快 -> 再躲避",
    "first_round_scope": "只做单场景躲避与分数"
  },
  "first_round_excludes": ["商店", "排行榜"],
  "open_questions": ["横屏还是竖屏？"]
}
也接受扁平写法：把五个键直接放在顶层。
"""

import json
import re
import sys

FIELDS = [
    ("gameplay_goal", "玩法目标", "玩家要做什么、怎样算成功/失败"),
    ("presentation", "表现形式", "2D/3D、视角、横竖屏、美术风格、UI 主题"),
    ("controls", "操作方式", "输入方式与核心动作"),
    ("core_loop", "核心循环", "重复行为与难度/成长变化"),
    ("first_round_scope", "首轮范围", "第一轮只做什么"),
]

MIN_LEN = 8
# 常见"没写清"的信号词：出现即给出提示，但不判失败
VAGUE_WORDS = ("看情况", "待定", "随便", "类似", "等等", "什么都可以", "TODO", "TBD")


def load(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print("[错误] 找不到文件：%s" % path)
        sys.exit(2)
    except json.JSONDecodeError as e:
        print("[错误] JSON 解析失败：第 %s 行第 %s 列：%s" % (e.lineno, e.colno, e.msg))
        sys.exit(2)
    if not isinstance(data, dict):
        print("[错误] 顶层必须是 JSON 对象，当前是 %s" % type(data).__name__)
        sys.exit(2)
    return data


def get_elements(data):
    inner = data.get("five_elements")
    if inner is None:
        return {k: data.get(k) for k, _, _ in FIELDS}, False
    if not isinstance(inner, dict):
        print("[错误] five_elements 必须是对象")
        sys.exit(2)
    # 允许中文键名
    zh = {label: key for key, label, _ in FIELDS}
    out = {}
    for key, label, _ in FIELDS:
        val = inner.get(key)
        if val is None:
            val = inner.get(label)
        out[key] = val
    return out, True


def normalize(val):
    if val is None:
        return ""
    if isinstance(val, (list, tuple)):
        return "；".join(str(v).strip() for v in val if str(v).strip())
    if isinstance(val, bool):
        return "是" if val else "否"
    return str(val).strip()


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    as_json = "--json" in argv
    if len(args) < 2:
        print("用法：python check_brief.py <brief.json> [--json]")
        return 2

    data = load(args[1])
    elements, nested = get_elements(data)

    problems = []
    warnings = []
    report = {}

    for key, label, hint in FIELDS:
        value = normalize(elements.get(key))
        if not value:
            problems.append("%s：缺失。需要说明：%s" % (label, hint))
        elif len(value) < MIN_LEN:
            problems.append("%s：过短（%d 字，建议 >= %d）：%s" % (label, len(value), MIN_LEN, value))
        else:
            hit = [w for w in VAGUE_WORDS if w in value]
            if hit:
                warnings.append("%s：含模糊词 %s，建议写具体（%s）" % (label, "、".join(hit), value))
        report[key] = {"label": label, "value": value, "ok": bool(value) and len(value) >= MIN_LEN}

    excludes = data.get("first_round_excludes") or data.get("首轮不做什么") or []
    if isinstance(excludes, str):
        excludes = [excludes]
    excludes = [str(x).strip() for x in excludes if str(x).strip()]
    if not excludes:
        problems.append("首轮不做什么：缺失。不写清易导致首轮范围膨胀。")

    questions = data.get("open_questions") or data.get("待确认问题") or []
    if isinstance(questions, str):
        questions = [questions]
    questions = [str(x).strip() for x in questions if str(x).strip()]
    if len(questions) > 4:
        warnings.append("待确认问题 %d 个，超过 4 个：挑最关键的 4 个先问，其余留到后续阶段。" % len(questions))

    loop = normalize(elements.get("core_loop"))
    if loop:
        seps = len(re.findall(r"(->|→|然后|接着|再)", loop))
        if seps < 2:
            warnings.append("核心循环：建议写成 3 段以上可重复的链路（做 → 得到 → 变难 → 再做）。")

    passed = not problems
    if as_json:
        print(json.dumps({
            "passed": passed,
            "problems": problems,
            "warnings": warnings,
            "elements": report,
            "excludes": excludes,
            "open_questions": questions,
            "nested_five_elements": nested,
        }, ensure_ascii=False, indent=2))
        return 0 if passed else 1

    print("== 策划案五要素检查 ==")
    for key, label, hint in FIELDS:
        r = report[key]
        mark = "[OK]" if r["ok"] else "[缺失/过短]"
        print("%-8s %s %s" % (mark, label, r["value"] or "（空）"))
    print()
    print("首轮不做什么：%s" % ("、".join(excludes) if excludes else "（未写）"))
    print("待确认问题：%d 个" % len(questions))
    for i, q in enumerate(questions, 1):
        print("  %d. %s" % (i, q))
    print()
    if problems:
        print("必须补齐：")
        for p in problems:
            print("  - " + p)
    else:
        print("五要素齐全。")
    if warnings:
        print("建议改进：")
        for w in warnings:
            print("  * " + w)
    print()
    print("结论：%s" % ("通过，可进入阶段 2 写首轮需求。" if passed else "未通过，先补齐再进入阶段 2。"))
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
