#!/usr/bin/env python3
"""
日本CFサイトチェック (Phase 4)
Makuake / GREEN FUNDING / CAMPFIRE の検索結果を Playwright で確認
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
from dataclasses import dataclass
from typing import Any, Callable, Optional

from playwright.sync_api import Page, sync_playwright

from common import calculate_score, create_browser, utc_now_iso

SiteKey = str


@dataclass
class SiteConfig:
    key: SiteKey
    build_url: Callable[[str], str]
    check: Callable[[Page, str, str], dict[str, Any]]


NO_RESULT_PATTERNS = [
    r"条件に一致するプロジェクトは見つかりませんでした",
    r"該当するプロジェクトがありません",
    r"0件",
    r"見つかりませんでした",
    r"検索結果はありません",
    r"結果がありません",
]


def normalize_query(query: str) -> str:
    return re.sub(r"\s+", " ", query.strip())


def extract_terms(query: str) -> list[str]:
    q = normalize_query(query)
    terms: list[str] = []
    for part in re.split(r"[\s:/\-|]+", q):
        token = re.sub(r"[^\w\u3040-\u30ff\u4e00-\u9fff]", "", part, flags=re.UNICODE)
        if len(token) >= 3:
            terms.append(token.lower())
    if not terms and q:
        terms.append(q.lower())
    return terms[:5]


def is_relevant_match(query: str, text: str) -> bool:
    if not text:
        return False
    terms = extract_terms(query)
    hay = text.lower()
    if not terms:
        return False
    for term in terms:
        if re.search(rf"(^|[^a-z0-9]){re.escape(term)}([^a-z0-9]|$)", hay):
            return True
        if len(term) >= 6 and term in hay:
            return True
    return False


def has_no_results(text: str) -> bool:
    return any(re.search(p, text) for p in NO_RESULT_PATTERNS)


def build_makuake_url(query: str) -> str:
    return f"https://www.makuake.com/discover/projects/?keyword={urllib.parse.quote(query)}"


def build_greenfunding_url(query: str) -> str:
    params = urllib.parse.urlencode({"q[title_or_planner_name_cont]": query})
    return f"https://greenfunding.jp/portals/search?{params}"


def build_campfire_url(query: str) -> str:
    return f"https://camp-fire.jp/projects/search?word={urllib.parse.quote(query)}"


def check_makuake(page: Page, query: str, url: str) -> dict[str, Any]:
    page.goto(url, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(3500)
    data = page.evaluate(
        """
        () => {
            const links = [...document.querySelectorAll('a[href*="/project/"]')]
                .map(a => ({ href: a.href, text: a.innerText.trim() }))
                .filter(x => x.href.includes('/project/') && !x.href.includes('favorite'));
            return {
                title: document.title,
                text: document.body?.innerText || '',
                links,
            };
        }
        """
    )
    text = data.get("text") or ""
    links = data.get("links") or []
    if has_no_results(text):
        found = False
        matches: list[str] = []
    else:
        matches = [
            ln.get("text") or ln.get("href", "")
            for ln in links
            if is_relevant_match(query, ln.get("text") or ln.get("href", ""))
        ]
        found = len(matches) > 0
    return {
        "site": "makuake",
        "query": query,
        "url": page.url,
        "found": found,
        "matches": matches[:3],
    }


def check_greenfunding(page: Page, query: str, url: str) -> dict[str, Any]:
    page.goto(url, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(3500)
    data = page.evaluate(
        """
        () => {
            const links = [...document.querySelectorAll('a[href*="/portals/"]')]
                .map(a => ({ href: a.href, text: a.innerText.trim() }))
                .filter(x => /\\/portals\\/[^/?#]+$/.test(new URL(x.href).pathname));
            return {
                text: document.body?.innerText || '',
                links,
            };
        }
        """
    )
    text = data.get("text") or ""
    links = data.get("links") or []
    if has_no_results(text):
        found = False
        matches: list[str] = []
    else:
        matches = [
            ln.get("text") or ln.get("href", "")
            for ln in links
            if is_relevant_match(query, ln.get("text") or "")
        ]
        if not matches and not has_no_results(text):
            # Fallback: inspect visible project blocks in search result body
            blocks = re.split(r"\n{2,}", text)
            matches = [b[:120] for b in blocks if is_relevant_match(query, b) and "¥" in b]
        found = len(matches) > 0
    return {
        "site": "greenfunding",
        "query": query,
        "url": page.url,
        "found": found,
        "matches": matches[:3],
    }


def check_campfire(page: Page, query: str, url: str) -> dict[str, Any]:
    page.goto(url, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(3500)
    data = page.evaluate(
        """
        () => {
            const links = [...document.querySelectorAll('a[href*="/projects/"]')]
                .map(a => ({ href: a.href, text: a.innerText.trim() }))
                .filter(x => /\\/projects\\/\\d+\\/view/.test(x.href));
            return {
                title: document.title,
                text: document.body?.innerText || '',
                links,
            };
        }
        """
    )
    text = data.get("text") or ""
    title = data.get("title") or ""
    links = data.get("links") or []
    if has_no_results(text):
        found = False
        matches: list[str] = []
    else:
        matches = [
            ln.get("text") or ln.get("href", "")
            for ln in links
            if is_relevant_match(query, ln.get("text") or "")
        ]
        # CAMPFIRE search page title includes the query when results exist
        title_has_query = query.lower() in title.lower() or f"「{query}」" in title
        if not matches and links and title_has_query:
            matches = [(ln.get("text") or ln.get("href", "")) for ln in links[:3]]
        found = len(matches) > 0
    return {
        "site": "campfire",
        "query": query,
        "url": page.url,
        "found": found,
        "matches": matches[:3],
    }


SITES: list[SiteConfig] = [
    SiteConfig("makuake", build_makuake_url, check_makuake),
    SiteConfig("greenfunding", build_greenfunding_url, check_greenfunding),
    SiteConfig("campfire", build_campfire_url, check_campfire),
]


def check_japan_cf(query: str, page: Optional[Page] = None) -> dict[str, Any]:
    query = normalize_query(query)
    owns_browser = page is None
    sites_result: list[dict[str, Any]] = []

    if owns_browser:
        playwright = sync_playwright().start()
        browser, context = create_browser(playwright)
        page = context.new_page()
    else:
        browser = None
        playwright = None

    try:
        for site in SITES:
            url = site.build_url(query)
            print(f"[japan_cf] {site.key}: {query}", file=sys.stderr)
            try:
                result = site.check(page, query, url)
            except Exception as exc:
                result = {
                    "site": site.key,
                    "query": query,
                    "url": url,
                    "found": False,
                    "error": str(exc),
                    "matches": [],
                }
            sites_result.append(
                {
                    "site": result["site"],
                    "found": bool(result.get("found")),
                    "url": result.get("url", url),
                    "query": query,
                    "matches": result.get("matches") or [],
                }
            )
    finally:
        if owns_browser and browser and playwright:
            browser.close()
            playwright.stop()

    is_unentered = all(not s["found"] for s in sites_result)
    return {
        "checkedAt": utc_now_iso(),
        "query": query,
        "sites": sites_result,
        "isJapanUnentered": is_unentered,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Check Japanese CF sites for a product")
    parser.add_argument("query", nargs="?", default="Cyberpunk")
    parser.add_argument("--json-only", action="store_true", help="Print JSON only to stdout")
    args = parser.parse_args()

    result = check_japan_cf(args.query)
    if args.json_only:
        print(json.dumps(result, ensure_ascii=False))
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
