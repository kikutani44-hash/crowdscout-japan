#!/usr/bin/env python3
"""Batch Japan CF check — reads unchecked projects from Supabase and writes results back."""

from __future__ import annotations

import argparse
import json
import os
import sys

import requests
from playwright.sync_api import sync_playwright

from check_japan_cf import check_japan_cf
from common import calculate_score, create_browser, utc_now_iso

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def supabase_headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }


def fetch_unchecked(limit: int) -> list[dict]:
    """Fetch projects where japan_cf_checked is false or null."""
    params = {
        "select": "id,title,title_ja,subtitle,subtitle_ja",
        "japan_cf_checked": "eq.false",
        "order": "created_at.desc",
        "limit": str(limit),
    }
    r = requests.get(f"{SUPABASE_URL}/rest/v1/projects", headers=supabase_headers(), params=params)
    r.raise_for_status()
    rows = r.json()

    # Also grab rows where japan_cf_checked is null
    params2 = {**params, "japan_cf_checked": "is.null"}
    r2 = requests.get(f"{SUPABASE_URL}/rest/v1/projects", headers=supabase_headers(), params=params2)
    r2.raise_for_status()
    rows += r2.json()

    # Deduplicate by id
    seen: set[str] = set()
    result: list[dict] = []
    for row in rows:
        if row["id"] not in seen:
            seen.add(row["id"])
            result.append(row)
    return result[:limit]


def update_project(project_id: str, cf_result: dict, score: float) -> None:
    payload = {
        "japan_cf_checked": True,
        "japan_cf_result": cf_result,
        "score": score,
        "updated_at": utc_now_iso(),
    }
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/projects",
        headers={**supabase_headers(), "Prefer": "return=minimal"},
        params={"id": f"eq.{project_id}"},
        json=payload,
    )
    r.raise_for_status()


def pick_query(project: dict) -> str:
    for key in ("title_ja", "title", "subtitle_ja", "subtitle"):
        value = project.get(key)
        if value and str(value).strip():
            text = str(value).strip()
            return text.split(":")[0].split("|")[0].strip()[:80]
    return "unknown"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=50, help="Max projects to check per run")
    parser.add_argument("--force", action="store_true", help="Re-check even if already checked (not yet supported with Supabase mode)")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[batch_cf] ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set", file=sys.stderr)
        return 1

    projects = fetch_unchecked(args.limit)
    print(f"[batch_cf] {len(projects)} unchecked projects to process")

    if not projects:
        print("[batch_cf] nothing to do")
        return 0

    checked = 0
    entered = 0
    unentered = 0

    with sync_playwright() as playwright:
        browser, context = create_browser(playwright)
        page = context.new_page()

        for project in projects:
            query = pick_query(project)
            print(f"[batch_cf] checking ({checked+1}/{len(projects)}): {query}")
            try:
                result = check_japan_cf(query, page=page)
                score = calculate_score({**project, "japan_cf_checked": True, "japan_cf_result": result})
                update_project(project["id"], result, score)
                if result.get("isJapanUnentered"):
                    unentered += 1
                else:
                    entered += 1
                checked += 1
            except Exception as exc:
                print(f"[batch_cf] ERROR on {query}: {exc}", file=sys.stderr)

        browser.close()

    print(f"[batch_cf] done: {checked} checked, {unentered} unentered, {entered} entered in Japan")
    print(json.dumps({"checked": checked, "unentered": unentered, "entered": entered}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
