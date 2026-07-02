#!/usr/bin/env python3
"""Search for a maker website via SerpAPI (Google search results)."""

from __future__ import annotations

import os
import re
import sys
from urllib.parse import urlparse

import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path="../.env.local")

SEARCH_URL = "https://serpapi.com/search"

BLOCKED_DOMAINS = (
    "kickstarter.com",
    "indiegogo.com",
    "reddit.com",
    "youtube.com",
    "youtu.be",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "wikipedia.org",
    "amazon.com",
    "amazon.co.jp",
    "linkedin.com",
    "pinterest.com",
    "tiktok.com",
    "quora.com",
    "kicktraq.com",
    "backerkit.com",
    "crowdfundinsider.com",
    "backercrew.com",
    "dailymotion.com",
    "vimeo.com",
    "designboom.com",
    "newatlas.com",
    "thegadgetrend.com",
    "the-gadgeteer.com",
    "gizmag.com",
    "gizmodo.com",
    "techcrunch.com",
    "engadget.com",
    "yankodesign.com",
    "core77.com",
    "boredpanda.com",
    "businessinsider.com",
    "forbes.com",
    "cnet.com",
    "digitaltrends.com",
)

# Heuristic substrings: crowdfunding-tracker / backer-reward services almost
# always contain one of these words in their domain, while real maker sites
# almost never do.
BLOCKED_SUBSTRINGS = ("backer", "kicktraq", "crowdfund", "kickfeed")

# Known false-match domains confirmed by manual review
BLOCKED_DOMAINS_CONFIRMED_MISMATCH = (
    "pennfishing.com",
    "statetroopers.org",
    "melimelo.com",
    "gyro.money",
    "rayeofficial.com",
    "sonymusic.com",
    "rive.app",
    "basecamp.com",
    "princeharrymemoir.com",
    "ocean.org",
    "breeze.ca.gov",
    "trooperclothing.com",
)


def _is_blocked_url(url: str) -> bool:
    lowered = url.lower()
    if any(domain in lowered for domain in BLOCKED_DOMAINS):
        return True
    if any(domain in lowered for domain in BLOCKED_DOMAINS_CONFIRMED_MISMATCH):
        return True
    return any(substring in lowered for substring in BLOCKED_SUBSTRINGS)


_BRAND_SPLIT_RE = re.compile(r"[:—–|\-—–]")
_NON_ALNUM_RE = re.compile(r"[^a-z0-9]")
_TRADEMARK_RE = re.compile(r"[™®©]")


def extract_brand(title: str) -> str:
    """Extract the likely brand/product name from a Kickstarter-style title.

    Titles are usually formatted as "BrandName: description" or
    "BrandName - description" or "BrandName | description". Take the first
    chunk before the first separator.
    """
    cleaned = _TRADEMARK_RE.sub("", title.strip())
    first_chunk = _BRAND_SPLIT_RE.split(cleaned, maxsplit=1)[0].strip()
    return first_chunk or cleaned.strip()


def _normalize(text: str) -> str:
    return _NON_ALNUM_RE.sub("", text.lower())


def _brand_matches_domain(brand: str, url: str) -> bool:
    """Check whether the brand name plausibly appears in the URL's domain."""
    domain = (urlparse(url).netloc or "").lower().removeprefix("www.")
    domain_root = domain.split(".")[0]
    brand_norm = _normalize(brand)
    if len(brand_norm) < 3:
        return False
    return brand_norm in _normalize(domain_root) or _normalize(domain_root) in brand_norm


def _search_google(query: str, api_key: str, num: int = 10) -> list[dict]:
    resp = requests.get(
        SEARCH_URL,
        params={
            "engine": "google",
            "api_key": api_key,
            "q": query,
            "num": num,
        },
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("organic_results") or []


def search_maker_website(title: str) -> str | None:
    """Search Google (via SerpAPI) for the maker's official website from a project title.

    Only returns a URL whose domain plausibly matches the extracted brand name,
    to avoid picking up news sites, retailers, or crowdfunding-tracker sites
    that happen to rank for the full title.
    """
    api_key = os.environ.get("SERPAPI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("Set SERPAPI_API_KEY in .env.local")

    brand = extract_brand(title)
    results = _search_google(f"{brand} official website", api_key)

    for item in results:
        link = (item.get("link") or "").strip()
        if link and not _is_blocked_url(link) and _brand_matches_domain(brand, link):
            return link

    return None


def main() -> int:
    test_title = "TSUKI Japanese Knife kickstarter"
    print(f"[search] query: {test_title!r} official website")

    try:
        result = search_maker_website(test_title)
    except Exception as exc:
        print(f"[search] Error: {exc}", file=sys.stderr)
        return 1

    if result:
        print(f"[search] result: {result}")
        return 0

    print("[search] result: (no matching URL found)")
    return 1


if __name__ == "__main__":
    sys.exit(main())
