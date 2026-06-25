#!/usr/bin/env python3
"""
Extract maker contacts from crowdfunding project pages.

Opens each project's original_url (Kickstarter / Indiegogo project page) and extracts:
  - maker_sns: Instagram / X / Facebook
  - maker_website: external website (when found on the page)

Supabase target: all projects with maker_sns IS NULL (unless --force).
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any, Optional
from urllib.parse import unquote, urlparse

from bs4 import BeautifulSoup
from playwright.sync_api import Page, sync_playwright

from common import create_browser, dismiss_cookie_consent, utc_now_iso

KICKSTARTER_DOMAINS = ("kickstarter.com", "ksr.io")
INDIEGOGO_DOMAINS = ("indiegogo.com",)

BLOCKED_WEBSITE_DOMAINS = (
    *KICKSTARTER_DOMAINS,
    *INDIEGOGO_DOMAINS,
    "instagram.com",
    "twitter.com",
    "x.com",
    "facebook.com",
    "linkedin.com",
    "youtube.com",
    "tiktok.com",
    "bsky.app",
)

LINK_TOOL_DOMAINS = (
    "bio.link",
    "beacons.ai",
    "linkin.bio",
    "hoo.be",
    "taplink.cc",
    "carrd.co",
    "allmylinks.com",
    "solo.to",
    "msha.ke",
    "campsite.bio",
    "lnk.bio",
)

ALLOWED_LINK_TOOL_DOMAINS = ("linktr.ee", "linktree.com")

SNS_SKIP_PATHS = (
    "/sharer",
    "/share",
    "/intent/",
    "/compose",
    "/plugins/",
    "/privacy",
    "/policies",
    "/help",
    "/login",
    "/signup",
)

SNS_HANDLE_BLOCKLIST = ("kickstarter", "indiegogo")


def fetch_page_html(page: Page, url: str) -> Optional[str]:
    response = None
    try:
        response = page.goto(url, wait_until="networkidle", timeout=90000)
    except Exception:
        response = page.goto(url, wait_until="domcontentloaded", timeout=90000)
    if not response or response.status >= 400:
        return None
    dismiss_cookie_consent(page)
    page.wait_for_timeout(3000)
    html = page.content()
    return html if html else None


def _normalize_url(url: str) -> str | None:
    cleaned = url.strip().rstrip(".,;:)\"'")
    if not cleaned:
        return None
    if cleaned.startswith("//"):
        cleaned = f"https:{cleaned}"
    elif not cleaned.startswith(("http://", "https://")):
        cleaned = f"https://{cleaned}"
    parsed = urlparse(cleaned)
    if not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path}".rstrip("/")


def _domain(url: str) -> str:
    return (urlparse(url).netloc or "").lower().removeprefix("www.")


def _is_platform_url(url: str) -> bool:
    lowered = url.lower()
    return any(domain in lowered for domain in (*KICKSTARTER_DOMAINS, *INDIEGOGO_DOMAINS))


def _is_blocked_link_tool_domain(domain: str) -> bool:
    if any(domain == allowed or domain.endswith(f".{allowed}") for allowed in ALLOWED_LINK_TOOL_DOMAINS):
        return False
    return any(tool in domain for tool in LINK_TOOL_DOMAINS)


def _is_valid_external_website(url: str) -> bool:
    if _is_platform_url(url):
        return False
    domain = _domain(url)
    if not domain or _is_blocked_link_tool_domain(domain):
        return False
    return not any(blocked in domain for blocked in BLOCKED_WEBSITE_DOMAINS)


def _is_valid_sns_url(url: str) -> bool:
    path = (urlparse(url).path or "").lower()
    if any(skip in path for skip in SNS_SKIP_PATHS):
        return False
    return not any(handle in path for handle in SNS_HANDLE_BLOCKLIST)


def _classify_sns_url(url: str) -> tuple[str, str] | None:
    cleaned = _normalize_url(url)
    if not cleaned or not _is_valid_sns_url(cleaned):
        return None
    domain = _domain(cleaned)
    if "instagram.com" in domain or "instagr.am" in domain:
        return "instagram", cleaned
    if "twitter.com" in domain or domain == "x.com" or domain.endswith(".x.com"):
        return "x", cleaned
    if "facebook.com" in domain or "fb.com" in domain or "fb.me" in domain:
        return "facebook", cleaned
    return None


def _normalize_href(href: str) -> str | None:
    href = unquote(href.strip())
    if href.startswith("//"):
        return f"https:{href}"
    if href.startswith(("http://", "https://")):
        return href
    return None


def _extract_links_from_html(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    links: list[str] = []
    seen: set[str] = set()
    for anchor in soup.find_all("a", href=True):
        normalized = _normalize_href(str(anchor["href"]))
        if normalized and normalized not in seen:
            seen.add(normalized)
            links.append(normalized)
    return links


def extract_contacts_from_html(html: str) -> dict[str, Any]:
    """Extract SNS links and external website from a project page."""
    sns: dict[str, str] = {}
    external_candidates: list[str] = []

    for link in _extract_links_from_html(html):
        sns_match = _classify_sns_url(link)
        if sns_match:
            key, sns_url = sns_match
            sns.setdefault(key, sns_url)
            continue
        normalized = _normalize_url(link)
        if normalized and _is_valid_external_website(normalized):
            external_candidates.append(normalized)

    external_website = external_candidates[0] if external_candidates else None
    return {
        "maker_sns": sns or None,
        "external_website": external_website,
    }


def extract_contacts_from_project_page(
    page: Page,
    project_url: str,
    *,
    debug: bool = False,
) -> dict[str, Any]:
    html = fetch_page_html(page, project_url)
    if not html:
        return {}

    if debug:
        links = _extract_links_from_html(html)
        print(f"[contacts]   debug page links: {len(links)}")
        for link in links[:10]:
            print(f"[contacts]   debug link: {link}")

    return extract_contacts_from_html(html)


def fetch_all_projects(*, force: bool = False) -> list[dict[str, Any]]:
    """Load Supabase projects missing maker_sns (all platforms)."""
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
    params: dict[str, str] = {
        "select": "id,title,original_url,maker_website,maker_sns,platform",
        "order": "updated_at.desc",
    }
    if not force:
        params["maker_sns"] = "is.null"

    resp = requests.get(
        f"{url}/rest/v1/projects",
        headers=headers,
        params=params,
        timeout=120,
    )
    resp.raise_for_status()
    projects = resp.json()
    return [p for p in projects if (p.get("original_url") or "").strip()]


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


def _build_updates(extracted: dict[str, Any]) -> dict[str, Any] | None:
    maker_sns = extracted.get("maker_sns")
    external_website = extracted.get("external_website")
    if not maker_sns and not external_website:
        return None

    updates: dict[str, Any] = {"updated_at": utc_now_iso()}
    if maker_sns:
        updates["maker_sns"] = maker_sns
    if external_website:
        updates["maker_website"] = external_website
    return updates


def extract_contacts(
    *,
    force: bool = False,
    limit: int = 0,
    headless: bool = True,
) -> tuple[int, int]:
    all_projects = fetch_all_projects(force=force)
    label = "all projects" if force else "projects with maker_sns null"
    print(f"[contacts] loaded {len(all_projects)} {label} from Supabase")

    projects = all_projects
    if limit:
        projects = projects[:limit]

    print(f"[contacts] {len(projects)} project pages to scan")
    if not projects:
        return 0, 0

    ok = 0

    with sync_playwright() as playwright:
        browser, context = create_browser(playwright, headless=headless)
        page = context.new_page()

        for index, project in enumerate(projects, start=1):
            project_id = project["id"]
            title = project.get("title") or ""
            project_url = (project.get("original_url") or "").strip()

            print(f"[contacts] {index}/{len(projects)}: {title[:60]}...")
            print(f"[contacts]   page: {project_url}")

            try:
                extracted = extract_contacts_from_project_page(
                    page,
                    project_url,
                    debug=(index == 1),
                )
                updates = _build_updates(extracted)
                if not updates:
                    print("[contacts]   skip: no SNS or external website found")
                    continue

                patch_project(project_id, updates)
                ok += 1
                parts = []
                if updates.get("maker_sns"):
                    parts.append(f"sns={updates['maker_sns']}")
                if updates.get("maker_website"):
                    parts.append(f"website={updates['maker_website']}")
                print(f"[contacts]   saved: {', '.join(parts)}")
            except Exception as exc:
                print(f"[contacts]   failed: {exc}", file=sys.stderr)

        browser.close()

    return ok, len(projects)


def enrich_kickstarter_projects(
    projects: list[dict[str, Any]],
    *,
    headless: bool = True,
) -> int:
    """Fill maker_sns / maker_website from project pages (original_url)."""
    targets = [
        p
        for p in projects
        if (p.get("original_url") or "").strip() and not p.get("maker_sns")
    ]
    if not targets:
        return 0

    enriched = 0
    with sync_playwright() as playwright:
        browser, context = create_browser(playwright, headless=headless)
        page = context.new_page()

        for index, project in enumerate(targets, start=1):
            project_url = (project.get("original_url") or "").strip()
            title = project.get("title") or ""
            print(f"[contacts] {index}/{len(targets)}: {title[:60]}...")

            try:
                extracted = extract_contacts_from_project_page(
                    page,
                    project_url,
                    debug=(index == 1),
                )
                if extracted.get("maker_sns"):
                    project["maker_sns"] = extracted["maker_sns"]
                if extracted.get("external_website"):
                    project["maker_website"] = extracted["external_website"]
                if extracted.get("maker_sns") or extracted.get("external_website"):
                    enriched += 1
                else:
                    print("[contacts]   skip: no contacts found")
            except Exception as exc:
                print(f"[contacts]   failed: {exc}", file=sys.stderr)

        browser.close()

    return enriched


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extract SNS and website from project pages (original_url)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-scan even when maker_sns already exists",
    )
    parser.add_argument("--limit", type=int, default=0, help="Max projects to scan")
    parser.add_argument(
        "--headed",
        action="store_true",
        help="Run browser with UI (default: headless)",
    )
    args = parser.parse_args()

    try:
        ok, total = extract_contacts(
            force=args.force,
            limit=args.limit,
            headless=not args.headed,
        )
    except RuntimeError as exc:
        print(f"[contacts] ERROR: {exc}", file=sys.stderr)
        return 1

    print(f"[contacts] OK: {ok}/{total} updated at {utc_now_iso()}")
    return 0 if ok == total or total == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
