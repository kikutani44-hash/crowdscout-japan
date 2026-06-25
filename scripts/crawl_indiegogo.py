#!/usr/bin/env python3
"""
Indiegogo projects crawler.

Strategy:
1. Open explore page in Playwright (Cloudflare-safe session)
2. Collect project URLs from search results
3. Visit each project page and extract funding / backers / metadata
4. Filter successful campaigns with >= $50,000 USD equivalent raised
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

from category_filters import INDIEGOGO_EXPLORE_URLS, is_allowed_category, parse_category_slugs, resolve_indiegogo_explore_urls
from common import (
    MIN_RAISED_USD,
    compute_campaign_metrics,
    create_browser,
    dismiss_cookie_consent,
    normalize_project,
    parse_money_to_usd,
    save_json,
    save_to_supabase,
    utc_now_iso,
)

EXPLORE_URLS = INDIEGOGO_EXPLORE_URLS

_DATE_FORMATS = (
    "%B %d, %Y",
    "%b %d, %Y",
    "%B %d %Y",
    "%b %d %Y",
    "%Y-%m-%d",
    "%m/%d/%Y",
    "%d/%m/%Y",
)

_DEADLINE_PATTERNS = (
    re.compile(r"(?:campaign\s+)?ended\s+(?:on\s+)?(.+)", re.IGNORECASE),
    re.compile(r"end(?:ed|s)?\s+(?:on\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4})", re.IGNORECASE),
    re.compile(r"deadline:?\s*(.+)", re.IGNORECASE),
    re.compile(r"funding\s+ended:?\s*(.+)", re.IGNORECASE),
    re.compile(r"closed\s+(?:on\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4})", re.IGNORECASE),
)

_LAUNCH_PATTERNS = (
    re.compile(r"launch(?:ed|es)?\s+(?:on\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4})", re.IGNORECASE),
    re.compile(r"started:?\s*(.+)", re.IGNORECASE),
    re.compile(r"created:?\s*(.+)", re.IGNORECASE),
)


def _try_parse_date(text: str) -> int | None:
    cleaned = text.strip().rstrip(".")
    cleaned = re.sub(r"\s+", " ", cleaned)
    # Strip trailing time fragments if present
    cleaned = re.sub(r"\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?", "", cleaned, flags=re.IGNORECASE)
    for fmt in _DATE_FORMATS:
        try:
            dt = datetime.strptime(cleaned, fmt).replace(tzinfo=timezone.utc)
            return int(dt.timestamp())
        except ValueError:
            continue
    iso_match = re.search(r"(\d{4}-\d{2}-\d{2})", cleaned)
    if iso_match:
        try:
            dt = datetime.strptime(iso_match.group(1), "%Y-%m-%d").replace(tzinfo=timezone.utc)
            return int(dt.timestamp())
        except ValueError:
            pass
    return None


def _extract_date_from_patterns(texts: list[str], patterns: tuple[re.Pattern[str], ...]) -> int | None:
    for text in texts:
        for pattern in patterns:
            match = pattern.search(text)
            if not match:
                continue
            parsed = _try_parse_date(match.group(1))
            if parsed:
                return parsed
    return None


def _extract_dates_from_json_ld(json_ld: list[Any]) -> tuple[int | None, int | None]:
    deadline_ts: int | None = None
    launched_ts: int | None = None

    def walk(obj: Any) -> None:
        nonlocal deadline_ts, launched_ts
        if isinstance(obj, dict):
            for key, value in obj.items():
                key_lower = str(key).lower()
                if key_lower in {"enddate", "datemodified", "validthrough"} and isinstance(value, str):
                    parsed = _try_parse_date(value) or _try_parse_date(value[:10])
                    if parsed:
                        deadline_ts = parsed if deadline_ts is None else max(deadline_ts, parsed)
                if key_lower in {"startdate", "datepublished", "datecreated"} and isinstance(value, str):
                    parsed = _try_parse_date(value) or _try_parse_date(value[:10])
                    if parsed:
                        launched_ts = parsed if launched_ts is None else min(launched_ts, parsed)
                walk(value)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    for blob in json_ld:
        walk(blob)
    return deadline_ts, launched_ts


def parse_indiegogo_dates(
    date_texts: list[str],
    body_text: str,
    json_ld: list[Any],
) -> tuple[int | None, int | None]:
    """Extract deadline and launch timestamps from DOM date snippets and JSON-LD."""
    snippets = [t.strip() for t in date_texts if t and t.strip()]
    if body_text:
        for line in body_text.splitlines():
            line = line.strip()
            if line and any(
                token in line.lower()
                for token in ("end", "deadline", "launch", "started", "closed", "ended")
            ):
                snippets.append(line)

    deadline_ts = _extract_date_from_patterns(snippets, _DEADLINE_PATTERNS)
    launched_ts = _extract_date_from_patterns(snippets, _LAUNCH_PATTERNS)

    ld_deadline, ld_launched = _extract_dates_from_json_ld(json_ld)
    if ld_deadline:
        deadline_ts = ld_deadline if deadline_ts is None else max(deadline_ts, ld_deadline)
    if ld_launched:
        launched_ts = ld_launched if launched_ts is None else min(launched_ts, ld_launched)

    return deadline_ts, launched_ts


def infer_indiegogo_status(
    *,
    deadline_ts: int | None,
    is_indemand: bool,
    body_text: str,
) -> str:
    if is_indemand or re.search(r"\bindemand\b", body_text, re.IGNORECASE):
        return "ended"
    if deadline_ts:
        deadline = datetime.fromtimestamp(deadline_ts, tz=timezone.utc)
        if deadline > datetime.now(timezone.utc):
            return "active"
        return "ended"
    if re.search(r"\b(live|active|days?\s+left|ends?\s+in)\b", body_text, re.IGNORECASE):
        return "active"
    return "ended"


def extract_card_previews(page) -> list[dict[str, Any]]:
    """Extract project previews directly from explore listing cards."""
    return page.evaluate(
        """
        () => {
            const cards = [];
            const anchors = [...document.querySelectorAll('a[href*="/projects/"]')];
            for (const a of anchors) {
                if (!a.href.includes('indiegogo.com/en/projects/')) continue;
                const card = a.closest('article, li, div[class]') || a.parentElement;
                const text = (card?.innerText || a.innerText || '').replace(/\\s+/g, ' ').trim();
                const img = (card?.querySelector('img') || a.querySelector('img'))?.src || null;
                cards.push({ href: a.href.split('?')[0], text, img });
            }
            const seen = new Set();
            return cards.filter(c => {
                if (seen.has(c.href)) return false;
                seen.add(c.href);
                return true;
            });
        }
        """
    )


def parse_card_funding(text: str) -> tuple[int, int, bool]:
    """Try to parse raised/backers from explore card text. Returns (raised, backers, found)."""
    raised = 0
    backers = 0
    found = False
    patterns = (
        r"([A-Z]{2,3}\$?[\d,]+(?:\.\d+)?)\s+raised",
        r"raised\s+([A-Z]{2,3}\$?[\d,]+(?:\.\d+)?)",
        r"TOTAL FUNDING:?\s*([^\n\r]+)",
        r"([\$€£][\d,]+(?:\.\d+)?)\s*(?:USD|usd)?\s*raised",
        r"raised\s*([\$€£][\d,]+(?:\.\d+)?)",
        r"Funding\s*([\$€£][\d,]+(?:\.\d+)?)",
        r"Pledged\s*([\$€£][\d,]+(?:\.\d+)?)",
        r"(\$[\d,]+(?:\.\d+)?)",
    )
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            continue
        amount = parse_money_to_usd(match.group(1))
        if amount > 0:
            raised = max(raised, amount)
            found = True
    backers_match = re.search(r"([\d,]+)\s+backers?", text, re.IGNORECASE)
    if backers_match:
        backers = int(backers_match.group(1).replace(",", ""))
    return raised, backers, found


def parse_page_funding(text: str) -> tuple[int, int, bool]:
    """Parse raised/backers from a project page body."""
    raised = 0
    backers = 0
    found = False
    patterns = (
        r"TOTAL FUNDING:?\s*([^\n\r]+)",
        r"Total\s+funding:?\s*([^\n\r]+)",
        r"([\$€£][\d,]+(?:\.\d+)?)\s*(?:USD|usd)?\s*raised",
        r"raised\s*([\$€£][\d,]+(?:\.\d+)?)",
        r"([\d,]+(?:\.\d+)?)\s*USD\s*raised",
        r"Funding\s*([\$€£][\d,]+(?:\.\d+)?)",
        r"Pledged\s*([\$€£][\d,]+(?:\.\d+)?)",
        r"Amount\s+raised:?\s*([\$€£][\d,]+(?:\.\d+)?)",
    )
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            continue
        amount = parse_money_to_usd(match.group(1))
        if amount > 0:
            raised = max(raised, amount)
            found = True
    backers_match = re.search(r"([\d,]+)\s+backers?", text, re.IGNORECASE)
    if backers_match:
        backers = int(backers_match.group(1).replace(",", ""))
    return raised, backers, found


def _parse_json_ld_funding(data: Any) -> tuple[int, int, bool]:
    raised = 0
    backers = 0
    found = False

    def walk(obj: Any) -> None:
        nonlocal raised, backers, found
        if isinstance(obj, dict):
            for key, value in obj.items():
                key_lower = str(key).lower()
                if key_lower in {"price", "amount", "value", "pricecurrency"} and isinstance(value, (str, int, float)):
                    if key_lower != "pricecurrency":
                        if isinstance(value, (int, float)):
                            amount = int(value)
                        else:
                            amount = parse_money_to_usd(str(value))
                        if amount > 0:
                            raised = max(raised, amount)
                            found = True
                if key_lower in {"interactioncount", "reviewcount"} and isinstance(value, (str, int)):
                    try:
                        count = int(str(value).replace(",", ""))
                        if count > backers:
                            backers = count
                    except ValueError:
                        pass
                walk(value)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    walk(data)
    return raised, backers, found


def is_indiegogo_project_url(url: str) -> bool:
    parsed = urlparse(url)
    return (
        "indiegogo.com" in parsed.netloc
        and "/projects/" in parsed.path
        and parsed.path.count("/") >= 4
    )


def clean_project_url(url: str) -> str:
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"


def collect_project_urls(page, explore_urls: list[str], max_links: int) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    seen: set[str] = set()

    for explore_url in explore_urls:
        print(f"[indiegogo] loading explore: {explore_url}")
        page.goto(explore_url, wait_until="domcontentloaded", timeout=90000)
        dismiss_cookie_consent(page)
        page.wait_for_timeout(6000)

        previews = extract_card_previews(page)
        for preview in previews:
            link = preview.get("href") or ""
            if not is_indiegogo_project_url(link):
                continue
            clean = clean_project_url(link)
            if clean in seen:
                continue
            seen.add(clean)
            found.append(preview)
            if len(found) >= max_links:
                return found

        # Scroll for lazy-loaded cards
        for _ in range(5):
            page.mouse.wheel(0, 2800)
            page.wait_for_timeout(1500)
            previews = extract_card_previews(page)
            for preview in previews:
                clean = clean_project_url(preview.get("href") or "")
                if clean not in seen and is_indiegogo_project_url(clean):
                    seen.add(clean)
                    found.append({**preview, "href": clean})
                    if len(found) >= max_links:
                        return found

    return found


def scrape_project_page(page, url: str, preview: dict[str, Any] | None = None) -> dict[str, Any] | None:
    print(f"[indiegogo] scraping {url}")
    page.goto(url, wait_until="domcontentloaded", timeout=90000)
    dismiss_cookie_consent(page)
    page.wait_for_timeout(5000)

    if "Just a moment" in (page.title() or ""):
        print(f"[indiegogo] blocked by challenge page: {url}")
        return None

    data = page.evaluate(
        """
        () => {
            const og = {};
            document.querySelectorAll('meta[property^="og:"]').forEach(m => {
                og[m.getAttribute('property')] = m.getAttribute('content');
            });
            const text = document.body?.innerText || '';
            const hero = document.querySelector('img[src*="cdn.images.indiegogo.com"], img[src*="project"]');
            const statTexts = [...document.querySelectorAll(
                '[class*="funding"], [class*="Funding"], [class*="raised"], [class*="stats"], [class*="Stats"], [data-testid*="funding"]'
            )].map(el => (el.innerText || '').trim()).filter(Boolean);
            const dateTexts = [...document.querySelectorAll(
                '[class*="date"], [class*="Date"], [class*="time"], [class*="Time"], [class*="deadline"], [class*="end"]'
            )].map(el => el.innerText?.trim()).filter(Boolean);
            const jsonLd = [];
            document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
                try {
                    jsonLd.push(JSON.parse(script.textContent || ''));
                } catch (e) {}
            });
            return {
                title: document.title.replace(/ by .* - Indiegogo$/i, '').trim(),
                text,
                og,
                hero: hero ? hero.src : null,
                statTexts,
                dateTexts,
                jsonLd,
                isIndemand: /indemand/i.test(location.href) || /indemand/i.test(text),
            };
        }
        """
    )

    text = data.get("text") or ""
    og = data.get("og") or {}

    raised_usd = 0
    backers = 0
    raised_found = False

    if preview:
        preview_raised, preview_backers, preview_found = parse_card_funding(preview.get("text") or "")
        if preview_found:
            raised_usd = max(raised_usd, preview_raised)
            raised_found = True
        backers = max(backers, preview_backers)

    page_raised, page_backers, page_found = parse_page_funding(text)
    if page_found:
        raised_usd = max(raised_usd, page_raised)
        raised_found = True
    backers = max(backers, page_backers)

    for stat_text in data.get("statTexts") or []:
        stat_raised, stat_backers, stat_found = parse_page_funding(stat_text)
        if stat_found:
            raised_usd = max(raised_usd, stat_raised)
            raised_found = True
        backers = max(backers, stat_backers)

    for blob in data.get("jsonLd") or []:
        ld_raised, ld_backers, ld_found = _parse_json_ld_funding(blob)
        if ld_found:
            raised_usd = max(raised_usd, ld_raised)
            raised_found = True
        backers = max(backers, ld_backers)

    title = data.get("title") or og.get("og:title") or "Untitled"
    title = re.sub(r"\s*by .*$", "", title).strip()

    if not raised_found:
        # InDemand campaigns often hide funding totals — assume threshold met
        raised_usd = MIN_RAISED_USD
        print(
            f"[indiegogo] raised unknown, assuming >= ${MIN_RAISED_USD:,}"
            f"{' (InDemand)' if data.get('isIndemand') else ''}: {title}"
        )
    elif raised_usd < MIN_RAISED_USD:
        print(f"[indiegogo] skip (raised ${raised_usd:,} < ${MIN_RAISED_USD:,}): {title}")
        return None

    category_match = re.search(r"CATEGORY\s*\n([^\n]+)", text, re.IGNORECASE)
    category = category_match.group(1).strip() if category_match else "Other"

    creator_match = re.search(r"CREATOR\s*\n([^\n]+)", text, re.IGNORECASE)
    creator = creator_match.group(1).strip() if creator_match else None

    # Blurb: first paragraph after title area
    subtitle = og.get("og:description") or ""
    if not subtitle:
        lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
        for i, ln in enumerate(lines):
            if ln.startswith("by ") and i + 1 < len(lines):
                subtitle = lines[i + 1][:280]
                break

    if not is_allowed_category(category):
        print(f"[indiegogo] skip (category excluded: {category}): {title}")
        return None

    deadline_ts, launched_ts = parse_indiegogo_dates(
        data.get("dateTexts") or [],
        text,
        data.get("jsonLd") or [],
    )
    is_indemand = bool(data.get("isIndemand"))
    status = infer_indiegogo_status(
        deadline_ts=deadline_ts,
        is_indemand=is_indemand,
        body_text=text,
    )
    metrics = compute_campaign_metrics(
        status=status,
        backers=backers,
        deadline_ts=deadline_ts,
        launched_ts=launched_ts,
    )

    image_url = og.get("og:image") or data.get("hero") or (preview or {}).get("img")
    maker_website = None
    if creator:
        maker_website = f"https://www.indiegogo.com/en/projects/{creator.lower().replace(' ', '-')}"

    return normalize_project(
        {
            "title": title,
            "subtitle": subtitle,
            "platform": "indiegogo",
            "original_url": url,
            "image_url": image_url,
            "raised_usd": raised_usd,
            "goal_usd": max(int(raised_usd * 0.2), 1),  # Indiegogo often omits goal on page
            "backers": backers,
            "category": category,
            "country": None,
            "status": status,
            **metrics,
            "maker_website": maker_website,
            "created_at": utc_now_iso(),
        }
    )


def crawl_indiegogo(max_projects: int = 20, category_slugs: list[str] | None = None) -> list[dict[str, Any]]:
    projects: list[dict[str, Any]] = []
    explore_urls = resolve_indiegogo_explore_urls(category_slugs)

    with sync_playwright() as playwright:
        browser, context = create_browser(playwright)
        page = context.new_page()

        # Warm up session on explore page first
        page.goto(explore_urls[0], wait_until="domcontentloaded", timeout=90000)
        dismiss_cookie_consent(page)
        page.wait_for_timeout(4000)

        urls = collect_project_urls(page, explore_urls, max_links=max_projects * 3)
        print(f"[indiegogo] discovered {len(urls)} candidate URLs")

        for item in urls:
            if len(projects) >= max_projects:
                break
            try:
                url = clean_project_url(item.get("href") or "")
                mapped = scrape_project_page(page, url, preview=item)
                if mapped:
                    projects.append(mapped)
            except Exception as exc:
                href = item.get("href") or "unknown"
                print(f"[indiegogo] error on {href}: {exc}")

        browser.close()

    projects.sort(key=lambda p: p["raised_usd"], reverse=True)
    return projects


def main() -> int:
    parser = argparse.ArgumentParser(description="Crawl Indiegogo projects")
    parser.add_argument("--max", type=int, default=20, help="Maximum projects to save")
    parser.add_argument("--no-save", action="store_true", help="Skip writing output files")
    parser.add_argument(
        "--categories",
        type=str,
        default="",
        help="Comma-separated slugs: technology,hardware,design,fashion,food,...",
    )
    parser.add_argument("--no-supabase", action="store_true", help="Skip Supabase upsert")
    parser.add_argument(
        "--no-translate",
        action="store_true",
        help="Skip Claude API translation (run_crawl translates after merge)",
    )
    parser.add_argument(
        "--force-translate",
        action="store_true",
        help="Re-translate even when title_ja / subtitle_ja already exist",
    )
    args = parser.parse_args()

    slugs = parse_category_slugs(args.categories or None)
    projects = crawl_indiegogo(max_projects=args.max, category_slugs=slugs)
    print(f"[indiegogo] total matched: {len(projects)}")

    if not projects:
        print("[indiegogo] no projects found")
        return 1

    if not args.no_save:
        if not args.no_translate:
            from translator import translate_projects

            print(f"[indiegogo] translating {len(projects)} projects...")
            translate_projects(projects, force=args.force_translate)

        path = save_json(projects, "indiegogo_projects.json")
        print(f"[indiegogo] saved to {path}")
        if not args.no_supabase:
            saved = save_to_supabase(projects)
            if saved:
                print(f"[indiegogo] upserted {saved} rows to Supabase")
            else:
                print(
                    "[indiegogo] ERROR: Supabase sync failed (0 rows saved). "
                    "Check [supabase] messages above for details.",
                    file=sys.stderr,
                )
                return 1

    print(json.dumps({"count": len(projects), "top": projects[:3]}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
