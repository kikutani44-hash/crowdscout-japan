#!/usr/bin/env python3
"""Run Kickstarter and Indiegogo crawlers and merge output."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from common import DATA_DIR, save_json, utc_now_iso

SCRIPTS_DIR = Path(__file__).resolve().parent


def run_script(name: str, extra_args: list[str]) -> int:
    cmd = [sys.executable, str(SCRIPTS_DIR / name), *extra_args]
    print(f"[run_crawl] executing: {' '.join(cmd)}")
    return subprocess.call(cmd, cwd=str(SCRIPTS_DIR))


def merge_outputs() -> Path:
    merged: list[dict] = []
    for filename in ("kickstarter_projects.json", "indiegogo_projects.json"):
        path = DATA_DIR / filename
        if not path.exists():
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        merged.extend(payload.get("projects") or [])

    merged.sort(key=lambda p: p.get("raised_usd", 0), reverse=True)
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
    parser.add_argument("--kickstarter-only", action="store_true")
    parser.add_argument("--indiegogo-only", action="store_true")
    args = parser.parse_args()

    code = 0
    if not args.indiegogo_only:
        code = run_script("crawl_kickstarter.py", ["--pages", str(args.ks_pages)])
        if code != 0:
            return code

    if not args.kickstarter_only:
        code = run_script("crawl_indiegogo.py", ["--max", str(args.igg_max)])
        if code != 0:
            return code

    merged = merge_outputs()
    print(f"[run_crawl] merged output -> {merged}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
