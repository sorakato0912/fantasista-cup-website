#!/usr/bin/env python3
"""公式HP（fantasista-cup.com）の本番を巡回し、SEO・リンク切れ・死活の異常があれば exit 1 で終わる。

使い方: python3 scripts/site-check.py
GitHub Actions（.github/workflows/site-check.yml）から毎朝実行され、失敗するとGitHubからメールが届く。
"""
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser

BASE = "https://fantasista-cup.com"
# 公式HP以外で、落ちていたら困るURL（期待するステータス）
UPTIME = {
    "https://entry.fantasista-cup.com/home": 200,
    "https://admin.fantasista-cup.com/login": 200,
}
OWN_HOSTS = {"fantasista-cup.com", "entry.fantasista-cup.com", "admin.fantasista-cup.com"}


def fetch(url):
    """(status, body) を返す。日本語ファイル名のURLもそのまま渡せる。"""
    url = urllib.parse.quote(url, safe=":/?#[]@!$&'()*+,;=%")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (fantasista site-check)"})
    for attempt in range(2):  # 一時的な通信エラーで誤報しないよう1回だけ再試行
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                return res.status, res.read()
        except urllib.error.HTTPError as e:
            return e.code, b""
        except Exception:
            if attempt == 1:
                return 0, b""


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.meta = {}
        self.canonical = None
        self.h1 = 0
        self.refs = []
        self.ld = []
        self._in = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "title":
            self._in = "title"
        elif tag == "meta":
            key = a.get("name") or a.get("property")
            if key:
                self.meta[key] = a.get("content") or ""
        elif tag == "link":
            if a.get("rel") == "canonical":
                self.canonical = a.get("href")
            elif a.get("href"):
                self.refs.append(a["href"])
        elif tag == "h1":
            self.h1 += 1
        elif tag == "a" and a.get("href"):
            self.refs.append(a["href"])
        elif tag in ("img", "video", "source", "script") and a.get("src"):
            self.refs.append(a["src"])
        if tag == "video" and a.get("poster"):
            self.refs.append(a["poster"])
        if tag == "script" and a.get("type") == "application/ld+json":
            self._in = "ld"
            self.ld.append("")

    def handle_endtag(self, tag):
        if tag in ("title", "script"):
            self._in = None

    def handle_data(self, data):
        if self._in == "title":
            self.title += data
        elif self._in == "ld":
            self.ld[-1] += data


def main():
    errors = []
    statuses = {}

    def status(url):
        if url not in statuses:
            statuses[url] = fetch(url)[0]
        return statuses[url]

    for url, expected in UPTIME.items():
        if status(url) != expected:
            errors.append(f"{url}: ステータス {status(url)}（期待値 {expected}）")

    code, robots = fetch(f"{BASE}/robots.txt")
    if code != 200 or f"Sitemap: {BASE}/sitemap.xml" not in robots.decode("utf-8", "replace"):
        errors.append("robots.txt: 取得できない、またはSitemap行がない")

    code, sitemap = fetch(f"{BASE}/sitemap.xml")
    pages = re.findall(r"<loc>([^<]+)</loc>", sitemap.decode("utf-8", "replace"))
    if code != 200 or not pages:
        errors.append(f"sitemap.xml: 取得できない、またはURLが0件（ステータス {code}）")

    for page_url in pages:
        code, body = fetch(page_url)
        if code != 200:
            errors.append(f"{page_url}: ステータス {code}")
            continue
        page = Page()
        page.feed(body.decode("utf-8", "replace"))
        problems = []
        if not page.title.strip():
            problems.append("titleがない")
        if not page.meta.get("description"):
            problems.append("meta descriptionがない")
        if page.h1 != 1:
            problems.append(f"h1が{page.h1}個")
        if page.canonical != page_url:
            problems.append(f"canonicalが {page.canonical}")
        if "noindex" in page.meta.get("robots", ""):
            problems.append("noindexが付いている")
        for key in ("og:title", "og:image", "og:url"):
            if not page.meta.get(key):
                problems.append(f"{key}がない")
        for block in page.ld:
            try:
                json.loads(block)
            except ValueError:
                problems.append("構造化データ(JSON-LD)が壊れている")
        refs = set(page.refs)
        if page.meta.get("og:image"):
            refs.add(page.meta["og:image"])
        for ref in sorted(refs):
            if ref.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
                continue
            target = urllib.parse.urljoin(page_url, ref).split("#")[0]
            if urllib.parse.urlparse(target).netloc in OWN_HOSTS and status(target) != 200:
                problems.append(f"リンク切れ {ref}（ステータス {status(target)}）")
        errors += [f"{page_url}: {p}" for p in problems]

    print(f"確認: {len(pages)}ページ / {len(statuses)}URL")
    if errors:
        print(f"\n異常 {len(errors)}件:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)
    print("異常なし")


if __name__ == "__main__":
    main()
