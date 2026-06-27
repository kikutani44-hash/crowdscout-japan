#!/usr/bin/env python3
"""
Wadiz (Korea) projects crawler.

Uses the public main feed API:
  https://platform.wadiz.kr/main2/api/v9/main?ai=true&idx=0&page=N

Filters:
  - isGlobalShippingAvailable == true
  - rate >= 100 (100%+ funded)
  - Categories: Tech, Sports, Home & Decor, Beauty
  - Excludes: Books, E-Books & Classes, Games
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

import requests

from common import (
    compute_campaign_metrics,
    normalize_project,
    save_json,
    save_to_supabase,
    utc_now_iso,
)

API_BASE = "https://platform.wadiz.kr/main2/api/v9/main"
WADIZ_DETAIL_BASE = "https://www.wadiz.kr/web/campaign/detail"
KRW_PER_USD = float(os.environ.get("KRW_PER_USD", "1350"))

ALLOWED_MAIN_CATEGORIES = {
    "Tech & Consumer Electronics",  # テクノロジー家電
    "Sports & Outdoors",  # スポーツ
    "Home & Decor",  # ホームインテリア
    "Beauty",  # ビューティー
}

EXCLUDED_MAIN_CATEGORIES = {
    "Books",
    "E-Books & Classes",
    "Games",
}

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}


def krw_to_usd(amount_krw: int | float | None) -> int:
    if not amount_krw:
        return 0
    return int(round(float(amount_krw) / KRW_PER_USD))


def parse_wadiz_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def collect_funding_items(payload: Any) -> list[dict[str, Any]]:
    """Recursively collect project-like objects from nested API cards."""
    found: list[dict[str, Any]] = []

    def walk(obj: Any) -> None:
        if isinstance(obj, dict):
            link = obj.get("linkUrl")
            if (
                isinstance(link, str)
                and link.startswith("/funding/")
                and "isGlobalShippingAvailable" in obj
                and obj.get("id") is not None
            ):
                found.append(obj)
            for value in obj.values():
                if value is not None:
                    walk(value)
        elif isinstance(obj, list):
            for value in obj:
                if value is not None:
                    walk(value)

    walk(payload)
    return found


def matches_wadiz_filters(item: dict[str, Any]) -> bool:
    if not item.get("isGlobalShippingAvailable"):
        return False

    rate = item.get("rate")
    if rate is None or int(rate) < 100:
        return False

    main_category = str(item.get("mainCategoryName") or "").strip()
    if main_category in EXCLUDED_MAIN_CATEGORIES:
        return False
    if main_category not in ALLOWED_MAIN_CATEGORIES:
        return False

    return True


def infer_status(item: dict[str, Any]) -> str:
    end_dt = parse_wadiz_datetime(item.get("endDate"))
    if end_dt:
        now = datetime.now(end_dt.tzinfo or ZoneInfo("Asia/Seoul"))
        return "active" if end_dt > now else "ended"
    remaining = item.get("remainingDay")
    if isinstance(remaining, int) and remaining > 0:
        return "active"
    product_type = str(item.get("productType") or "").upper()
    if product_type in {"PREORDER", "COMING_SOON"}:
        return "active"
    return "ended"


def map_wadiz_project(item: dict[str, Any]) -> dict[str, Any] | None:
    if not matches_wadiz_filters(item):
        return None

    project_id = str(item.get("id"))
    title = str(item.get("title") or "").strip()
    if not title:
        return None

    amount_krw = int(item.get("amount") or 0)
    rate = int(item.get("rate") or 0)
    raised_usd = krw_to_usd(amount_krw)
    goal_usd = int(round(raised_usd * 100 / rate)) if rate > 0 and raised_usd > 0 else max(raised_usd, 1)

    main_category = str(item.get("mainCategoryName") or "")
    sub_category = str(item.get("categoryName") or "")
    category = f"{main_category}/{sub_category}" if sub_category else main_category

    status = infer_status(item)
    backers = int(item.get("participants") or 0)

    end_dt = parse_wadiz_datetime(item.get("endDate"))
    start_dt = parse_wadiz_datetime(item.get("startDate") or item.get("openDate"))
    deadline_ts = int(end_dt.timestamp()) if end_dt else None
    launched_ts = int(start_dt.timestamp()) if start_dt else None
    metrics = compute_campaign_metrics(
        status=status,
        backers=backers,
        deadline_ts=deadline_ts,
        launched_ts=launched_ts,
    )

    original_url = f"{WADIZ_DETAIL_BASE}/{project_id}"
    image_url = item.get("thumbnail") or None
    maker_name = str(item.get("makerName") or "").strip() or None

    return normalize_project(
        {
            "title": title,
            "subtitle": maker_name,
            "platform": "wadiz",
            "original_url": original_url,
            "image_url": image_url,
            "raised_usd": raised_usd,
            "goal_usd": goal_usd,
            "backers": backers,
            "category": category,
            "country": "South Korea",
            "status": status,
            **metrics,
            "maker_website": None,
            "created_at": utc_now_iso(),
        }
    )


def fetch_wadiz_page(page: int, idx: int = 0) -> dict[str, Any] | None:
    params = {"ai": "true", "idx": str(idx), "page": str(page)}
    try:
        resp = requests.get(API_BASE, params=params, headers=DEFAULT_HEADERS, timeout=60)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as exc:
        print(f"[wadiz] page {page} fetch failed: {exc}", file=sys.stderr)
        return None


def crawl_wadiz(max_pages: int = 10, idx: int = 0) -> list[dict[str, Any]]:
    projects: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    for page in range(max_pages):
        print(f"[wadiz] fetching page {page}")
        payload = fetch_wadiz_page(page, idx=idx)
        if not payload:
            break

        items = collect_funding_items(payload.get("data") or payload)
        if not items:
            print(f"[wadiz] page {page}: no project items, stopping")
            break

        page_added = 0
        for item in items:
            mapped = map_wadiz_project(item)
            if not mapped:
                continue
            url = mapped["original_url"]
            if url in seen_urls:
                continue
            seen_urls.add(url)
            projects.append(mapped)
            page_added += 1

        print(f"[wadiz] page {page}: scanned {len(items)} items, matched {page_added}")

        if page_added == 0 and page >= 2:
            break

    projects.sort(key=lambda p: p["raised_usd"], reverse=True)
    return projects


def main() -> int:
    parser = argparse.ArgumentParser(description="Crawl Wadiz projects")
    parser.add_argument("--pages", type=int, default=10, help="Maximum API pages to fetch")
    parser.add_argument("--idx", type=int, default=0, help="API idx parameter")
    parser.add_argument("--no-save", action="store_true", help="Skip writing output files")
    parser.add_argument("--no-supabase", action="store_true", help="Skip Supabase upsert")
    args = parser.parse_args()

    projects = crawl_wadiz(max_pages=args.pages, idx=args.idx)
    print(f"[wadiz] total matched: {len(projects)}")

    if not projects:
        print("[wadiz] no projects found")
        return 1

    if not args.no_save:
        path = save_json(projects, "wadiz_projects.json")
        print(f"[wadiz] saved to {path}")
        if not args.no_supabase:
            saved = save_to_supabase(projects)
            if saved:
                print(f"[wadiz] upserted {saved} rows to Supabase")
            else:
                print(
                    "[wadiz] ERROR: Supabase sync failed (0 rows saved). "
                    "Check platform constraint includes 'wadiz'.",
                    file=sys.stderr,
                )
                return 1

    print(json.dumps({"count": len(projects), "top": projects[:3]}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
