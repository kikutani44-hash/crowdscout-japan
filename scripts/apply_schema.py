#!/usr/bin/env python3
"""Apply schema when SUPABASE_DB_PASSWORD is set in .env.local."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "supabase" / "schema.sql"
load_dotenv(ROOT / ".env.local")

URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
PASSWORD = os.environ.get("SUPABASE_DB_PASSWORD", "")
REF = URL.replace("https://", "").split(".")[0] if URL else ""


def main() -> int:
    if not PASSWORD or not REF:
        print("Set SUPABASE_DB_PASSWORD in .env.local (Project Settings → Database → password)")
        return 1

    try:
        import psycopg2
    except ImportError:
        print("pip3 install psycopg2-binary")
        return 1

    sql = SCHEMA.read_text(encoding="utf-8")
    dsn = (
        f"host=aws-0-ap-northeast-1.pooler.supabase.com port=6543 dbname=postgres "
        f"user=postgres.{REF} password={PASSWORD} sslmode=require connect_timeout=15"
    )
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        print("[schema] applied successfully")
        return 0
    except Exception as exc:
        print(f"[schema] failed: {exc}", file=sys.stderr)
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
