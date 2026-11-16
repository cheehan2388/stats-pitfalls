#!/usr/bin/env python3
"""時間序列白話 Wiki — 建置腳本與規則檢查器。

用法：
    python build.py           檢查所有頁面並產生 docs/
    python build.py --check   只檢查，不寫檔

規則的說明在 AGENTS.md；這個檔案是那些規則的可執行版本。
"""
from __future__ import annotations

import datetime as dt
import html as htmllib
import re
import shutil
import sys
from pathlib import Path

import markdown
import yaml
from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).parent
WIKI = ROOT / "wiki"
DEMOS = ROOT / "demos"
ASSETS = ROOT / "assets"
OUT = ROOT / "docs"

SITE_TITLE = "時間序列白話 Wiki"
SITE_TAGLINE = "從零看懂時間序列模型，再把它接到量化交易上。"

TYPES = ["概念", "工具", "模型", "應用"]          # 同步 AGENTS.md 第 5 節
LEVELS = {1: "入門", 2: "進階", 3: "深入"}
SECTIONS = ["一句話", "生活中的比喻", "它到底在說什麼", "親手試試看", "量化交易怎麼用", "常見誤解"]
DEMO_SECTION = "親手試試看"
REQUIRED = ["title", "title_en", "type", "level", "summary", "prereqs", "sources", "demo", "updated"]
MAX_BODY = 2200
BANNED = ["穩賺", "保證獲利", "必漲", "必跌", "建議買進", "建議賣出", "穩定獲利", "無風險獲利"]
SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
LINK_RE = re.compile(r"\[\[([a-z0-9-]+)(?:\|([^\]\n]+))?\]\]")
DEMO_MARK = "{{demo}}"
CODE_RE = re.compile(r"```.*?```", re.S)


