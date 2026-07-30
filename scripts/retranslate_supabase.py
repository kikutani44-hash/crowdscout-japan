#!/usr/bin/env python3
"""Supabase上の未翻訳プロジェクトを一括翻訳して書き戻す。"""

from __future__ import annotations

import json
import os
import sys

import requests

import common  # noqa: F401 — loads .env.local
from common import utc_now_iso
from translator import translate_to_japanese

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }


def fetch_untranslated(limit: int) -> list[dict]:
    rows: list[dict] = []
    for condition in ("title_ja.is.null", "title_ja.eq."):
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/projects",
            headers=headers(),
            params={
                "select": "id,title,subtitle",
                "or": f"({condition})",
                "order": "created_at.desc",
                "limit": str(limit),
            },
        )
        r.raise_for_status()
        for row in r.json():
            if row["id"] not in {x["id"] for x in rows}:
                rows.append(row)
    return rows[:limit]


def update_translation(project_id: str, title_ja: str, subtitle_ja: str) -> None:
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/projects",
        headers=headers(),
        params={"id": f"eq.{project_id}"},
        json={"title_ja": title_ja, "subtitle_ja": subtitle_ja, "updated_at": utc_now_iso()},
    )
    r.raise_for_status()


def main() -> int:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=200)
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Supabase env vars not set", file=sys.stderr)
        return 1

    projects = fetch_untranslated(args.limit)
    print(f"[retranslate] {len(projects)} 件の未翻訳プロジェクトを処理します")

    done = 0
    errors = 0
    for p in projects:
        title = p.get("title") or ""
        subtitle = p.get("subtitle") or ""
        if not title:
            continue
        try:
            result = translate_to_japanese(title, subtitle)
            update_translation(p["id"], result["title_ja"], result.get("subtitle_ja", ""))
            print(f"  ✓ {title[:50]} → {result['title_ja'][:40]}")
            done += 1
        except Exception as e:
            print(f"  ✗ {title[:50]}: {e}", file=sys.stderr)
            errors += 1

    print(f"[retranslate] 完了: {done}件翻訳, {errors}件エラー")
    return 0


if __name__ == "__main__":
    sys.exit(main())
