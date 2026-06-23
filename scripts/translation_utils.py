"""Detect whether project fields need real Japanese translation."""

from __future__ import annotations

import re

_JA_RE = re.compile(r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9faf]")


def has_japanese_text(text: str) -> bool:
    return bool(_JA_RE.search(text or ""))


def _is_blank(value: str | None) -> bool:
    return not value or not str(value).strip()


def _same_as_source(ja: str | None, source: str | None) -> bool:
    if _is_blank(ja) or _is_blank(source):
        return False
    return ja.strip() == source.strip()


def title_needs_translation(title: str, title_ja: str | None) -> bool:
    title = (title or "").strip()
    title_ja = (title_ja or "").strip()
    if _is_blank(title_ja):
        return True
    if _same_as_source(title_ja, title):
        return True
    if re.search(r"[a-zA-Z]", title) and not has_japanese_text(title_ja):
        return True
    return False


def subtitle_needs_translation(subtitle: str | None, subtitle_ja: str | None) -> bool:
    subtitle = (subtitle or "").strip()
    if not subtitle:
        return False
    subtitle_ja = (subtitle_ja or "").strip()
    if _is_blank(subtitle_ja):
        return True
    if _same_as_source(subtitle_ja, subtitle):
        return True
    if re.search(r"[a-zA-Z]", subtitle) and not has_japanese_text(subtitle_ja):
        return True
    return False


def needs_japanese_translation(project: dict) -> bool:
    return title_needs_translation(
        project.get("title") or "",
        project.get("title_ja"),
    ) or subtitle_needs_translation(
        project.get("subtitle"),
        project.get("subtitle_ja"),
    )