class Page:
    def __init__(self, path: Path):
        self.path, self.slug = path, path.stem
        self.errors: list[str] = []
        self.meta: dict = {}
        self.body = self.html = ""
        self.links: list[str] = []      # 連出去的 slug（去重、保留順序）
        self.backlinks: list["Page"] = []
        text = path.read_text(encoding="utf-8")
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
        prose = CODE_RE.sub("", self.body)
        self.links = list(dict.fromkeys(s for s, _ in LINK_RE.findall(prose)))

    def err(self, msg: str):
        self.errors.append(f"wiki/{self.path.name}: {msg}")

    @property
    def has_demo(self) -> bool:
        return self.meta.get("demo") not in (None, "none", "")

    @property
    def sections(self) -> list[str]:
        return [s for s in SECTIONS if s != DEMO_SECTION or self.has_demo]

    # ---------- 檢查 ----------
    def validate(self, pages: dict[str, "Page"]):
        if self.errors:
            return
        m = self.meta
        if not SLUG_RE.match(self.slug):
            self.err("檔名必須是英文小寫加連字號，例如 ar-model.md")
        for key in REQUIRED:
            if key not in m or m[key] in (None, ""):
                self.err(f"frontmatter 缺少必填欄位 `{key}`")
        if self.errors:
            return
        if len(str(m["title"])) > 12:
            self.err("`title` 不可超過 12 個字")
        if m["type"] not in TYPES:
            self.err(f"`type` 必須是下列之一：{'、'.join(TYPES)}")
        if m["level"] not in LEVELS:
            self.err("`level` 必須是 1、2 或 3")
        n = len(str(m["summary"]))
        if not 20 <= n <= 50:
            self.err(f"`summary` 要 20–50 個字（目前 {n} 個字）")
        if not isinstance(m["prereqs"], list):
            self.err("`prereqs` 要是清單（沒有就寫 []）")
        else:
            for p in m["prereqs"]:
                if p not in pages:
                    self.err(f"`prereqs` 指向不存在的頁面：{p}（先備頁面必須已經存在）")
                if p == self.slug:
                    self.err("`prereqs` 不可以指向自己")
        if not isinstance(m["sources"], list) or not m["sources"]:
            self.err("`sources` 至少要有一項（見 AGENTS.md 第 8 節）")
        else:
            for s in m["sources"]:
                hit = re.search(r"raw/[^\s，。、）)]+", str(s))
                if hit and not (ROOT / hit.group(0)).exists():
                    self.err(f"`sources` 提到的檔案不存在：{hit.group(0)}")
        if self.has_demo:
            if m["demo"] != self.slug:
                self.err(f"`demo` 必須等於 slug（{self.slug}）或 none")
            elif not (DEMOS / f"{self.slug}.js").exists():
                self.err(f"找不到互動實驗檔 demos/{self.slug}.js")
        if not isinstance(m["updated"], dt.date):
            self.err("`updated` 必須是 YYYY-MM-DD 格式的日期")
        self._validate_body(pages)

    def _validate_body(self, pages):
        prose = CODE_RE.sub("", self.body)
        if re.search(r"^# ", prose, re.M):
            self.err("內文不要寫一級標題（#）")
        want = self.sections
        h2 = re.findall(r"^## +(.+?)\s*$", prose, re.M)
        if h2 != want:
            self.err("二級標題必須依序為：" + " → ".join(want) + f"（目前是：{' → '.join(h2) or '無'}）")
            return
        if re.search(r"<(div|span|p|br|img|style|script|a)\b", prose, re.I):
            self.err("不要在 Markdown 裡手寫 HTML")

        full = dict(zip(want, re.split(r"^## +.+?\s*$", self.body, flags=re.M)[1:]))
        sec = {k: CODE_RE.sub("", v) for k, v in full.items()}

        one = sec["一句話"].strip()
        if len(one) > 50:
            self.err(f"「一句話」不可超過 50 個字（目前 {len(one)} 個字）")
        if "\n\n" in one or one.startswith(("-", "*", "!")):
            self.err("「一句話」只能有一段文字")

        if self.has_demo:
            if self.body.count(DEMO_MARK) != 1 or DEMO_MARK not in sec[DEMO_SECTION]:
                self.err("`{{demo}}` 必須恰好出現一次，而且在「親手試試看」段落")
        elif DEMO_MARK in self.body:
            self.err("`demo: none` 的頁面不可以有 `{{demo}}`")

        kinds = re.findall(r"^!!! +(\w+)", prose, re.M)
        for k in set(kinds) - {"quant", "myth", "note"}:
            self.err(f"不支援的提示框類型：{k}")
        for name, text in sec.items():
            if "!!! quant" in text and name != "量化交易怎麼用":
                self.err(f"`quant` 提示框只能放在「量化交易怎麼用」（出現在「{name}」）")
            if "!!! myth" in text and name != "常見誤解":
                self.err(f"`myth` 提示框只能放在「常見誤解」（出現在「{name}」）")
        if kinds.count("quant") != 1:
            self.err(f"`quant` 提示框每頁恰好一個（目前 {kinds.count('quant')} 個）")
        if not 1 <= kinds.count("myth") <= 3:
            self.err(f"`myth` 提示框每頁 1–3 個（目前 {kinds.count('myth')} 個）")
        if kinds.count("note") > 2:
            self.err("`note` 提示框每頁最多 2 個")

        formulas = {k: v.count("```formula") for k, v in full.items()}
        if sum(formulas.values()) > 2:
            self.err("公式每頁最多 2 個")
        if any(n and k != "它到底在說什麼" for k, n in formulas.items()):
            self.err("公式只能放在「它到底在說什麼」")
        codes = {k: v.count("```python") for k, v in full.items()}
        if sum(codes.values()) > 1 or any(n and k != "量化交易怎麼用" for k, n in codes.items()):
            self.err("程式碼每頁最多 1 個，而且只能放在「量化交易怎麼用」")
        for block in re.findall(r"```python\n(.*?)```", self.body, re.S):
            if len([l for l in block.splitlines() if l.strip()]) > 10:
                self.err("程式碼區塊不可超過 10 行")
        if len(re.findall(r"^\|[ :|-]+\|\s*$", prose, re.M)) > 1:
            self.err("表格每頁最多 1 個")

        length = len(re.sub(r"\s", "", LINK_RE.sub(lambda m: m.group(2) or "", prose)))
        if length > MAX_BODY:
            self.err(f"內文超過 {MAX_BODY} 個字（目前 {length}）。這一頁可能塞了不只一個知識點，請拆頁")
        for word in BANNED:
            if word in self.body:
                self.err(f"出現不允許的字眼「{word}」（本站不寫投資建議與績效保證）")

        others = [s for s in self.links if s != self.slug]
        if len(others) < 2:
            self.err(f"每一頁至少要用 [[ ]] 連到 2 個不同的頁面（目前 {len(others)} 個）")
        if self.slug in self.links:
            self.err("頁面不可以連到自己")
        for slug, text in LINK_RE.findall(prose):
            if slug not in pages and not text:
                self.err(f"[[{slug}]] 還沒有頁面，必須提供顯示文字：[[{slug}|中文名稱]]")

    # ---------- 轉換 ----------
    def render(self, pages: dict[str, "Page"], root: str = ""):
        self.html = render_markdown(self.body, pages, root)
        demo = (f'<div class="lab" id="lab" data-demo="{self.slug}">'
                '<noscript>這個互動實驗需要開啟 JavaScript。</noscript></div>')
        self.html = self.html.replace(f"<p>{DEMO_MARK}</p>", demo)
        for i, name in enumerate(self.sections, 1):
            self.html = self.html.replace(f"<h2>{name}</h2>", f'<h2 id="s{i}">{name}</h2>')


