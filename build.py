#!/usr/bin/env python3
"""統計方法踩雷圖鑑 — 建置腳本與格式檢查器。

用法：
    python build.py           檢查所有內容並產生 docs/
    python build.py --check   只檢查，不寫檔

規則的說明在 AGENTS.md；這個檔案是那些規則的可執行版本。
"""
from __future__ import annotations

import datetime as dt
import re
import shutil
import sys
from pathlib import Path

import markdown
import yaml
from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).parent
CONTENT = ROOT / "content" / "methods"
DEMOS = ROOT / "demos"
ASSETS = ROOT / "assets"
OUT = ROOT / "docs"

SITE_TITLE = "統計方法踩雷圖鑑"
SITE_TAGLINE = "指標沒有錯，錯的是我們沒問它假設了什麼。"

# 分類的顯示順序。新增分類時要同步更新 AGENTS.md 第 5 節。
CATEGORIES = ["離群值偵測", "平滑與趨勢", "波動與通道", "關聯與迴歸", "檢定與推論"]

# 六個固定段落（順序即規定順序）
SECTIONS = ["它在做什麼", "它默默假設了什麼", "哪裡會壞掉", "親手試試看", "比較穩健的做法", "一句話帶走"]

SEVERITY_LABEL = {1: "略有偏差", 2: "訊號經常失真", 3: "結論可能相反"}
REQUIRED = ["title", "title_en", "category", "summary", "assumptions", "severity", "demo", "order", "updated"]
SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
DEMO_MARK = "[[demo]]"


class Page:
    def __init__(self, path: Path):
        self.path = path
        self.slug = path.stem
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.meta: dict = {}
        self.body = ""
        self.html = ""
        self._load()

    def err(self, msg: str):
        self.errors.append(f"{self.path.relative_to(ROOT)}: {msg}")

    def warn(self, msg: str):
        self.warnings.append(f"{self.path.relative_to(ROOT)}: {msg}")

    def _load(self):
        text = self.path.read_text(encoding="utf-8")
        m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
        if not m:
            self.err("缺少 YAML frontmatter（檔案要以 --- 開頭）")
            return
        try:
            self.meta = yaml.safe_load(m.group(1)) or {}
        except yaml.YAMLError as e:
            self.err(f"frontmatter 不是合法的 YAML：{e}")
            return
        self.body = m.group(2)

    # ---------- 檢查 ----------
    def validate(self, all_slugs: set[str]):
        if self.errors:
            return
        m = self.meta
        if not SLUG_RE.match(self.slug):
            self.err("檔名必須是英文小寫加連字號，例如 linear-regression.md")
        for key in REQUIRED:
            if key not in m or m[key] in (None, "", []):
                self.err(f"frontmatter 缺少必填欄位 `{key}`")
        if self.errors:
            return

        if len(str(m["title"])) > 12:
            self.err("`title` 不可超過 12 個字")
        if m["category"] not in CATEGORIES:
            self.err(f"`category` 必須是下列之一：{'、'.join(CATEGORIES)}")
        n = len(str(m["summary"]))
        if not 25 <= n <= 60:
            self.err(f"`summary` 要 25–60 個字（目前 {n} 個字）")
        a = m["assumptions"]
        if not isinstance(a, list) or not 2 <= len(a) <= 5:
            self.err("`assumptions` 要是 2–5 個項目的清單")
        elif any(len(str(x)) > 10 for x in a):
            self.err("`assumptions` 每個項目不可超過 10 個字")
        if m["severity"] not in (1, 2, 3):
            self.err("`severity` 必須是 1、2 或 3")
        if m["demo"] != self.slug:
            self.err(f"`demo` 必須等於 slug（{self.slug}）")
        elif not (DEMOS / f"{self.slug}.js").exists():
            self.err(f"找不到互動實驗檔 demos/{self.slug}.js")
        if not isinstance(m["order"], int):
            self.err("`order` 必須是整數")
        if not isinstance(m["updated"], dt.date):
            self.err("`updated` 必須是 YYYY-MM-DD 格式的日期")
        for r in m.get("related") or []:
            if r not in all_slugs:
                self.err(f"`related` 指向不存在的頁面：{r}")
            if r == self.slug:
                self.err("`related` 不可以指向自己")

        self._validate_body()

    def _validate_body(self):
        # 略過程式碼區塊後再檢查標題
        stripped = re.sub(r"```.*?```", "", self.body, flags=re.S)
        if re.search(r"^# ", stripped, re.M):
            self.err("內文不要寫一級標題（#），頁面標題由 `title` 產生")
        h2 = re.findall(r"^## +(.+?)\s*$", stripped, re.M)
        if h2 != SECTIONS:
            self.err("二級標題必須依序為：" + " → ".join(SECTIONS) + f"（目前是：{' → '.join(h2) or '無'}）")
            return
        if re.search(r"<(div|span|p|br|img|style|script)\b", stripped, re.I):
            self.err("不要在 Markdown 裡手寫 HTML")

        parts = re.split(r"^## +.+?\s*$", stripped, flags=re.M)[1:]
        sec = dict(zip(SECTIONS, parts))
        if stripped.count(DEMO_MARK) != 1 or DEMO_MARK not in sec["親手試試看"]:
            self.err("`[[demo]]` 必須恰好出現一次，而且在「親手試試看」段落")
        for name, text in sec.items():
            if "!!! pitfall" in text and name != "哪裡會壞掉":
                self.err(f"`pitfall` 提示框只能放在「哪裡會壞掉」（出現在「{name}」）")
            if "!!! robust" in text and name != "比較穩健的做法":
                self.err(f"`robust` 提示框只能放在「比較穩健的做法」（出現在「{name}」）")
        kinds = re.findall(r"^!!! +(\w+)", stripped, re.M)
        for k in kinds:
            if k not in ("pitfall", "robust", "note"):
                self.err(f"不支援的提示框類型：{k}")
        if kinds.count("note") > 2:
            self.err("`note` 提示框每頁最多兩個")
        if "!!! pitfall" not in sec["哪裡會壞掉"]:
            self.err("「哪裡會壞掉」至少要有一個 `pitfall` 提示框")
        if sec["哪裡會壞掉"].count("!!! pitfall") > 3:
            self.warn("「哪裡會壞掉」建議 2–3 個情境，目前超過 3 個")
        if "!!! robust" not in sec["比較穩健的做法"]:
            self.err("「比較穩健的做法」要有一個 `robust` 提示框")
        if "|" not in sec["比較穩健的做法"]:
            self.err("「比較穩健的做法」要有一個比較表")
        takeaway = sec["一句話帶走"].strip()
        if len(takeaway) > 60:
            self.err(f"「一句話帶走」不可超過 60 個字（目前 {len(takeaway)} 個字）")
        if "\n\n" in takeaway or takeaway.startswith(("-", "*")):
            self.err("「一句話帶走」只能有一段，不用條列")

    # ---------- 轉換 ----------
    def render(self):
        md = markdown.Markdown(extensions=["admonition", "tables", "fenced_code", "sane_lists"])
        html = md.convert(self.body)
        demo = (
            f'<div class="lab" id="lab" data-demo="{self.slug}">'
            '<noscript>這個互動實驗需要開啟 JavaScript。</noscript></div>'
        )
        html = html.replace(f"<p>{DEMO_MARK}</p>", demo)
        # 幫每個二級標題加上錨點，供頁內目錄使用
        for i, name in enumerate(SECTIONS, 1):
            html = html.replace(f"<h2>{name}</h2>", f'<h2 id="s{i}">{name}</h2>')
        html = html.replace("<table>", '<div class="table-wrap"><table>').replace("</table>", "</table></div>")
        self.html = html


