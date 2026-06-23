#!/usr/bin/env python3
"""Remove game / publishing / art projects from local JSON and Supabase."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from category_filters import EXCLUDED_PARENTS, EXCLUDED_KEYWORDS, is_allowed_category
from common import DATA_DIR, utc_now_iso

LOCAL_FILES = (
    "projects_merged.json",
    "kickstarter_projects.json",
    "indiegogo_projects.json",
)


def is_excluded_category(category: str) -> bool:
    if not category or not category.strip():
        return True
    parent = category.split("/")[0].strip()
    if parent in EXCLUDED_PARENTS:
        return True
    lower = category.lower()
    if any(keyword in lower for keyword in EXCLUDED_KEYWORDS):
        return True
    return not is_allowed_category(category)


def filter_projects(projects: list[dict]) -> tuple[list[dict], list[dict]]:
    kept: list[dict] = []
    removed: list[dict] = []
    for project in projects:
        category = str(project.get("category") or "")
        if is_excluded_category(category):
            removed.append(project)
        else:
            kept.append(project)
    return kept, removed


def purge_local_json() -> int:
    total_removed = 0
    for filename in LOCAL_FILES:
        path = DATA_DIR / filename
        if not path.exists():
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        projects = payload.get("projects") or []
        kept, removed = filter_projects(projects)
        if not removed:
            print(f"[purge] {filename}: nothing to remove")
            continue
        payload["projects"] = kept
        payload["count"] = len(kept)
        payload["fetched_at"] = utc_now_iso()
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[purge] {filename}: removed {len(removed)}, kept {len(kept)}")
        for item in removed:
            print(f"  - {item.get('title', '?')[:70]} [{item.get('category')}]")
        total_removed += len(removed)
    return total_removed


def purge_supabase() -> int:
    import os

    import requests

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("[purge] Supabase credentials not set, skipping remote purge")
        return 0

    base = url.rstrip("/")
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }
    resp = requests.get(
        f"{base}/rest/v1/projects",
        headers=headers,
        params={"select": "id,title,category"},
        timeout=120,
    )
    if not resp.ok:
        print(f"[purge] Supabase fetch failed: {resp.status_code} {resp.text[:300]}")
        return 0

    rows = resp.json()
    to_delete = [row for row in rows if is_excluded_category(str(row.get("category") or ""))]
    if not to_delete:
        print("[purge] Supabase: no excluded rows")
        return 0

    deleted = 0
    for row in to_delete:
        del_resp = requests.delete(
            f"{base}/rest/v1/projects",
            headers=headers,
            params={"id": f"eq.{row['id']}"},
            timeout=30,
        )
        if del_resp.ok:
            deleted += 1
            print(f"[purge] deleted: {row.get('title', '?')[:60]} [{row.get('category')}]")
        else:
            print(f"[purge] delete failed id={row['id']}: {del_resp.text[:200]}")

    print(f"[purge] Supabase: deleted {deleted}/{len(to_delete)} excluded rows")
    return deleted


def main() -> int:
    parser = argparse.ArgumentParser(description="Purge excluded category projects")
    parser.add_argument("--local-only", action="store_true")
    parser.add_argument("--remote-only", action="store_true")
    args = parser.parse_args()

    removed_local = 0
    removed_remote = 0
    if not args.remote_only:
        removed_local = purge_local_json()
    if not args.local_only:
        removed_remote = purge_supabase()

    print(f"[purge] done (local={removed_local}, supabase={removed_remote})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
