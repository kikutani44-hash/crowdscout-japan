#!/usr/bin/env python3
"""Batch Japan CF check for all projects in data/projects_merged.json."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

from check_japan_cf import check_japan_cf
from common import DATA_DIR, calculate_score, utc_now_iso

MERGED_PATH = DATA_DIR / "projects_merged.json"


def pick_query(project: dict) -> str:
    for key in ("title_ja", "title", "subtitle_ja", "subtitle"):
        value = project.get(key)
        if value and str(value).strip():
            text = str(value).strip()
            # Prefer shorter brand-like prefix for search
            return text.split(":")[0].split("|")[0].strip()[:80]
    return "unknown"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="Max projects to check (0=all)")
    parser.add_argument("--force", action="store_true", help="Re-check even if already checked")
    args = parser.parse_args()

    if not MERGED_PATH.exists():
        print(f"[batch_cf] missing {MERGED_PATH}", file=sys.stderr)
        return 1

    payload = json.loads(MERGED_PATH.read_text(encoding="utf-8"))
    projects = payload.get("projects") or []
    checked = 0

    with sync_playwright() as playwright:
        from common import create_browser

        browser, context = create_browser(playwright)
        page = context.new_page()

        for project in projects:
            if args.limit and checked >= args.limit:
                break
            if project.get("japan_cf_checked") and not args.force:
                continue

            query = pick_query(project)
            print(f"[batch_cf] checking: {query}", file=sys.stderr)
            result = check_japan_cf(query, page=page)
            project["japan_cf_checked"] = True
            project["japan_cf_result"] = result
            project["score"] = calculate_score(project)
            project["updated_at"] = utc_now_iso()
            checked += 1

        browser.close()

    payload["projects"] = projects
    payload["cf_checked_at"] = utc_now_iso()
    MERGED_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"checked": checked, "path": str(MERGED_PATH)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
