#!/usr/bin/env python3
"""
Kickstarter successful projects crawler.

Uses the public discover JSON endpoint via Playwright:
  /discover/advanced.json?category_id=N&sort=magic&page=N

Categories crawled (sort=magic):
  - Technology (16) — ガジェット / ヘルスケア / モビリティ
  - Design (7) — アウトドア / ライフスタイル
  - Fashion (11)
  - Food (10) — キッチン

Games (category_id=12) is never crawled.

Filters:
  - raised >= $50,000 USD
  - successful (ended within 180 days) or live with strong funding
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from typing import Any, Callable
from urllib.parse import urlencode

from playwright.sync_api import sync_playwright

from category_filters import KICKSTARTER_DEMO_SLUGS, is_allowed_category, parse_category_slugs, resolve_kickstarter_categories
from extract_contacts import enrich_kickstarter_projects
from common import (
    MAX_DAYS_SINCE_END,
    MIN_RAISED_USD,
    compute_campaign_metrics,
    create_browser,
    fetch_json_page,
    normalize_project,
    replace_supabase_projects,
    save_json,
    hydrate_existing_translations,
    save_to_supabase,
    utc_now_iso,
)

DISCOVER_BASE = "https://www.kickstarter.com/discover/advanced.json"
BLOCKED_CATEGORY_IDS = {12}  # Games — never crawl
DEFAULT_CATEGORIES = KICKSTARTER_DEMO_SLUGS
MIN_RAISED_USD_NEWEST = 1_000  # relaxed filter for newest sort


def build_discover_url(
    page_num: int,
    category_id: int | None = None,
    sort: str = "magic",
    archive_mode: bool = False,
) -> str:
    """Build discover JSON URL matching Kickstarter advanced discover."""
    if category_id in BLOCKED_CATEGORY_IDS:
        raise ValueError(f"category_id={category_id} is blocked (Games)")

    now = datetime.now(timezone.utc)
    params: dict[str, Any] = {
        "sort": sort,
        "page": page_num,
    }
    if category_id:
        params["category_id"] = category_id
    if archive_mode:
        # Filter to projects whose deadline fell 180-730 days ago
        deadline_lte = int((now - timedelta(days=180)).timestamp())
        deadline_gte = int((now - timedelta(days=730)).timestamp())
        params["deadline[gte]"] = deadline_gte
        params["deadline[lte]"] = deadline_lte
    return f"{DISCOVER_BASE}?{urlencode(params)}"


def within_days_since_end(deadline_ts: int, max_days: int) -> bool:
    if not deadline_ts:
        return True
    deadline = datetime.fromtimestamp(deadline_ts, tz=timezone.utc)
    delta = datetime.now(timezone.utc) - deadline
    return 0 <= delta.days <= max_days


def map_kickstarter_project(item: dict[str, Any], min_raised: int = MIN_RAISED_USD, newest_mode: bool = False, archive_mode: bool = False) -> dict[str, Any] | None:
    pledged = int(float(item.get("usd_pledged") or item.get("pledged") or 0))
    goal = int(float(item.get("goal") or 0))
    state = str(item.get("state") or "")

    if pledged < min_raised:
        return None

    if state == "successful":
        if newest_mode:
            return None  # newest sort targets live campaigns only
        # Note: goal is in local currency; pledged is USD — do not compare them.
        # state=successful already guarantees the campaign met its goal.
        days_since_end = int(item.get("deadline") or 0)
        if archive_mode:
            # archive mode: 180〜730日前に終了したお宝候補
            if within_days_since_end(days_since_end, MAX_DAYS_SINCE_END):
                return None  # 通常クロールの範囲は除外
            if not within_days_since_end(days_since_end, 730):
                return None  # 730日以上前は除外
            status = "archived"
        else:
            if not within_days_since_end(days_since_end, MAX_DAYS_SINCE_END):
                return None
            status = "ended"
    elif state == "live":
        if archive_mode:
            return None  # archiveモードはライブ不要
        status = "active"
    else:
        return None

    category = item.get("category") or {}
    parent = category.get("parent_name") or ""
    child = category.get("name") or ""
    category_name = f"{parent}/{child}".strip("/") if parent else child

    # Block Games / Comics / Publishing even if they appear in discover results
    parent_lower = parent.lower()
    if parent_lower in {"games", "comics", "publishing"}:
        return None
    cat_lower = category_name.lower()
    if any(k in cat_lower for k in ("games/", "comics/", "publishing/", "tabletop game")):
        return None

    urls = item.get("urls") or {}
    web = urls.get("web") or {}
    photo = item.get("photo") or {}

    deadline_ts = int(item.get("deadline") or 0) or None
    launched_ts = int(item.get("launched_at") or item.get("created_at") or 0) or None
    backers = int(item.get("backers_count") or 0)
    metrics = compute_campaign_metrics(
        status=status,
        backers=backers,
        deadline_ts=deadline_ts,
        launched_ts=launched_ts,
    )

    return normalize_project(
        {
            "title": item.get("name") or "",
            "subtitle": item.get("blurb") or "",
            "platform": "kickstarter",
            "original_url": web.get("project") or f"https://www.kickstarter.com/projects/{item.get('slug')}",
            "image_url": photo.get("1024x576") or photo.get("full") or photo.get("med"),
            "raised_usd": pledged,
            "goal_usd": goal,
            "backers": backers,
            "category": category_name or "Other",
            "country": item.get("country_displayable_name") or item.get("country"),
            "status": status,
            **metrics,
            "created_at": utc_now_iso(),
        }
    )


def crawl_kickstarter(
    max_pages: int = 5,
    category_slugs: list[str] | None = None,
    max_projects: int | None = None,
    min_projects: int | None = None,
    sort: str = "magic",
    archive_mode: bool = False,
    on_category_done: Callable[[list[dict[str, Any]]], None] | None = None,
) -> list[dict[str, Any]]:
    """
    on_category_done を渡すと、カテゴリを1つ取り終えるたびにその分を渡す。
    全件を集め終えてから保存する作りだと、GitHub Actions の制限時間で
    打ち切られた瞬間にそれまでの成果がすべて消える。実際に 2026-08-21〜09-09 の
    20日間、人気順とアーカイブのジョブが毎日90分で打ち切られ、保存ゼロだった。
    カテゴリ単位で保存すれば、打ち切られても失うのは処理中の1カテゴリ分で済む。
    """
    if archive_mode and sort == "magic":
        sort = "most_funded"
        print("[kickstarter] archive mode: switching to sort=most_funded (歴代最高額順)")
    newest_mode = sort == "newest"
    min_raised = MIN_RAISED_USD_NEWEST if newest_mode else MIN_RAISED_USD
    projects: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    categories = resolve_kickstarter_categories(category_slugs)
    pages_per_category = max(1, max_pages)
    limit = max_projects if max_projects and max_projects > 0 else None

    print(f"[kickstarter] sort={sort}, min_raised=${min_raised:,}, newest_mode={newest_mode}")

    with sync_playwright() as playwright:
        browser, context = create_browser(playwright)
        page = context.new_page()

        for category_id, category_label in categories:
            if category_id in BLOCKED_CATEGORY_IDS:
                print(f"[kickstarter] skip blocked category: {category_label} (id={category_id})")
                continue
            if limit and len(projects) >= limit:
                break
            print(f"[kickstarter] category: {category_label} (id={category_id})")
            category_start = len(projects)
            for page_num in range(1, pages_per_category + 1):
                if limit and len(projects) >= limit:
                    break
                url = build_discover_url(page_num, category_id, sort=sort, archive_mode=archive_mode)
                print(f"[kickstarter] fetching page {page_num}: {url}")
                data = fetch_json_page(page, url)
                if not data:
                    print(f"[kickstarter] no data on page {page_num}, stopping category")
                    break

                batch = data.get("projects") or []
                if not batch:
                    print(f"[kickstarter] empty page {page_num}, stopping category")
                    break

                added = 0
                skipped_category = 0
                for item in batch:
                    if limit and len(projects) >= limit:
                        break
                    mapped = map_kickstarter_project(item, min_raised=min_raised, newest_mode=newest_mode, archive_mode=archive_mode)
                    if not mapped:
                        continue
                    if not is_allowed_category(mapped["category"]):
                        skipped_category += 1
                        continue
                    key = mapped["original_url"]
                    if key in seen_urls:
                        continue
                    seen_urls.add(key)
                    projects.append(mapped)
                    added += 1

                print(
                    f"[kickstarter] page {page_num}: {added} matched, "
                    f"{skipped_category} excluded by category"
                )

            if on_category_done and len(projects) > category_start:
                on_category_done(projects[category_start:])

        browser.close()

    # Extra pages on Technology if below minimum target (magic sort only)
    if not newest_mode and min_projects and len(projects) < min_projects:
        tech_cats = [(cid, label) for cid, label in categories if cid == 16]
        if tech_cats:
            extra_start = pages_per_category + 1
            extra_end = pages_per_category + 15
            print(
                f"[kickstarter] {len(projects)} < min {min_projects}, "
                f"fetching Technology pages {extra_start}-{extra_end}..."
            )
            extra_from = len(projects)
            with sync_playwright() as playwright:
                browser, context = create_browser(playwright)
                page = context.new_page()
                for category_id, category_label in tech_cats:
                    for page_num in range(extra_start, extra_end + 1):
                        if len(projects) >= min_projects:
                            break
                        url = build_discover_url(page_num, category_id, sort=sort)
                        data = fetch_json_page(page, url)
                        if not data:
                            break
                        for item in data.get("projects") or []:
                            if len(projects) >= min_projects:
                                break
                            mapped = map_kickstarter_project(item, min_raised=min_raised)
                            if not mapped or not is_allowed_category(mapped["category"]):
                                continue
                            key = mapped["original_url"]
                            if key in seen_urls:
                                continue
                            seen_urls.add(key)
                            projects.append(mapped)
                browser.close()
            if on_category_done and len(projects) > extra_from:
                on_category_done(projects[extra_from:])

    projects.sort(key=lambda p: (
        0 if p.get("status") == "active" else 1,
        -float(p.get("backers_per_day") or 0)
        * (1 + 30 / max(1, p.get("days_remaining") or 999))
        if p.get("status") == "active"
        else -float(p.get("backers_per_day") or 0),
        -p.get("raised_usd", 0),
    ))
    if limit:
        projects = projects[:limit]

    # 連絡先取得はここでは行わない。
    # 1件ずつ個別ページを開く重い処理なので、Supabaseへの保存を終えてから
    # main() 側で実行する（途中で打ち切られても収集結果を失わないため）。
    return projects


# 1回の実行で新たに翻訳する上限。Anthropicクレジットの使い過ぎを防ぐ。
# 実績では新着ジョブ424件中、既存訳の再利用が403件で、新規翻訳は約21件だった。
# ただし長く止まっていたジョブ（アーカイブ等）が再開すると一度に大量に来るため、
# 上限を設けて調達額の大きいものから訳し、残りは次回以降に回す。
DEFAULT_TRANSLATE_LIMIT = 60


def translate_within_budget(
    batch: list[dict[str, Any]], args: argparse.Namespace, stats: dict[str, int]
) -> None:
    from translation_utils import needs_japanese_translation
    from translator import translate_projects

    pending = [p for p in batch if args.force_translate or needs_japanese_translation(p)]
    if not pending:
        return

    remaining = max(0, args.translate_limit - stats["translated"])
    # 調達額の大きい順に訳す（オファー対象になりやすいものを優先する）
    pending.sort(key=lambda p: -float(p.get("raised_usd") or 0))
    selected, deferred = pending[:remaining], pending[remaining:]

    if deferred:
        stats["deferred"] += len(deferred)
        print(
            f"[kickstarter] 翻訳上限 {args.translate_limit}件に達するため "
            f"{len(deferred)}件の翻訳を次回に回します"
        )
    if selected:
        print(f"[kickstarter] translating {len(selected)} projects...")
        translate_projects(selected, force=args.force_translate)
        stats["translated"] += len(selected)


def main() -> int:
    parser = argparse.ArgumentParser(description="Crawl successful Kickstarter projects")
    parser.add_argument(
        "--pages",
        type=int,
        default=40,
        help="Discover pages per Kickstarter parent category",
    )
    parser.add_argument(
        "--max",
        type=int,
        default=None,
        help="Maximum number of projects to collect (e.g. 10)",
    )
    parser.add_argument(
        "--min",
        type=int,
        default=50,
        help="Minimum projects to collect (extra Technology pages if needed)",
    )
    parser.add_argument(
        "--sort",
        type=str,
        default="magic",
        choices=["magic", "newest"],
        help="Kickstarter discover sort order: magic (popular) or newest",
    )
    parser.add_argument("--no-save", action="store_true", help="Skip writing output files")
    parser.add_argument(
        "--categories",
        type=str,
        default=DEFAULT_CATEGORIES,
        help="Comma-separated slugs (default: tech+design+fashion+health+outdoor+kitchen+mobility)",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Replace all Supabase rows with crawl results",
    )
    parser.add_argument("--no-supabase", action="store_true", help="Skip Supabase upsert")
    parser.add_argument(
        "--no-translate",
        action="store_true",
        help="Skip Claude API translation (run_crawl translates after merge)",
    )
    parser.add_argument(
        "--force-translate",
        action="store_true",
        help="Re-translate even when title_ja / subtitle_ja already exist",
    )
    parser.add_argument(
        "--no-contacts",
        action="store_true",
        help="Skip visiting project pages to extract maker website / SNS",
    )
    parser.add_argument(
        "--archive",
        action="store_true",
        help="Archive mode: collect projects ended 180-730 days ago (お宝発掘)",
    )
    parser.add_argument(
        "--translate-limit",
        type=int,
        default=DEFAULT_TRANSLATE_LIMIT,
        help="1回の実行で新たに翻訳する上限件数（調達額の大きい順）。0で翻訳しない",
    )
    args = parser.parse_args()

    slugs = parse_category_slugs(args.categories or None)

    # カテゴリごとに保存する（--replace は全件入れ替えなので従来どおり最後にまとめて行う）
    incremental = not args.no_save and not args.no_supabase and not args.replace
    stats = {"saved": 0, "translated": 0, "deferred": 0}

    def persist(batch: list[dict[str, Any]]) -> None:
        if not args.no_translate:
            # 既にDBにある訳を先に埋めて、二度目の翻訳を防ぐ
            hydrate_existing_translations(batch)
            translate_within_budget(batch, args, stats)
        saved = save_to_supabase(batch)
        stats["saved"] += saved or 0
        print(f"[kickstarter] category saved: {saved} rows (累計 {stats['saved']})")

    projects = crawl_kickstarter(
        max_pages=args.pages,
        category_slugs=slugs,
        max_projects=args.max,
        min_projects=args.min,
        sort=args.sort,
        archive_mode=args.archive,
        on_category_done=persist if incremental else None,
    )
    print(f"[kickstarter] total matched: {len(projects)}")
    if args.min and len(projects) < args.min:
        print(f"[kickstarter] WARN: collected {len(projects)} < min {args.min}", file=sys.stderr)

    if not projects:
        print("[kickstarter] no projects found")
        return 0 if args.archive else 1

    if incremental:
        path = save_json(projects, "kickstarter_projects.json")
        print(f"[kickstarter] saved to {path}")
        print(
            f"[kickstarter] Supabase: {stats['saved']} rows upserted / "
            f"翻訳 {stats['translated']}件 / 上限超過で翻訳を見送り {stats['deferred']}件"
        )
    elif not args.no_save:
        if not args.no_translate:
            # 既にDBにある訳を先に埋めて、二度目の翻訳を防ぐ
            hydrate_existing_translations(projects)
            translate_within_budget(projects, args, stats)

        path = save_json(projects, "kickstarter_projects.json")
        print(f"[kickstarter] saved to {path}")
        if not args.no_supabase:
            if args.replace:
                saved = replace_supabase_projects(projects)
            else:
                saved = save_to_supabase(projects)
            if saved:
                mode = "replaced" if args.replace else "upserted"
                print(f"[kickstarter] {saved} rows {mode} to Supabase")

    # 保存が終わってから連絡先を取得する。
    # 取得は重く、GitHub Actionsの上限で打ち切られることがあるが、
    # ここまで来ていれば案件データ自体は既にSupabaseに入っている。
    if not args.no_contacts and projects:
        print(f"[kickstarter] extracting contacts from {len(projects)} project pages...")
        enriched = enrich_kickstarter_projects(projects)
        print(f"[kickstarter] contacts found on {enriched}/{len(projects)} projects")

    print(json.dumps({"count": len(projects), "top": projects[:3]}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
