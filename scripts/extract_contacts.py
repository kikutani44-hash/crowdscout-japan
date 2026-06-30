#!/usr/bin/env python3
"""
Extract maker contacts from crowdfunding project pages.

Opens each project's original_url (Kickstarter / Indiegogo project page) and extracts:
  - maker_sns: Instagram / X / Facebook
  - maker_website: external website (when found on the page)
  - maker_email: contact email (when found on the page)
  - maker_contact_form: contact/inquiry form URL (when found on the page)

Supabase target: all projects with maker_sns IS NULL (unless --force).
With --website-only: projects with maker_website set and maker_email null;
  scans maker_website for email and contact form.
  Indiegogo URLs are skipped; Kickstarter profile URLs are resolved first.
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys
from typing import Any, Optional
from urllib.parse import unquote, urljoin, urlparse

from bs4 import BeautifulSoup
from playwright.sync_api import Page, sync_playwright

from common import create_browser, dismiss_cookie_consent, fetch_json_page, utc_now_iso
from search_maker_website import search_maker_website

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

WEBSITE_SUBPAGE_KEYWORDS = ("contact", "お問い合わせ", "support", "about")

PLATFORM_MAKER_WEBSITE_DOMAINS = (
    "indiegogo.com",
    "kickstarter.com",
    "wadiz.kr",
    "zeczec.com",
)

BROWSER_CLOSED_ERROR = "Target page, context or browser has been closed"

KS_PROFILE_LINK_EXCLUSIONS = (
    *KICKSTARTER_DOMAINS,
    "google.com",
    "apple.com",
    "facebook.com",
    "twitter.com",
    "x.com",
    "instagram.com",
    "youtube.com",
    "linkedin.com",
    "tiktok.com",
    "policies.",
    "privacy.",
    "terms.",
    "support.",
    "help.",
)


def _is_platform_maker_website(url: str) -> bool:
    lowered = url.lower()
    return any(domain in lowered for domain in PLATFORM_MAKER_WEBSITE_DOMAINS)


def _is_kickstarter_profile_url(url: str) -> bool:
    return "kickstarter.com/profile/" in url.lower()


def _is_indiegogo_website(url: str) -> bool:
    return "indiegogo.com" in url.lower()


def _is_browser_closed_error(exc: BaseException) -> bool:
    return BROWSER_CLOSED_ERROR in str(exc)


def _close_browser_safe(browser: Any) -> None:
    try:
        browser.close()
    except Exception:
        pass


def _create_browser_page(playwright: Any, *, headless: bool = True) -> tuple[Any, Page]:
    browser, context = create_browser(playwright, headless=headless)
    page = context.new_page()
    return browser, page


def fetch_page_html(page: Page, url: str) -> Optional[str]:
    response = None
    try:
        response = page.goto(url, wait_until="networkidle", timeout=90000)
    except Exception:
        response = page.goto(url, wait_until="domcontentloaded", timeout=90000)
    if not response or response.status >= 400:
        return None
    dismiss_cookie_consent(page)
    # ページを下までスクロールしてコンテンツを読み込む
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(2000)
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(1000)
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


def _resolve_link(base_url: str, href: str) -> str | None:
    href = unquote(href.strip())
    if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
        return None
    if href.startswith("//"):
        absolute = f"https:{href}"
    elif href.startswith(("http://", "https://")):
        absolute = href
    else:
        absolute = urljoin(base_url, href)
    return _normalize_url(absolute)


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


def _list_external_website_links_from_page_html(
    html: str,
    base_url: str,
    *,
    exclude_domains: tuple[str, ...],
) -> list[str]:
    """List external maker website links from a page, excluding given domains."""
    soup = BeautifulSoup(html, "html.parser")
    seen: set[str] = set()
    links: list[str] = []

    for anchor in soup.find_all("a", href=True):
        resolved = _resolve_link(base_url, str(anchor["href"]))
        if not resolved or resolved in seen:
            continue
        seen.add(resolved)
        lowered = resolved.lower()
        if any(domain in lowered for domain in exclude_domains):
            continue
        if _is_valid_external_website(resolved):
            links.append(resolved)

    return links


def _find_external_website_from_page_html(
    html: str,
    base_url: str,
    *,
    exclude_domains: tuple[str, ...],
) -> str | None:
    """Find the first external maker website link, excluding platform domains."""
    links = _list_external_website_links_from_page_html(
        html,
        base_url,
        exclude_domains=exclude_domains,
    )
    return links[0] if links else None


def resolve_real_maker_website(
    page: Page,
    maker_website: str,
) -> tuple[str | None, bool]:
    """
    Resolve a Kickstarter profile URL to the maker's real site.

    Returns (real_website, attempted_resolution).
    attempted_resolution is True when maker_website was a KS profile URL.
    """
    maker_website = maker_website.strip()

    if not _is_kickstarter_profile_url(maker_website):
        return maker_website, False

    print(f"[contacts]   resolving KS profile: {maker_website}")
    html = fetch_page_html(page, maker_website)
    if not html:
        return None, True

    links = _list_external_website_links_from_page_html(
        html,
        maker_website,
        exclude_domains=KS_PROFILE_LINK_EXCLUSIONS,
    )
    print("[contacts]   debug external links found:", links)
    real = links[0] if links else None
    print("[contacts]   debug chosen:", real)
    if real:
        print(f"[contacts]   resolved maker_website: {real}")
    return real, True


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

    # メールアドレスの抽出
    email_pattern = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
    email_blocklist = ("kickstarter.com", "indiegogo.com", "sentry.io", "example.com", "wixpress.com")
    non_email_extensions = (
        "jpg", "jpeg", "png", "gif", "webp", "svg", "ico", "css", "js", "json", "xml", "woff", "woff2",
    )
    emails = []
    for match in email_pattern.findall(html):
        if any(blocked in match for blocked in email_blocklist):
            continue
        tld = match.rsplit(".", 1)[-1].lower()
        if tld in non_email_extensions:
            continue
        if re.search(r"@\d", match):
            continue
        emails.append(match)
    maker_email = emails[0] if emails else None

    # コンタクトフォームURLの抽出
    contact_form = None
    contact_keywords = (
        "contact",
        "support",
        "inquiry",
        "inquire",
        "help",
        "reach",
        "touch",
        "feedback",
        "お問い合わせ",
    )
    for link in _extract_links_from_html(html):
        path = urlparse(link).path.lower()
        if any(kw in path for kw in contact_keywords):
            if not _is_platform_url(link):
                contact_form = link
                break

    return {
        "maker_sns": sns or None,
        "external_website": external_website,
        "maker_email": maker_email,
        "maker_contact_form": contact_form,
    }


def extract_contacts_from_project_page(
    page: Page,
    project_url: str,
    *,
    debug: bool = False,
) -> dict[str, Any]:
    # Kickstarterの場合はJSONエンドポイントを使用
    if "kickstarter.com" in project_url:
        json_url = project_url.rstrip("/") + ".json"
        data = fetch_json_page(page, json_url)
        if data:
            # creatorページにHTMLで直接アクセス
            creator_page_url = project_url.rstrip("/") + "/creator"
            print(f"[contacts]   debug fetching creator page: {creator_page_url}")
            creator_html = fetch_page_html(page, creator_page_url)
            print(f"[contacts]   debug creator_html: {creator_html is not None}")

            combined_html = ""
            if creator_html:
                combined_html = creator_html

            # 元のJSONのHTMLも追加
            content_html = data.get("content", "") or ""
            card_html = data.get("card", "") or ""
            running_board_html = data.get("running_board", "") or ""
            combined_html += content_html + card_html + running_board_html

            result = extract_contacts_from_html(combined_html)
            print(f"[contacts]   debug KS result: {result}")
            return result
        return {}

    # その他のプラットフォーム（既存の処理）
    html = fetch_page_html(page, project_url)
    if not html:
        print(f"[contacts]   debug: fetch_page_html returned None")
        return {}
    print(f"[contacts]   debug: html length = {len(html)}")

    links = _extract_links_from_html(html)
    print(f"[contacts]   debug: {len(links)} links found")
    for link in links[:20]:
        print(f"[contacts]   link: {link}")

    return extract_contacts_from_html(html)


def _find_website_subpage_links(html: str, base_url: str) -> list[str]:
    """Find same-domain links whose href or anchor text match contact-related keywords."""
    soup = BeautifulSoup(html, "html.parser")
    base_domain = _domain(base_url)
    links: list[str] = []
    seen: set[str] = set()

    for anchor in soup.find_all("a", href=True):
        href = str(anchor["href"])
        text = anchor.get_text(strip=True).lower()
        check = f"{href.lower()} {text}"
        if not any(kw in check for kw in WEBSITE_SUBPAGE_KEYWORDS):
            continue
        resolved = _resolve_link(base_url, href)
        if not resolved or resolved in seen:
            continue
        if _domain(resolved) != base_domain:
            continue
        seen.add(resolved)
        links.append(resolved)

    return links


def extract_contacts_from_website(page: Page, website_url: str) -> dict[str, Any]:
    """Fetch maker website and contact-related subpages; extract email and contact form."""
    website_url = website_url.strip()
    if _is_platform_maker_website(website_url):
        print("[contacts]   skip: platform URL, not a maker site")
        return {}

    html = fetch_page_html(page, website_url)
    if not html:
        return {}

    combined_html = html
    base_normalized = website_url.rstrip("/")

    for sub_url in _find_website_subpage_links(html, website_url):
        if sub_url.rstrip("/") == base_normalized:
            continue
        sub_html = fetch_page_html(page, sub_url)
        if sub_html:
            combined_html += sub_html

    extracted = extract_contacts_from_html(combined_html)
    return {
        "maker_email": extracted.get("maker_email"),
        "maker_contact_form": extracted.get("maker_contact_form"),
    }


def fetch_all_projects(
    *, force: bool = False, website_only: bool = False, search_website: bool = False
) -> list[dict[str, Any]]:
    """Load Supabase projects for contact extraction."""
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
        "select": "id,title,original_url,maker_website,maker_sns,maker_email,platform",
        "order": "updated_at.desc",
    }
    if search_website:
        params["maker_website"] = "is.null"
        params["platform"] = "eq.kickstarter"
    elif website_only:
        params["maker_website"] = "not.is.null"
        params["maker_email"] = "is.null"
    elif not force:
        params["maker_sns"] = "is.null"

    resp = requests.get(
        f"{url}/rest/v1/projects",
        headers=headers,
        params=params,
        timeout=120,
    )
    resp.raise_for_status()
    projects = resp.json()
    if search_website:
        return [p for p in projects if (p.get("title") or "").strip()]
    if website_only:
        return [p for p in projects if (p.get("maker_website") or "").strip()]
    return [p for p in projects if (p.get("original_url") or "").strip()]


CANDIDATES_CSV_PATH = os.path.join(os.path.dirname(__file__), "maker_website_candidates.csv")
CANDIDATES_CSV_FIELDS = ["id", "title", "maker_website", "maker_email", "maker_contact_form"]


def _append_candidate_csv(
    project_id: str, title: str, maker_website: str, maker_email: str, maker_contact_form: str
) -> None:
    file_exists = os.path.exists(CANDIDATES_CSV_PATH)
    with open(CANDIDATES_CSV_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CANDIDATES_CSV_FIELDS)
        if not file_exists:
            writer.writeheader()
        writer.writerow(
            {
                "id": project_id,
                "title": title,
                "maker_website": maker_website,
                "maker_email": maker_email,
                "maker_contact_form": maker_contact_form,
            }
        )


def apply_candidates_csv(csv_path: str) -> tuple[int, int]:
    """Apply approved candidate rows from a CSV to Supabase (maker_website/email/contact_form)."""
    with open(csv_path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    applied = 0
    for row in rows:
        project_id = (row.get("id") or "").strip()
        if not project_id:
            continue
        updates: dict[str, Any] = {"updated_at": utc_now_iso()}
        if (row.get("maker_website") or "").strip():
            updates["maker_website"] = row["maker_website"].strip()
        if (row.get("maker_email") or "").strip():
            updates["maker_email"] = row["maker_email"].strip()
        if (row.get("maker_contact_form") or "").strip():
            updates["maker_contact_form"] = row["maker_contact_form"].strip()
        if len(updates) == 1:
            continue
        patch_project(project_id, updates)
        applied += 1
        print(f"[contacts] applied: {row.get('title', '')[:50]}")

    return applied, len(rows)


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
    maker_email = extracted.get("maker_email")
    maker_contact_form = extracted.get("maker_contact_form")
    if not maker_sns and not external_website and not maker_email and not maker_contact_form:
        return None

    updates: dict[str, Any] = {"updated_at": utc_now_iso()}
    if maker_sns:
        updates["maker_sns"] = maker_sns
    if external_website:
        updates["maker_website"] = external_website
    if maker_email:
        updates["maker_email"] = maker_email
    if maker_contact_form:
        updates["maker_contact_form"] = maker_contact_form
    return updates


def _build_website_updates(extracted: dict[str, Any]) -> dict[str, Any] | None:
    maker_email = extracted.get("maker_email")
    maker_contact_form = extracted.get("maker_contact_form")
    maker_website = extracted.get("maker_website")
    if not maker_email and not maker_contact_form and not maker_website:
        return None

    updates: dict[str, Any] = {"updated_at": utc_now_iso()}
    if maker_website:
        updates["maker_website"] = maker_website
    if maker_email:
        updates["maker_email"] = maker_email
    if maker_contact_form:
        updates["maker_contact_form"] = maker_contact_form
    return updates


def extract_contacts(
    *,
    force: bool = False,
    website_only: bool = False,
    search_website: bool = False,
    limit: int = 0,
    headless: bool = True,
) -> tuple[int, int]:
    all_projects = fetch_all_projects(
        force=force, website_only=website_only, search_website=search_website
    )
    if search_website:
        label = "kickstarter projects with maker_website null"
    elif website_only:
        label = "projects with maker_website and no maker_email"
    elif force:
        label = "all projects"
    else:
        label = "projects with maker_sns null"
    print(f"[contacts] loaded {len(all_projects)} {label} from Supabase")

    projects = all_projects
    if limit:
        projects = projects[:limit]

    scan_label = "titles to search" if search_website else ("maker websites" if website_only else "project pages")
    print(f"[contacts] {len(projects)} {scan_label} to scan")
    if not projects:
        return 0, 0

    ok = 0

    with sync_playwright() as playwright:
        browser, page = _create_browser_page(playwright, headless=headless)

        for index, project in enumerate(projects, start=1):
            project_id = project["id"]
            title = project.get("title") or ""

            print(f"[contacts] {index}/{len(projects)}: {title[:60]}...")

            if search_website:
                try:
                    found_website = search_maker_website(title)
                    if not found_website or not _is_valid_external_website(found_website):
                        print("[contacts]   skip: no maker website found via search")
                        continue

                    print(f"[contacts]   found: {found_website}")
                    extracted = extract_contacts_from_website(page, found_website)
                    extracted["maker_website"] = found_website

                    updates = _build_website_updates(extracted)
                    if not updates:
                        print("[contacts]   skip: could not build updates")
                        continue

                    _append_candidate_csv(
                        project_id,
                        title,
                        updates.get("maker_website") or "",
                        updates.get("maker_email") or "",
                        updates.get("maker_contact_form") or "",
                    )
                    ok += 1
                    print(f"[contacts]   candidate recorded (CSV, not yet saved to DB)")
                except Exception as exc:
                    if _is_browser_closed_error(exc):
                        print("[contacts]   browser closed, restarting...", file=sys.stderr)
                        _close_browser_safe(browser)
                        browser, page = _create_browser_page(playwright, headless=headless)
                        continue
                    print(f"[contacts]   failed: {exc}", file=sys.stderr)
                continue

            if website_only:
                website_url = (project.get("maker_website") or "").strip()
                print(f"[contacts]   website: {website_url}")

                if _is_indiegogo_website(website_url):
                    print("[contacts]   skip: Indiegogo bot protection")
                    continue

                try:
                    if _is_kickstarter_profile_url(website_url):
                        real_website, _ = resolve_real_maker_website(page, website_url)
                        if not real_website:
                            print("[contacts]   skip: could not resolve real maker website")
                            continue
                        extracted = extract_contacts_from_website(page, real_website)
                        extracted["maker_website"] = real_website
                    elif _is_platform_maker_website(website_url):
                        print("[contacts]   skip: platform URL, not a maker site")
                        continue
                    else:
                        extracted = extract_contacts_from_website(page, website_url)

                    updates = _build_website_updates(extracted)
                    if not updates:
                        print("[contacts]   skip: no website, email, or contact form found")
                        continue

                    patch_project(project_id, updates)
                    ok += 1
                    parts = []
                    if updates.get("maker_website"):
                        parts.append(f"website={updates['maker_website']}")
                    if updates.get("maker_email"):
                        parts.append(f"email={updates['maker_email']}")
                    if updates.get("maker_contact_form"):
                        parts.append(f"contact_form={updates['maker_contact_form']}")
                    print(f"[contacts]   saved: {', '.join(parts)}")
                except Exception as exc:
                    if _is_browser_closed_error(exc):
                        print("[contacts]   browser closed, restarting...", file=sys.stderr)
                        _close_browser_safe(browser)
                        browser, page = _create_browser_page(playwright, headless=headless)
                        continue
                    print(f"[contacts]   failed: {exc}", file=sys.stderr)
                continue

            try:
                project_url = (project.get("original_url") or "").strip()
                print(f"[contacts]   page: {project_url}")
                extracted = extract_contacts_from_project_page(
                    page,
                    project_url,
                    debug=(index == 1),
                )
                updates = _build_updates(extracted)
                if not updates:
                    print("[contacts]   skip: no SNS, website, email, or contact form found")
                    continue

                patch_project(project_id, updates)
                ok += 1
                parts = []
                if updates.get("maker_sns"):
                    parts.append(f"sns={updates['maker_sns']}")
                if updates.get("maker_website"):
                    parts.append(f"website={updates['maker_website']}")
                if updates.get("maker_email"):
                    parts.append(f"email={updates['maker_email']}")
                if updates.get("maker_contact_form"):
                    parts.append(f"contact_form={updates['maker_contact_form']}")
                print(f"[contacts]   saved: {', '.join(parts)}")
            except Exception as exc:
                print(f"[contacts]   failed: {exc}", file=sys.stderr)

        _close_browser_safe(browser)

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
                if extracted.get("maker_email"):
                    project["maker_email"] = extracted["maker_email"]
                if extracted.get("maker_contact_form"):
                    project["maker_contact_form"] = extracted["maker_contact_form"]
                if (
                    extracted.get("maker_sns")
                    or extracted.get("external_website")
                    or extracted.get("maker_email")
                    or extracted.get("maker_contact_form")
                ):
                    enriched += 1
                else:
                    print("[contacts]   skip: no contacts found")
            except Exception as exc:
                print(f"[contacts]   failed: {exc}", file=sys.stderr)

        browser.close()

    return enriched


def test_ks_profile(profile_url: str, *, headless: bool = True) -> int:
    """Test Kickstarter profile → external website resolution for a single URL."""
    profile_url = profile_url.strip()
    if not profile_url:
        print("[contacts] ERROR: --test-ks requires a profile URL", file=sys.stderr)
        return 1
    if not _is_kickstarter_profile_url(profile_url):
        print(
            "[contacts] ERROR: URL must contain kickstarter.com/profile/",
            file=sys.stderr,
        )
        return 1

    print(f"[contacts] test-ks: {profile_url}")
    real: str | None = None

    with sync_playwright() as playwright:
        browser, page = _create_browser_page(playwright, headless=headless)
        try:
            real, attempted = resolve_real_maker_website(page, profile_url)
            print(f"[contacts] test-ks attempted_resolution={attempted}")
            print(f"[contacts] test-ks result: {real}")
        except Exception as exc:
            print(f"[contacts] test-ks failed: {exc}", file=sys.stderr)
            return 1
        finally:
            _close_browser_safe(browser)

    return 0 if real else 1


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
    parser.add_argument(
        "--website-only",
        action="store_true",
        help="Scan maker_website for email/contact form (skip crowdfunding pages)",
    )
    parser.add_argument(
        "--search-website",
        action="store_true",
        help="Search (via SerpAPI) for maker_website on kickstarter projects with maker_website null",
    )
    parser.add_argument(
        "--test-ks",
        metavar="PROFILE_URL",
        help="Test KS profile external link resolution for a single profile URL",
    )
    parser.add_argument(
        "--apply-csv",
        metavar="CSV_PATH",
        help="Apply reviewed candidate rows from CSV (see --search-website) to Supabase",
    )
    args = parser.parse_args()

    if args.apply_csv:
        applied, total = apply_candidates_csv(args.apply_csv)
        print(f"[contacts] OK: applied {applied}/{total} rows from {args.apply_csv}")
        return 0

    if args.test_ks:
        return test_ks_profile(args.test_ks, headless=not args.headed)

    try:
        ok, total = extract_contacts(
            force=args.force,
            website_only=args.website_only,
            search_website=args.search_website,
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
