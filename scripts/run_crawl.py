#!/usr/bin/env python3
"""Run Kickstarter and Indiegogo crawlers and merge output."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from common import DATA_DIR, utc_now_iso
from translator import translate_projects

SCRIPTS_DIR = Path(__file__).resolve().parent

# Demo crawl: 6 priority category groups (see category_filters.py)
DEFAULT_CATEGORIES = (
    "technology,gadget,health,healthcare,fitness,"
    "outdoor,sport,sports,food,kitchen,"
    "mobility,transport,design,lifestyle,fashion"
)


def run_script(name: str, extra_args: list[str]) -> int:
    cmd = [sys.executable, str(SCRIPTS_DIR / name), *extra_args]
    print(f"[run_crawl] executing: {' '.join(cmd)}")
    return subprocess.call(cmd, cwd=str(SCRIPTS_DIR))


def merge_outputs(*, translate: bool = True, force_translate: bool = False) -> Path:
    merged: list[dict] = []
    for filename in ("kickstarter_projects.json", "indiegogo_projects.json"):
        path = DATA_DIR / filename
        if not path.exists():
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        merged.extend(payload.get("projects") or [])

    merged.sort(key=lambda p: p.get("raised_usd", 0), reverse=True)

    if translate and merged:
        print(f"[run_crawl] translating {len(merged)} projects via Claude API...")
        translate_projects(merged, force=force_translate)

    out = DATA_DIR / "projects_merged.json"
    out.write_text(
        json.dumps(
            {"fetched_at": utc_now_iso(), "count": len(merged), "projects": merged},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Run all CrowdScout crawlers")
    parser.add_argument("--ks-pages", type=int, default=5)
    parser.add_argument("--igg-max", type=int, default=15)
    parser.add_argument(
        "--categories",
        type=str,
        default=DEFAULT_CATEGORIES,
        help="Comma-separated slugs (default: all 6 demo priority groups)",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Replace all Supabase projects with merged crawl results",
    )
    parser.add_argument(
        "--no-translate",
        action="store_true",
        help="Skip Claude API translation (title_ja / subtitle_ja)",
    )
    parser.add_argument(
        "--force-translate",
        action="store_true",
        help="Re-translate even when title_ja / subtitle_ja already exist",
    )
    parser.add_argument("--kickstarter-only", action="store_true")
    parser.add_argument("--indiegogo-only", action="store_true")
    args = parser.parse_args()

    category_args: list[str] = ["--categories", args.categories or DEFAULT_CATEGORIES]

    crawl_common = ["--no-supabase", "--no-translate", *category_args]

    code = 0
    if not args.indiegogo_only:
        code = run_script(
            "crawl_kickstarter.py",
            ["--pages", str(args.ks_pages), *crawl_common],
        )
        if code != 0:
            return code

    if not args.kickstarter_only:
        code = run_script(
            "crawl_indiegogo.py",
            ["--max", str(args.igg_max), *crawl_common],
        )
        if code != 0:
            return code

    merged = merge_outputs(
        translate=not args.no_translate,
        force_translate=args.force_translate,
    )
    print(f"[run_crawl] merged output -> {merged}")

    sync_args = ["--replace"] if args.replace else []
    sync_code = run_script("sync_to_supabase.py", sync_args)
    if sync_code != 0:
        print("[run_crawl] supabase sync skipped or failed (check .env.local)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
