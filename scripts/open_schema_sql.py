#!/usr/bin/env python3
"""Open Supabase SQL Editor with schema pre-filled (manual Run click if needed)."""

from __future__ import annotations

import sys
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "supabase" / "schema.sql"
PROJECT_REF = "kvmrmtyfdvdkzhxckqjn"
SQL_URL = f"https://supabase.com/dashboard/project/{PROJECT_REF}/sql/new"


def main() -> int:
    sql = SCHEMA.read_text(encoding="utf-8")
    print(f"Open: {SQL_URL}")
    print("Paste the following SQL and click Run:\n")
    print("-" * 60)
    print(sql)
    print("-" * 60)
    webbrowser.open(SQL_URL)
    return 0


if __name__ == "__main__":
    sys.exit(main())