def main() -> int:
    check_only = "--check" in sys.argv
    pages = [Page(p) for p in sorted(CONTENT.glob("*.md"))]
    slugs = {p.slug for p in pages}
    for p in pages:
        p.validate(slugs)

    errors = [e for p in pages for e in p.errors]
    warnings = [w for p in pages for w in p.warnings]
    if not pages:
        errors.append("content/methods/ 裡沒有任何方法頁")
    for w in warnings:
        print(f"⚠ 警告  {w}")
    if errors:
        for e in errors:
            print(f"✗ 錯誤  {e}")
        print(f"\n建置中止：{len(errors)} 個錯誤。請依 AGENTS.md 修正後再執行。")
        return 1
    if check_only:
        print(f"✓ 檢查通過：{len(pages)} 篇方法頁")
        return 0

    pages.sort(key=lambda p: (CATEGORIES.index(p.meta["category"]), p.meta["order"], p.slug))
    by_slug = {p.slug: p for p in pages}
    groups = [(c, [p for p in pages if p.meta["category"] == c]) for c in CATEGORIES]
    groups = [(c, ps) for c, ps in groups if ps]

    env = Environment(loader=FileSystemLoader(ROOT / "templates"), autoescape=select_autoescape(["html"]))
    common = dict(
        site_title=SITE_TITLE, site_tagline=SITE_TAGLINE, groups=groups,
        severity_label=SEVERITY_LABEL, sections=SECTIONS, year=dt.date.today().year,
    )

    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "methods").mkdir(parents=True)
    shutil.copytree(ASSETS, OUT / "assets")
    shutil.copytree(DEMOS, OUT / "demos")
    (OUT / ".nojekyll").write_text("")

    (OUT / "index.html").write_text(
        env.get_template("index.html").render(root="", pages=pages, current=None, **common), encoding="utf-8")

    for i, p in enumerate(pages):
        p.render()
        related = [by_slug[s] for s in (p.meta.get("related") or [])]
        html = env.get_template("method.html").render(
            root="../", page=p, current=p.slug, related=related,
            prev=pages[i - 1] if i > 0 else None,
            next=pages[i + 1] if i < len(pages) - 1 else None, **common)
        (OUT / "methods" / f"{p.slug}.html").write_text(html, encoding="utf-8")

    print(f"✓ 建置完成：{len(pages)} 篇方法頁 → docs/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
