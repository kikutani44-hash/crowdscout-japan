#!/usr/bin/env python3
"""
Kickstarter successful projects crawler.

Uses the public discover JSON endpoint via Playwright:
  /discover/advanced.json?sort=most_funded&state=successful&page=N

Filters (per spec):
  - pledged >= goal (state=successful)
  - raised >= $50,000 USD
  - ended within 180 days
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode

from playwright.sync_api import sync_playwright

from category_filters import (
    is_allowed_category,
    parse_category_slugs,
    resolve_kickstarter_categories,
)
from common import (
    MAX_DAYS_SINCE_END,
    MIN_RAISED_USD,
    create_browser,
    fetch_json_page,
    normalize_project,
    replace_supabase_projects,
    save_json,
    save_to_supabase,
    utc_now_iso,
)

DISCOVER_BASE = "https://www.kickstarter.com/discover/advanced.json"
DEFAULT_CATEGORIES = "technology"


def build_discover_url(page_num: int, category_id: int | None = None) -> str:
    params: dict[str, Any] = {
        "sort": "most_funded",
        "state": "successful",
        "page": page_num,
    }
    if category_id:
        params["category_id"] = category_id
    return f"{DISCOVER_BASE}?{urlencode(params)}"


def within_days_since_end(deadline_ts: int, max_days: int) -> bool:
    if not deadline_ts:
        return True
    deadline = datetime.fromtimestamp(deadline_ts, tz=timezone.utc)
    delta = datetime.now(timezone.utc) - deadline
    return 0 <= delta.days <= max_days


def map_kickstarter_project(item: dict[str, Any]) -> dict[str, Any] | None:
    pledged = int(float(item.get("usd_pledged") or item.get("pledged") or 0))
    goal = int(float(item.get("goal") or 0))
    if pledged < MIN_RAISED_USD:
        return None
    if goal > 0 and pledged < goal:
        return None
    if not within_days_since_end(int(item.get("deadline") or 0), MAX_DAYS_SINCE_END):
        return None

    category = item.get("category") or {}
    parent = category.get("parent_name") or ""
    child = category.get("name") or ""
    category_name = f"{parent}/{child}".strip("/") if parent else child
    creator = item.get("creator") or {}
    urls = item.get("urls") or {}
    web = urls.get("web") or {}
    photo = item.get("photo") or {}

    return normalize_project(
        {
            "title": item.get("name") or "",
            "subtitle": item.get("blurb") or "",
            "platform": "kickstarter",
            "original_url": web.get("project") or f"https://www.kickstarter.com/projects/{item.get('slug')}",
            "image_url": photo.get("1024x576") or photo.get("full") or photo.get("med"),
            "raised_usd": pledged,
            "goal_usd": goal,
            "backers": int(item.get("backers_count") or 0),
            "category": category_name or "Other",
            "country": item.get("country_displayable_name") or item.get("country"),
            "status": "ended" if item.get("state") == "successful" else "active",
            "maker_website": (creator.get("urls") or {}).get("web", {}).get("user"),
            "created_at": utc_now_iso(),
        }
    )


def crawl_kickstarter(
    max_pages: int = 5,
    category_slugs: list[str] | None = None,
    max_projects: int | None = None,
) -> list[dict[str, Any]]:
    projects: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    categories = resolve_kickstarter_categories(category_slugs)
    pages_per_category = max(1, max_pages)
    limit = max_projects if max_projects and max_projects > 0 else None

    with sync_playwright() as playwright:
        browser, context = create_browser(playwright)
        page = context.new_page()

        for category_id, category_label in categories:
            if limit and len(projects) >= limit:
                break
            print(f"[kickstarter] category: {category_label} (id={category_id})")
            for page_num in range(1, pages_per_category + 1):
                if limit and len(projects) >= limit:
                    break
                url = build_discover_url(page_num, category_id)
                print(f"[kickstarter] fetching page {page_num}: {url}")
                data = fetch_json_page(page, url)
                if not data:
                    print(f"[kickstarter] no data on page {page_num}, stopping category")
                    break

                batch = data.get("projects") or []
                if not batch:
                    print(f"[kickstarter] empty page {page_num}, stopping category")
                    break

                added = 0
                skipped_category = 0
                for item in batch:
                    if limit and len(projects) >= limit:
                        break
                    mapped = map_kickstarter_project(item)
                    if not mapped:
                        continue
                    if not is_allowed_category(mapped["category"]):
                        skipped_category += 1
                        continue
                    key = mapped["original_url"]
                    if key in seen_urls:
                        continue
                    seen_urls.add(key)
                    projects.append(mapped)
                    added += 1

                print(
                    f"[kickstarter] page {page_num}: {added} matched, "
                    f"{skipped_category} excluded by category"
                )

        browser.close()

    projects.sort(key=lambda p: p["raised_usd"], reverse=True)
    if limit:
        projects = projects[:limit]
    return projects


def main() -> int:
    parser = argparse.ArgumentParser(description="Crawl successful Kickstarter projects")
    parser.add_argument(
        "--pages",
        type=int,
        default=5,
        help="Discover pages for Technology category",
    )
    parser.add_argument(
        "--max",
        type=int,
        default=None,
        help="Maximum number of projects to collect (e.g. 10)",
    )
    parser.add_argument("--no-save", action="store_true", help="Skip writing output files")
    parser.add_argument(
        "--categories",
        type=str,
        default=DEFAULT_CATEGORIES,
        help="Comma-separated slugs (default: technology)",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Replace all Supabase rows with crawl results",
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
    projects = crawl_kickstarter(
        max_pages=args.pages,
        category_slugs=slugs,
        max_projects=args.max,
    )
    print(f"[kickstarter] total matched: {len(projects)}")

    if not projects:
        print("[kickstarter] no projects found")
        return 1

    if not args.no_save:
        if not args.no_translate:
            from translator import translate_projects

            print(f"[kickstarter] translating {len(projects)} projects...")
            translate_projects(projects, force=args.force_translate)

        path = save_json(projects, "kickstarter_projects.json")
        print(f"[kickstarter] saved to {path}")
        if not args.no_supabase:
            if args.replace:
                saved = replace_supabase_projects(projects)
            else:
                saved = save_to_supabase(projects)
            if saved:
                mode = "replaced" if args.replace else "upserted"
                print(f"[kickstarter] {saved} rows {mode} to Supabase")

    print(json.dumps({"count": len(projects), "top": projects[:3]}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
