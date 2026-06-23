#!/usr/bin/env python3
"""List Netlify site env var names (values are never printed)."""

from __future__ import annotations

import json
import os
import sys
import urllib.request

SITE_NAME = os.environ.get("NETLIFY_SITE_NAME", "crowdscout-japan")


def main() -> int:
    token = os.environ.get("NETLIFY_AUTH_TOKEN", "").strip()
    if not token:
        print(
            "[netlify] NETLIFY_AUTH_TOKEN not set.\n"
            "  Create at: https://app.netlify.com/user/applications#personal-access-tokens\n"
            "  export NETLIFY_AUTH_TOKEN=nfp_...",
            file=sys.stderr,
        )
        return 1

    req = urllib.request.Request(
        f"https://api.netlify.com/api/v1/sites/{SITE_NAME}/env",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())

    keys = sorted({item.get("key") for item in data if item.get("key")})
    print(f"[netlify] site={SITE_NAME} env keys ({len(keys)}):")
    for key in keys:
        print(f"  - {key}")

    if "ANTHROPIC_API_KEY" in keys:
        print("[netlify] ANTHROPIC_API_KEY: set")
    else:
        print("[netlify] ANTHROPIC_API_KEY: NOT SET", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
