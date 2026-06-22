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

from common import (
    MAX_DAYS_SINCE_END,
    MIN_RAISED_USD,
    create_browser,
    fetch_json_page,
    normalize_project,
    save_json,
    save_to_supabase,
    utc_now_iso,
)

DISCOVER_BASE = "https://www.kickstarter.com/discover/advanced.json"


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


def crawl_kickstarter(max_pages: int = 5) -> list[dict[str, Any]]:
    projects: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    with sync_playwright() as playwright:
        browser, context = create_browser(playwright)
        page = context.new_page()

        for page_num in range(1, max_pages + 1):
            url = build_discover_url(page_num)
            print(f"[kickstarter] fetching page {page_num}: {url}")
            data = fetch_json_page(page, url)
            if not data:
                print(f"[kickstarter] no data on page {page_num}, stopping")
                break

            batch = data.get("projects") or []
            if not batch:
                print(f"[kickstarter] empty page {page_num}, stopping")
                break

            added = 0
            for item in batch:
                mapped = map_kickstarter_project(item)
                if not mapped:
                    continue
                key = mapped["original_url"]
                if key in seen_urls:
                    continue
                seen_urls.add(key)
                projects.append(mapped)
                added += 1

            print(f"[kickstarter] page {page_num}: {added} projects matched filters")

        browser.close()

    projects.sort(key=lambda p: p["raised_usd"], reverse=True)
    return projects


def main() -> int:
    parser = argparse.ArgumentParser(description="Crawl successful Kickstarter projects")
    parser.add_argument("--pages", type=int, default=5, help="Number of discover pages")
    parser.add_argument("--no-save", action="store_true", help="Skip writing output files")
    args = parser.parse_args()

    projects = crawl_kickstarter(max_pages=args.pages)
    print(f"[kickstarter] total matched: {len(projects)}")

    if not projects:
        print("[kickstarter] no projects found")
        return 1

    if not args.no_save:
        path = save_json(projects, "kickstarter_projects.json")
        print(f"[kickstarter] saved to {path}")
        saved = save_to_supabase(projects)
        if saved:
            print(f"[kickstarter] upserted {saved} rows to Supabase")

    print(json.dumps({"count": len(projects), "top": projects[:3]}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
