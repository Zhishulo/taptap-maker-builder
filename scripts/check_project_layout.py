#!/usr/bin/env python3
"""项目目录结构核对（只读，不写任何文件）。

用法：
  python check_project_layout.py <项目根目录>
  python check_project_layout.py <项目根目录> --json

退出码：0 结构正常；1 有告警（缺目录/超限/重名）；2 路径不存在或不是目录。

作用：本地 MCP 模式下，动手前先看清 assets、scripts 等现状，避免覆盖用户已有资源。
所有"缺少"只提示，不创建任何东西。
"""

import json
import os
import sys
import zipfile

# 文档记录的素材体积上限（字节）；如与在线文档不符，以在线文档为准
LIMITS = {
    ".png": 16 * 1024 * 1024,
    ".jpg": 16 * 1024 * 1024,
    ".jpeg": 16 * 1024 * 1024,
    ".webp": 16 * 1024 * 1024,
    ".gif": 16 * 1024 * 1024,
    ".mp3": 16 * 1024 * 1024,
    ".ogg": 16 * 1024 * 1024,
    ".wav": 16 * 1024 * 1024,
    ".mp4": 50 * 1024 * 1024,
    ".mov": 50 * 1024 * 1024,
    ".skel": 16 * 1024 * 1024,
    ".atlas": 16 * 1024 * 1024,
    ".glb": 50 * 1024 * 1024,
}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
AUDIO_EXT = {".mp3", ".ogg", ".wav", ".m4a"}
VIDEO_EXT = {".mp4", ".mov"}

EXPECTED_DIRS = [("assets", "素材与模型根目录"), ("scripts", "Lua 脚本目录")]
EXPECTED_FILES = [("settings.json", "项目设置"), ("resources.json", "素材资源映射")]
SKIP_DIRS = {".git", "node_modules", ".idea", ".vscode", "__pycache__", "sucai"}


def human(n):
    if n >= 1024 * 1024:
        return "%.1f MB" % (n / 1024.0 / 1024.0)
    if n >= 1024:
        return "%.0f KB" % (n / 1024.0)
    return "%d B" % n


def scan(root):
    files = []
    for cur, dirs, names in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for nm in names:
            p = os.path.join(cur, nm)
            rel = os.path.relpath(p, root)
            try:
                size = os.path.getsize(p)
            except OSError:
                continue
            files.append((rel, size))
    return files


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    as_json = "--json" in argv
    if len(args) < 2:
        print("用法：python check_project_layout.py <项目根目录> [--json]")
        return 2

    root = os.path.abspath(args[1])
    if not os.path.isdir(root):
        print("[错误] 目录不存在：%s" % root)
        return 2

    problems = []
    warnings = []
    infos = []

    for d, why in EXPECTED_DIRS:
        p = os.path.join(root, d)
        if os.path.isdir(p):
            n = len(os.listdir(p))
            infos.append("目录 %s/ 存在（%d 项，%s）。" % (d, n, why))
        else:
            warnings.append("缺少 %s/（%s）。本地项目通常需要它；不要擅自创建，先确认项目根是否正确。" % (d, why))

    for f, why in EXPECTED_FILES:
        p = os.path.join(root, f)
        if os.path.isfile(p):
            infos.append("文件 %s 存在（%s）。" % (f, why))
        else:
            warnings.append("未找到 %s（%s）；确认是否为 Maker 工作区根目录。" % (f, why))

    files = scan(root)
    by_ext = {}
    dup = {}
    for rel, size in files:
        ext = os.path.splitext(rel)[1].lower()
        by_ext[ext] = by_ext.get(ext, 0) + 1
        base = os.path.basename(rel).lower()
        dup.setdefault(base, []).append(rel)

    if not files:
        warnings.append("工作区为空，确认是否已 clone 或初始化项目。")

    for rel, size in files:
        ext = os.path.splitext(rel)[1].lower()
        cap = LIMITS.get(ext)
        if cap and size > cap:
            problems.append("超限：%s 为 %s，超过 %s 上限。" % (rel, human(size), human(cap)))
        if ext == ".zip":
            try:
                with zipfile.ZipFile(os.path.join(root, rel)) as z:
                    cnt = len(z.namelist())
                if cnt > 500:
                    problems.append("压缩包 %s 含 %d 个文件，超过 500 上限。" % (rel, cnt))
            except Exception as e:
                warnings.append("压缩包 %s 无法读取（%s），请人工确认。" % (rel, e))

    for base, paths in sorted(dup.items()):
        if len(paths) > 1:
            warnings.append("同名文件 %d 份：%s；确认引用的是哪一个。" % (len(paths), " | ".join(sorted(paths))))

    for rel, size in files:
        depth = rel.count(os.sep)
        if depth > 4:
            warnings.append("目录层级过深（%d 层）：%s；素材层级建议不超过 4 层。" % (depth, rel))

    n_img = sum(v for k, v in by_ext.items() if k in IMAGE_EXT)
    n_aud = sum(v for k, v in by_ext.items() if k in AUDIO_EXT)
    n_vid = sum(v for k, v in by_ext.items() if k in VIDEO_EXT)
    total = sum(s for _, s in files)

    if os.path.exists(os.path.join(root, ".git")):
        infos.append("存在 .git/：改文件前先确认工作区是否干净，便于回滚。")
    else:
        warnings.append("没有 .git/：覆盖文件无法回滚，动手前先做备份。")

    gi = os.path.join(root, ".gitignore")
    if os.path.isfile(gi):
        try:
            txt = open(gi, "r", encoding="utf-8", errors="replace").read()
        except OSError:
            txt = ""
        for need in ("sucai", "*.tmp", "*.partial"):
            if need not in txt:
                warnings.append(".gitignore 未覆盖 %s；中间产物可能被提交。" % need)
    else:
        warnings.append("缺少 .gitignore：中间素材（sucai/、*.tmp）容易被提交。")

    if as_json:
        print(json.dumps({
            "root": root,
            "file_count": len(files),
            "total_size": total,
            "images": n_img, "audio": n_aud, "videos": n_vid,
            "problems": problems, "warnings": warnings, "infos": infos,
            "ok": not problems,
        }, ensure_ascii=False, indent=2))
        return 0 if not problems else 1

    print("== 项目结构核对 ==")
    print("根目录：%s" % root)
    print("文件：%d 个，合计 %s（图 %d / 音 %d / 视频 %d）" % (len(files), human(total), n_img, n_aud, n_vid))
    print()
    for i in infos:
        print("  [信息] " + i)
    for w in warnings:
        print("  [告警] " + w)
    for p in problems:
        print("  [阻断] " + p)
    print()
    if problems:
        print("结论：有 %d 项超限，先处理再继续。" % len(problems))
        return 1
    print("结论：结构未发现阻断问题。告警项请在阶段 0 向用户确认后再动文件。")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
