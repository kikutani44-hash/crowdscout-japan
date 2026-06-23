#!/usr/bin/env python3
"""Apply supabase/schema.sql via Supabase Management API or verify table exists."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "supabase" / "schema.sql"
load_dotenv(ROOT / ".env.local")

URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def table_exists() -> tuple[bool, int]:
    resp = requests.get(
        f"{URL}/rest/v1/projects",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"},
        params={"select": "id", "limit": 1},
        timeout=30,
    )
    if resp.status_code == 200:
        return True, resp.status_code
    if resp.status_code == 404 or "PGRST205" in resp.text or "42P01" in resp.text:
        return False, resp.status_code
    print(f"[setup] table check failed: HTTP {resp.status_code}")
    return False, resp.status_code


def apply_schema_via_management_api(sql: str) -> bool:
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    ref = URL.replace("https://", "").split(".")[0] if URL else ""
    if not token or not ref:
        return False
    resp = requests.post(
        f"https://api.supabase.com/v1/projects/{ref}/database/query",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"query": sql},
        timeout=120,
    )
    if resp.ok:
        return True
    print(f"[setup] management API failed: {resp.status_code} {resp.text[:300]}")
    return False


def apply_schema_via_pg(sql: str) -> bool:
    db_url = os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")
    password = os.environ.get("SUPABASE_DB_PASSWORD")
    ref = URL.replace("https://", "").split(".")[0] if URL else ""

    if not db_url and password and ref:
        db_url = (
            f"postgresql://postgres.{ref}:{password}"
            f"@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"
        )

    if not db_url:
        return False

    try:
        import psycopg2
    except ImportError:
        print("[setup] install psycopg2-binary: pip3 install psycopg2-binary")
        return False

    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        return True
    except Exception as exc:
        print(f"[setup] postgres error: {exc}")
        return False
    finally:
        conn.close()


def main() -> int:
    if not URL or not KEY:
        print("[setup] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
        return 1

    exists, status = table_exists()
    if exists:
        print("[setup] projects table already exists")
        return 0

    print(f"[setup] projects table missing (HTTP {status}), creating...")

    sql = SCHEMA_PATH.read_text(encoding="utf-8")

    if apply_schema_via_management_api(sql):
        print("[setup] schema applied via Management API")
        return 0

    if apply_schema_via_pg(sql):
        print("[setup] schema applied via DATABASE_URL")
        return 0

    print(
        "[setup] Could not auto-apply schema.\n"
        "  Option A: Supabase Dashboard → SQL Editor → paste supabase/schema.sql → Run\n"
        "  Option B: Add SUPABASE_ACCESS_TOKEN or SUPABASE_DB_URL to .env.local and re-run",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
