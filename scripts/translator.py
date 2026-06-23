"""Claude API translation for crawl scripts."""

from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from typing import Any

# Reuse .env.local loading from common (NEXT_PUBLIC_*, SUPABASE_*, ANTHROPIC_*)
import common  # noqa: F401 — loads ENV_PATH via side effect
from common import ENV_PATH

MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
TRANSLATE_DELAY_SEC = float(os.environ.get("CRAWL_TRANSLATE_DELAY_SEC", "0.5"))


def _parse_translation_json(text: str) -> dict[str, str]:
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise ValueError("翻訳結果のJSONが見つかりません")
    data = json.loads(match.group(0))
    title_ja = str(data.get("title_ja") or "").strip()
    subtitle_ja = str(data.get("subtitle_ja") or "").strip()
    if not title_ja:
        raise ValueError("title_ja が空です")
    return {"title_ja": title_ja, "subtitle_ja": subtitle_ja}


def translate_to_japanese(title: str, subtitle: str = "") -> dict[str, str]:
    """Translate product title and subtitle to Japanese via Claude API."""
    title = (title or "").strip()
    subtitle = (subtitle or "").strip()
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()

    if not api_key:
        print("[translate] ANTHROPIC_API_KEY 未設定 — デモ翻訳を使用")
        return {
            "title_ja": f"【翻訳デモ】{title}",
            "subtitle_ja": f"【翻訳デモ】{(subtitle or title)[:120]}",
        }

    try:
        import anthropic
    except ImportError:
        print("[translate] anthropic 未インストール — pip install anthropic")
        return {"title_ja": title, "subtitle_ja": subtitle}

    client = anthropic.Anthropic(api_key=api_key)
    prompt = f"""以下のクラウドファンディング商品情報を自然な日本語に翻訳してください。
商品名はマーケティング向けに読みやすく、説明文は要点を保って翻訳してください。
JSON形式のみで返してください。

{{"title_ja": "...", "subtitle_ja": "..."}}

title: {title}
subtitle: {subtitle}"""

    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    text = ""
    for block in message.content:
        if block.type == "text":
            text += block.text

    return _parse_translation_json(text)


def translate_projects(
    projects: list[dict[str, Any]],
    *,
    skip_existing: bool = True,
    force: bool = False,
) -> list[dict[str, Any]]:
    """Translate all projects in place; returns the same list."""
    total = len(projects)
    for index, project in enumerate(projects, start=1):
        if (
            skip_existing
            and not force
            and project.get("title_ja")
            and project.get("subtitle_ja")
        ):
            continue

        title = project.get("title") or ""
        subtitle = project.get("subtitle") or ""
        print(f"[translate] {index}/{total}: {title[:60]}...")
        try:
            result = translate_to_japanese(title, subtitle)
            project["title_ja"] = result["title_ja"]
            project["subtitle_ja"] = result.get("subtitle_ja") or subtitle
        except Exception as exc:
            print(f"[translate] failed: {exc}")
            if not project.get("title_ja"):
                project["title_ja"] = title
            if not project.get("subtitle_ja"):
                project["subtitle_ja"] = subtitle

        if index < total and TRANSLATE_DELAY_SEC > 0:
            time.sleep(TRANSLATE_DELAY_SEC)

    return projects
