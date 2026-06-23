#!/usr/bin/env python3
"""Set Netlify environment variables from .env.local (requires netlify login)."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env.local")

VARS = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
]


def main() -> int:
    missing = [k for k in VARS if not os.environ.get(k)]
    if missing:
        print(f"[netlify] missing in .env.local: {', '.join(missing)}", file=sys.stderr)
        return 1

    for key in VARS:
        value = os.environ[key]
        cmd = [
            "npx",
            "netlify-cli",
            "env:set",
            key,
            value,
            "--context",
            "production",
        ]
        print(f"[netlify] setting {key} ...")
        result = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True)
        if result.returncode != 0:
            print(result.stderr or result.stdout, file=sys.stderr)
            print(
                "[netlify] Run `npx netlify-cli login` and link the site first:\n"
                "  npx netlify-cli link",
                file=sys.stderr,
            )
            return result.returncode
    print("[netlify] environment variables set. Trigger deploy from Netlify dashboard.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
