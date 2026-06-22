#!/usr/bin/env python3
"""Upload projects_merged.json to Supabase (upsert by original_url)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from common import DATA_DIR, save_to_supabase, utc_now_iso

MERGED_PATH = DATA_DIR / "projects_merged.json"


def load_merged_projects() -> list[dict]:
    if not MERGED_PATH.exists():
        raise FileNotFoundError(f"Missing {MERGED_PATH}. Run: python3 scripts/run_crawl.py")
    payload = json.loads(MERGED_PATH.read_text(encoding="utf-8"))
    projects = payload.get("projects") or []
    if not projects:
        raise ValueError("projects_merged.json has no projects")
    return projects


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync local crawl data to Supabase")
    parser.add_argument(
        "--file",
        type=Path,
        default=MERGED_PATH,
        help="JSON file to sync (default: data/projects_merged.json)",
    )
    args = parser.parse_args()

    if args.file != MERGED_PATH:
        payload = json.loads(args.file.read_text(encoding="utf-8"))
        projects = payload.get("projects") or payload
    else:
        projects = load_merged_projects()

    print(f"[sync] {len(projects)} projects from {args.file}")
    saved = save_to_supabase(projects)
    if saved == 0:
        print(
            "[sync] ERROR: 0 rows saved. Check .env.local:\n"
            "  NEXT_PUBLIC_SUPABASE_URL\n"
            "  SUPABASE_SERVICE_ROLE_KEY",
            file=sys.stderr,
        )
        return 1

    print(f"[sync] OK: {saved}/{len(projects)} projects upserted at {utc_now_iso()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
