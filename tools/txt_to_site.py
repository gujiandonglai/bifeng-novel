#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
txt_to_site.py —— TXT 小说 → 笔锋网站 自动发布工具

用法：
    python3 tools/txt_to_site.py

默认约定（可用命令行参数覆盖，见 --help）：
    输入目录：<项目根目录>/novels_txt/*.txt
    输出位置：<项目根目录>/books/<id>/ 与 <项目根目录>/data/books.json

功能：
    1. 批量读取 novels_txt/ 下所有 .txt（自动探测编码：utf-8 / gbk / gb18030）
    2. 从正文中自动识别「卷 / 部 / 阶段 / 篇」等卷名标题，以及
       「章 / 回 / 节 / 话」「楔子/序章/尾声/番外」等章节标题
    3. 按识别结果拆分正文，生成 0001.md、0002.md……（每章一个文件）
    4. 生成/更新该书的 books/<id>/book.json
    5. 生成占位封面 cover.svg（若已存在真实封面则不覆盖）
    6. 汇总更新根目录 data/books.json（按 id upsert，不影响其他手工维护的书籍）

设计要点（重要）：
    - 幂等：重复运行不会产生重复条目，同一本书按 id 覆盖更新
    - 「智能合并」：category / cover / intro / tags / rating / author 这些
      通常需要人工确认或润色的字段，如果 book.json 里已经存在人工修改过的值，
      再次运行脚本时会保留，不会被自动结果覆盖；
      而 chapters / words / status / update 这些直接由正文推导的字段，
      每次运行都会按最新正文重新生成，保证和 txt 同步。
    - 假设「一行 = 一段」的常见网文 txt 排版（自然段之间以空行分隔）。
      如果你的 txt 是长段落被强制换行（非空行断行），可能会被拆成多段，
      转换后建议抽查一两章效果。
"""

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import date, datetime

# ---------------------------------------------------------------------------
# 可调整的默认配置
# ---------------------------------------------------------------------------
DEFAULT_AUTHOR = "王东来"
DEFAULT_CATEGORY = "都市"          # 猜测失败时的兜底分类
VALID_CATEGORIES = ["玄幻", "都市", "武侠", "历史", "科幻",
                     "悬疑", "轻小说", "散文", "科普", "杂谈"]

# 简单的关键词打分分类器：命中越多，判定为该分类的可能性越大（仅供参考，务必人工复核）
CATEGORY_KEYWORDS = {
    "玄幻": ["修炼", "灵气", "修为", "仙", "法宝", "门派", "金丹", "元婴", "异兽", "大陆", "灵根", "功法"],
    "都市": ["公司", "总裁", "豪门", "创业", "都市", "直播", "网红", "继承", "家产", "上市", "高管"],
    "武侠": ["江湖", "武功", "侠客", "镖局", "内力", "轻功", "刀剑", "武林", "掌门", "师门"],
    "历史": ["皇帝", "朝廷", "大臣", "王朝", "穿越到", "古代", "皇宫", "科举", "陛下", "太子"],
    "科幻": ["星际", "飞船", "机器人", "基因", "量子", "外星", "宇宙", "克隆", "人工智能", "星域"],
    "悬疑": ["凶手", "案件", "侦探", "谋杀", "尸体", "警察", "推理", "失踪", "线索"],
    "轻小说": ["学院", "魔法少女", "异世界", "勇者", "冒险者", "公会", "转生"],
    "科普": ["原理", "科学实验", "理论", "物种", "科普"],
}

END_MARKERS = ["全文完", "完本感言", "已完结", "本书完", "（完）", "(完)", "全书完"]

# 卷名：第X卷 / 第X部 / 第X阶段 / 第X篇
VOLUME_RE = re.compile(
    r"^第[〇零一二三四五六七八九十百千两0-9]+(卷|部|阶段|篇)\s*[:：]?\s*.{0,40}$"
)
# 章节：第X章/回/节/话，或 楔子/序章/引子/尾声/终章/后记/番外
CHAPTER_RE = re.compile(
    r"^(第[〇零一二三四五六七八九十百千两0-9]+(章|回|节|话)\s*[:：]?\s*.{0,40}"
    r"|(楔子|序章|序言|引子|尾声|终章|后记|番外[〇零一二三四五六七八九十百千两0-9]*)\s*[:：]?\s*.{0,40})$"
)


# ---------------------------------------------------------------------------
# 读取与编码探测
# ---------------------------------------------------------------------------
def read_text_file(path):
    """依次尝试常见中文编码，返回统一为 \n 换行的文本。"""
    for enc in ("utf-8-sig", "utf-8", "gb18030", "gbk"):
        try:
            with open(path, "r", encoding=enc) as f:
                text = f.read()
            return text.replace("\r\n", "\n").replace("\r", "\n")
        except UnicodeDecodeError:
            continue
    raise ValueError(f"无法识别文件编码: {path}")


# ---------------------------------------------------------------------------
# 正文解析：拆出书名 + 章节列表
# ---------------------------------------------------------------------------
def parse_novel(text, fallback_title):
    lines = text.split("\n")

    # 第一行非空内容作为书名；若它本身像标题行，则退回用文件名
    idx = 0
    title = fallback_title
    while idx < len(lines):
        candidate = lines[idx].strip()
        if candidate:
            if not (VOLUME_RE.match(candidate) or CHAPTER_RE.match(candidate)):
                title = candidate
                idx += 1
            break
        idx += 1

    current_volume = None
    chapters = []      # [{"title":..., "volume":..., "paragraphs":[...]}]
    buffer = None

    def flush():
        if buffer and buffer["paragraphs"]:
            chapters.append(buffer)
        elif buffer:
            # 标题存在但正文为空的章节也保留，避免漏章
            chapters.append(buffer)

    for raw in lines[idx:]:
        line = raw.strip()
        if not line:
            continue
        if len(line) <= 60 and VOLUME_RE.match(line):
            current_volume = line
            continue
        if len(line) <= 60 and CHAPTER_RE.match(line):
            flush()
            buffer = {"title": line, "volume": current_volume, "paragraphs": []}
            continue
        if buffer is None:
            buffer = {"title": "前言", "volume": current_volume, "paragraphs": []}
        buffer["paragraphs"].append(line)
    flush()

    # 全文没有识别到任何标题格式 —— 兜底：整篇作为单章
    if not chapters:
        body = [l.strip() for l in lines[idx:] if l.strip()]
        chapters = [{"title": title, "volume": None, "paragraphs": body}]

    return title, chapters


# ---------------------------------------------------------------------------
# 派生字段
# ---------------------------------------------------------------------------
def make_id(stem):
    m = re.match(r"^(\d+)[_\-.\s]", stem)
    if m:
        return f"n{int(m.group(1)):03d}"
    h = hashlib.md5(stem.encode("utf-8")).hexdigest()[:6]
    return f"bk{h}"


def guess_category(full_text):
    sample = full_text[:4000]
    scores = {cat: sum(sample.count(kw) for kw in kws) for cat, kws in CATEGORY_KEYWORDS.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else DEFAULT_CATEGORY


def guess_status(full_text):
    tail = full_text[-300:]
    return "完结" if any(m in tail for m in END_MARKERS) else "连载"


def count_words(chapters):
    total = 0
    for ch in chapters:
        for p in ch["paragraphs"]:
            total += len(re.sub(r"\s+", "", p))
    return total


def make_intro(chapters):
    for ch in chapters:
        if ch["paragraphs"]:
            joined = "".join(ch["paragraphs"])[:120]
            return joined + ("…" if len("".join(ch["paragraphs"])) > 120 else "")
    return ""


COVER_GRADIENTS = [
    ("#2E86DE", "#173A5E"),
    ("#F5A623", "#173A5E"),
    ("#4DA3FF", "#F5A623"),
    ("#173A5E", "#2E86DE"),
]


def make_cover_svg(title, index):
    c1, c2 = COVER_GRADIENTS[index % len(COVER_GRADIENTS)]
    title_esc = title.replace("&", "&amp;").replace("<", "").replace(">", "")
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{c1}"/>
      <stop offset="100%" stop-color="{c2}"/>
    </linearGradient>
  </defs>
  <rect width="300" height="420" fill="url(#g)"/>
  <rect x="16" y="16" width="268" height="388" fill="none" stroke="#FFFFFF" stroke-width="1" opacity="0.5"/>
  <text x="150" y="200" font-family="'Noto Serif SC','SimSun',serif" font-size="34" fill="#FFFFFF" text-anchor="middle">{title_esc[:10]}</text>
  <text x="150" y="380" font-family="sans-serif" font-size="12" fill="#FFFFFF" text-anchor="middle" opacity="0.7">BIFENG NOVEL</text>
</svg>
"""


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
def process_file(txt_path, books_dir, author, index, report):
    stem = os.path.splitext(os.path.basename(txt_path))[0]
    text = read_text_file(txt_path)
    fallback_title = re.sub(r"^\d+[_\-.\s]*", "", stem).strip() or stem

    title, chapters = parse_novel(text, fallback_title)
    book_id = make_id(stem)
    book_dir = os.path.join(books_dir, book_id)
    os.makedirs(book_dir, exist_ok=True)

    # 写章节 md：0001.md, 0002.md ...
    chapter_entries = []
    for i, ch in enumerate(chapters, start=1):
        fname = f"{i:04d}.md"
        with open(os.path.join(book_dir, fname), "w", encoding="utf-8") as f:
            f.write(f"# {ch['title']}\n\n")
            f.write("\n\n".join(ch["paragraphs"]))
            f.write("\n")
        entry = {"title": ch["title"], "file": fname}
        if ch["volume"]:
            entry["volume"] = ch["volume"]
        chapter_entries.append(entry)

    words = count_words(chapters)
    status = guess_status(text)
    update_date = date.fromtimestamp(os.path.getmtime(txt_path)).isoformat()

    # 读取已有 book.json（若存在），保留人工润色过的字段
    book_json_path = os.path.join(book_dir, "book.json")
    existing = {}
    if os.path.exists(book_json_path):
        try:
            with open(book_json_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except (json.JSONDecodeError, OSError):
            existing = {}

    cover_name = existing.get("cover", "cover.svg")
    cover_path = os.path.join(book_dir, cover_name)
    if not os.path.exists(cover_path):
        with open(cover_path, "w", encoding="utf-8") as f:
            f.write(make_cover_svg(title, index))

    book_data = {
        "id": book_id,
        "title": existing.get("title", title),
        "author": existing.get("author", author),
        "cover": cover_name,
        "category": existing.get("category") or guess_category(text),
        "status": status,
        "words": words,
        "update": update_date,
        "views": existing.get("views", 0),
        "rating": existing.get("rating", 0),
        "intro": existing.get("intro") or make_intro(chapters),
        "tags": existing.get("tags", []),
        "chapters": chapter_entries,
    }
    with open(book_json_path, "w", encoding="utf-8") as f:
        json.dump(book_data, f, ensure_ascii=False, indent=2)

    report.append({
        "id": book_id,
        "title": book_data["title"],
        "chapters": len(chapter_entries),
        "words": words,
        "status": status,
        "category_guessed": "category" not in existing,
        "source": os.path.basename(txt_path),
    })
    return book_id, book_dir, book_data


def upsert_master_index(books_json_path, book_dir, book_data, root):
    if os.path.exists(books_json_path):
        with open(books_json_path, "r", encoding="utf-8") as f:
            master = json.load(f)
    else:
        master = []

    rel_path = os.path.relpath(book_dir, root).replace(os.sep, "/")
    existing_entry = next((b for b in master if b["id"] == book_data["id"]), None)

    entry = {
        "id": book_data["id"],
        "path": rel_path,
        "title": book_data["title"],
        "author": book_data["author"],
        "cover": f"{rel_path}/{book_data['cover']}",
        "category": book_data["category"],
        "status": book_data["status"],
        "words": book_data["words"],
        "update": book_data["update"],
        "views": existing_entry["views"] if existing_entry else book_data["views"],
        "rating": existing_entry["rating"] if existing_entry else book_data["rating"],
        "recommend": existing_entry["recommend"] if existing_entry else False,
        "intro": book_data["intro"],
    }

    if existing_entry:
        master[master.index(existing_entry)] = entry
    else:
        master.append(entry)

    with open(books_json_path, "w", encoding="utf-8") as f:
        json.dump(master, f, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(description="TXT 小说批量转换为笔锋网站数据")
    parser.add_argument("--root", default=".", help="项目根目录（默认当前目录）")
    parser.add_argument("--input", default=None, help="txt 所在目录（默认 <root>/novels_txt）")
    parser.add_argument("--author", default=DEFAULT_AUTHOR, help="新书默认作者名")
    args = parser.parse_args()

    root = os.path.abspath(args.root)
    input_dir = args.input or os.path.join(root, "novels_txt")
    books_dir = os.path.join(root, "books")
    books_json_path = os.path.join(root, "data", "books.json")

    if not os.path.isdir(input_dir):
        print(f"[错误] 找不到输入目录: {input_dir}")
        sys.exit(1)

    txt_files = sorted(f for f in os.listdir(input_dir) if f.lower().endswith(".txt"))
    if not txt_files:
        print(f"[提示] {input_dir} 下没有找到任何 .txt 文件")
        sys.exit(0)

    os.makedirs(books_dir, exist_ok=True)
    os.makedirs(os.path.dirname(books_json_path), exist_ok=True)

    report = []
    for i, fname in enumerate(txt_files):
        txt_path = os.path.join(input_dir, fname)
        try:
            book_id, book_dir, book_data = process_file(txt_path, books_dir, args.author, i, report)
            upsert_master_index(books_json_path, book_dir, book_data, root)
            print(f"[完成] {fname} → books/{book_id}/  "
                  f"({len(book_data['chapters'])} 章, 约 {book_data['words']} 字)")
        except Exception as e:
            print(f"[失败] {fname}: {e}")

    print("\n================ 转换汇总 ================")
    for r in report:
        flag = "（分类为自动猜测，建议人工核对）" if r["category_guessed"] else ""
        print(f"- {r['title']}（{r['id']}）: {r['chapters']} 章 / {r['words']} 字 / {r['status']} {flag}")
    print(f"\n共处理 {len(report)} 本书，已写入 {books_json_path}")
    print("现在可以直接把整个项目目录推送到 GitHub Pages 部署。")


if __name__ == "__main__":
    main()