def render_markdown(text: str, pages: dict[str, Page], root: str) -> str:
    """把 [[連結]] 換成佔位符 → 轉 Markdown → 換回 HTML 連結（程式碼區塊內的不處理）。"""
    stash: list[str] = []

    def link(m: re.Match) -> str:
        slug, label = m.group(1), m.group(2)
        if slug in pages:
            out = f'<a class="wl" href="{root}{slug}.html">{htmllib.escape(label or pages[slug].meta["title"])}</a>'
        else:
            out = f'<span class="wl wanted" title="這一頁還沒寫">{htmllib.escape(label or slug)}</span>'
        stash.append(out)
        return f"\ue000{len(stash) - 1}\ue001"

    parts = re.split(r"(```.*?```)", text, flags=re.S)
    text = "".join(p if p.startswith("```") else LINK_RE.sub(link, p) for p in parts)
    out = markdown.Markdown(extensions=["admonition", "tables", "fenced_code", "sane_lists"]).convert(text)
    out = re.sub("\ue000(\\d+)\ue001", lambda m: stash[int(m.group(1))], out)
    return out.replace("<table>", '<div class="table-wrap"><table>').replace("</table>", "</table></div>")


def learning_path(pages: dict[str, Page]) -> tuple[list[Page], list[str]]:
    """依先備關係排序（先備的排前面），同一層依難度、標題排序。有循環時回報錯誤。"""
    done: list[Page] = []
    left = dict(pages)
    while left:
        ready = [p for p in left.values() if all(q not in left for q in p.meta["prereqs"])]
        if not ready:
            return done, ["`prereqs` 出現循環：" + "、".join(sorted(left))]
        ready.sort(key=lambda p: (p.meta["level"], TYPES.index(p.meta["type"]), p.slug))
        done.append(ready[0])
        del left[ready[0].slug]
    return done, []


