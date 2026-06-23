#!/usr/bin/env python3
"""Upload projects_merged.json to Supabase (upsert by original_url)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from common import DATA_DIR, replace_supabase_projects, save_to_supabase, utc_now_iso
from translator import translate_projects

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
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Delete all existing Supabase rows before upserting (full overwrite)",
    )
    parser.add_argument(
        "--translate",
        action="store_true",
        help="Translate title/subtitle via Claude API before sync",
    )
    parser.add_argument(
        "--force-translate",
        action="store_true",
        help="Re-translate even when title_ja / subtitle_ja already exist",
    )
    args = parser.parse_args()

    if args.file != MERGED_PATH:
        payload = json.loads(args.file.read_text(encoding="utf-8"))
        projects = payload.get("projects") or payload
    else:
        projects = load_merged_projects()

    print(f"[sync] {len(projects)} projects from {args.file}")
    if args.translate:
        print("[sync] translating projects via Claude API...")
        translate_projects(projects, force=args.force_translate)
        if args.file == MERGED_PATH:
            MERGED_PATH.write_text(
                json.dumps(
                    {"fetched_at": utc_now_iso(), "count": len(projects), "projects": projects},
                    ensure_ascii=False,
                    indent=2,
                ),
                encoding="utf-8",
            )
    if args.replace:
        print("[sync] replace mode: clearing Supabase before upload")
        saved = replace_supabase_projects(projects)
    else:
        saved = save_to_supabase(projects)
    if saved == 0:
        print(
            "[sync] ERROR: 0 rows saved. Check .env.local:\n"
            "  NEXT_PUBLIC_SUPABASE_URL\n"
            "  SUPABASE_SERVICE_ROLE_KEY",
            file=sys.stderr,
        )
        return 1

    print(f"[sync] OK: {saved}/{len(projects)} projects {'replaced' if args.replace else 'upserted'} at {utc_now_iso()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
