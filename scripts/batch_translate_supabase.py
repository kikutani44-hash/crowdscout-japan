#!/usr/bin/env python3
"""Translate all Supabase projects that lack real Japanese title_ja / subtitle_ja."""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any

from common import utc_now_iso
from translation_utils import needs_japanese_translation
from translator import translate_to_japanese


def fetch_all_projects() -> list[dict[str, Any]]:
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise RuntimeError(
            "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
        )

    import requests

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }
    resp = requests.get(
        f"{url}/rest/v1/projects",
        headers=headers,
        params={"select": "*", "order": "created_at.desc"},
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def patch_project(project_id: str, updates: dict[str, Any]) -> None:
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    import requests

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    resp = requests.patch(
        f"{url}/rest/v1/projects",
        headers=headers,
        params={"id": f"eq.{project_id}"},
        json=updates,
        timeout=60,
    )
    resp.raise_for_status()


def main() -> int:
    parser = argparse.ArgumentParser(description="Batch translate Supabase projects")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-translate even when title_ja / subtitle_ja exist",
    )
    parser.add_argument("--limit", type=int, default=0, help="Max projects to translate")
    args = parser.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY", "").strip():
        print("[translate] ERROR: ANTHROPIC_API_KEY is not set", file=sys.stderr)
        return 1

    projects = fetch_all_projects()
    print(f"[translate] loaded {len(projects)} projects from Supabase")

    targets = [
        p
        for p in projects
        if args.force or needs_japanese_translation(p)
    ]
    if args.limit:
        targets = targets[: args.limit]

    print(f"[translate] {len(targets)} projects need translation")
    if not targets:
        return 0

    ok = 0
    for index, project in enumerate(targets, start=1):
        title = project.get("title") or ""
        subtitle = project.get("subtitle") or ""
        print(f"[translate] {index}/{len(targets)}: {title[:70]}...")
        try:
            result = translate_to_japanese(title, subtitle)
            patch_project(
                project["id"],
                {
                    "title_ja": result["title_ja"],
                    "subtitle_ja": result.get("subtitle_ja") or subtitle,
                    "updated_at": utc_now_iso(),
                },
            )
            ok += 1
        except Exception as exc:
            print(f"[translate] failed: {exc}", file=sys.stderr)

    print(f"[translate] OK: {ok}/{len(targets)} saved to Supabase at {utc_now_iso()}")
    return 0 if ok == len(targets) else 1


if __name__ == "__main__":
    sys.exit(main())