def main() -> int:
    check_only = "--check" in sys.argv
    pages = {p.stem: Page(p) for p in sorted(WIKI.glob("*.md")) if p.stem != "log" and not p.stem.startswith("_")}
    for p in pages.values():
        p.validate(pages)
    errors = [e for p in pages.values() for e in p.errors]
    warnings: list[str] = []
    if not pages:
        errors.append("wiki/ 裡沒有任何頁面")

    log_path = WIKI / "log.md"
    log_text = log_path.read_text(encoding="utf-8") if log_path.exists() else ""
    if not log_text:
        errors.append("找不到 wiki/log.md")
    for slug in pages:
        if f"[[{slug}]]" not in log_text and f"[[{slug}|" not in log_text:
            errors.append(f"wiki/log.md: 沒有任何一筆紀錄提到 [[{slug}]]（每次收錄都要記錄）")
    for head in re.findall(r"^## +(.+)$", log_text, re.M):
        if not re.match(r"\d{4}-\d{2}-\d{2} (收錄|修訂|系統)：", head):
            errors.append(f"wiki/log.md: 標題格式應為「YYYY-MM-DD 收錄｜修訂｜系統：說明」（目前是：{head}）")

    path: list[Page] = []
    if not errors:
        path, cyc = learning_path(pages)
        errors += cyc

    # 待寫清單與反向連結
    wanted: dict[str, dict] = {}
    for p in pages.values():
        prose = CODE_RE.sub("", p.body)
        for slug, label in LINK_RE.findall(prose):
            if slug in pages:
                if p not in pages[slug].backlinks and slug != p.slug:
                    pages[slug].backlinks.append(p)
            else:
                w = wanted.setdefault(slug, {"slug": slug, "label": label or slug, "from": []})
                if p not in w["from"]:
                    w["from"].append(p)
    for p in pages.values():
        if not p.backlinks and len(pages) > 1:
            warnings.append(f"wiki/{p.path.name}: 孤兒頁，沒有任何頁面連到它")

    for w in warnings:
        print(f"⚠ 警告  {w}")
    if errors:
        for e in errors:
            print(f"✗ 錯誤  {e}")
        print(f"\n建置中止：{len(errors)} 個錯誤。請依 AGENTS.md 修正後再執行。")
        return 1
    wanted_list = sorted(wanted.values(), key=lambda w: (-len(w["from"]), w["slug"]))
    if check_only:
        print(f"✓ 檢查通過：{len(pages)} 頁，待寫 {len(wanted_list)} 個詞")
        return 0

    groups = [(t, [p for p in path if p.meta["type"] == t]) for t in TYPES]
    groups = [(t, ps) for t, ps in groups if ps]
    env = Environment(loader=FileSystemLoader(ROOT / "templates"), autoescape=select_autoescape(["html"]))
    common = dict(site_title=SITE_TITLE, site_tagline=SITE_TAGLINE, groups=groups, levels=LEVELS,
                  path=path, wanted=wanted_list, year=dt.date.today().year)

    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "wiki").mkdir(parents=True)
    shutil.copytree(ASSETS, OUT / "assets")
    shutil.copytree(DEMOS, OUT / "demos")
    (OUT / ".nojekyll").write_text("")

    (OUT / "index.html").write_text(
        env.get_template("index.html").render(root="", current=None, **common), encoding="utf-8")
    log_html = render_markdown(re.sub(r"^# .*\n", "", log_text, count=1), pages, "wiki/")
    (OUT / "log.html").write_text(
        env.get_template("log.html").render(root="", current=None, log_html=log_html, **common), encoding="utf-8")

    for i, p in enumerate(path):
        p.render(pages)
        html = env.get_template("page.html").render(
            root="../", page=p, current=p.slug, step=i + 1,
            prereqs=[pages[s] for s in p.meta["prereqs"]],
            prev=path[i - 1] if i else None, next=path[i + 1] if i < len(path) - 1 else None, **common)
        (OUT / "wiki" / f"{p.slug}.html").write_text(html, encoding="utf-8")

    print(f"✓ 建置完成：{len(pages)} 頁 → docs/（待寫 {len(wanted_list)} 個詞）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
