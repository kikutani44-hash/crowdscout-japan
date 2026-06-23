#!/usr/bin/env python3
"""Set ANTHROPIC_API_KEY on Netlify from .env.local or environment."""

from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env.local")

SITE_NAME = os.environ.get("NETLIFY_SITE_NAME", "crowdscout-japan")
SITE_ID = os.environ.get("NETLIFY_SITE_ID", "")


def resolve_site_id(token: str) -> str:
    if SITE_ID:
        return SITE_ID
    req = urllib.request.Request(
        f"https://api.netlify.com/api/v1/sites/{SITE_NAME}",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())
    return data["id"]


def main() -> int:
    token = os.environ.get("NETLIFY_AUTH_TOKEN", "").strip()
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not token:
        print("[netlify] NETLIFY_AUTH_TOKEN required", file=sys.stderr)
        return 1
    if not api_key:
        print("[netlify] ANTHROPIC_API_KEY required in .env.local", file=sys.stderr)
        return 1

    site_id = resolve_site_id(token)
    payload = json.dumps(
        [
            {
                "key": "ANTHROPIC_API_KEY",
                "scopes": ["production", "deploy-preview"],
                "values": [{"value": api_key, "context": "production"}],
            }
        ]
    ).encode()

    req = urllib.request.Request(
        f"https://api.netlify.com/api/v1/accounts/self/env?site_id={site_id}",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        resp.read()

    print(f"[netlify] ANTHROPIC_API_KEY set for site {SITE_NAME} ({site_id})")
    print("[netlify] Trigger deploy: Site configuration → Deploys → Trigger deploy")
    return 0


if __name__ == "__main__":
    sys.exit(main())
