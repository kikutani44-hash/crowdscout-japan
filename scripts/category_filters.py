"""
Category filters for CrowdScout crawlers.

Priority (JP):
  テクノロジー・ガジェット / ヘルスケア・フィットネス / アウトドア・スポーツ
  キッチン・家電 / モビリティ・乗り物 / ライフスタイル・デザイン

Excluded: Games, Publishing, Art, Comics, Film & Video, Music, Theater, etc.
"""

from __future__ import annotations

# Kickstarter discover `category_id` (parent categories to crawl)
# HTML: /discover/advanced?category_id=N&sort=magic&page=1
KICKSTARTER_CATEGORY_IDS: list[tuple[int, str]] = [
    (16, "Technology"),
    (7, "Design"),
    (11, "Fashion"),
]

# Never crawl these Kickstarter parent category IDs
BLOCKED_KICKSTARTER_CATEGORY_IDS = {12}  # Games

# Kickstarter-only crawl slugs (Technology / Design / Fashion)
KICKSTARTER_DEMO_SLUGS = "technology,design,fashion"

EXCLUDED_PARENTS = {
    "Games",
    "Publishing",
    "Art",
    "Comics",
    "Film & Video",
    "Music",
    "Theater",
    "Dance",
    "Photography",
    "Journalism",
    "Fiction",
    "Nonfiction",
    "Podcasts",
    "Translations",
}

EXCLUDED_KEYWORDS = (
    "game",
    "games/",
    "tabletop",
    "comic",
    "comics/",
    "manga",
    "novel",
    "fiction",
    "nonfiction",
    "publishing/",
    "film",
    "documentary",
    "music",
    "theater",
    "theatre",
    "dance",
    "photography",
    "journalism",
    "publishing",
    "podcast",
    "illustration",
    "board game",
    "trading card",
    "d&d",
    "roleplaying",
)

ALLOWED_PARENTS = {
    "Technology",
    "Design",
    "Food",
    "Fashion",
    "Crafts",
    "Health",
    "Sports",
    "Sport",
    "Home",
    "Travel",
    "Transportation",
    "Environment",
}

ALLOWED_KEYWORDS = (
    "gadget",
    "hardware",
    "software",
    "3d printing",
    "robot",
    "wearable",
    "phone",
    "accessories",
    "health",
    "fitness",
    "medical",
    "wellness",
    "sport",
    "outdoor",
    "camping",
    "hike",
    "kitchen",
    "cook",
    "appliance",
    "home",
    "mobility",
    "transport",
    "vehicle",
    "bike",
    "ebike",
    "scooter",
    "product design",
    "lifestyle",
    "furniture",
    "eco",
    "solar",
    "drone",
    "camera equipment",
    "maker",
    "craft",
    "crafts",
    "knit",
    "sewing",
    "embroidery",
    "woodworking",
)

INDIEGOGO_EXPLORE_URLS = [
    "https://www.indiegogo.com/explore/tech-and-innovation",
    "https://www.indiegogo.com/explore/health-and-fitness",
    "https://www.indiegogo.com/explore/home",
    "https://www.indiegogo.com/explore/product-design",
]

# 6 priority groups for demo crawl (CLI slugs)
DEMO_CATEGORY_SLUGS = (
    "technology,gadget,health,healthcare,fitness,"
    "outdoor,sport,sports,food,kitchen,"
    "mobility,transport,design,lifestyle,fashion"
)

# CLI slug -> Kickstarter discover category_id (parent)
KICKSTARTER_SLUGS: dict[str, tuple[int, str]] = {
    "technology": (16, "Technology"),
    "tech": (16, "Technology"),
    "hardware": (16, "Technology"),
    "gadget": (16, "Technology"),
    "gadgets": (16, "Technology"),
    "design": (7, "Design"),
    "food": (10, "Food"),
    "kitchen": (10, "Food"),
    "fashion": (11, "Fashion"),
    "crafts": (26, "Crafts"),
    "craft": (26, "Crafts"),
    "health": (16, "Technology"),
    "healthcare": (16, "Technology"),
    "fitness": (16, "Technology"),
    "outdoor": (7, "Design"),
    "sport": (7, "Design"),
    "sports": (7, "Design"),
    "mobility": (16, "Technology"),
    "transport": (16, "Technology"),
    "lifestyle": (7, "Design"),
}

# CLI slug -> Indiegogo explore path suffix
INDIEGOGO_SLUG_PATHS: dict[str, str] = {
    "technology": "tech-and-innovation",
    "tech": "tech-and-innovation",
    "hardware": "tech-and-innovation",
    "gadget": "tech-and-innovation",
    "gadgets": "tech-and-innovation",
    "design": "product-design",
    "lifestyle": "product-design",
    "fashion": "product-design",
    "food": "home",
    "kitchen": "home",
    "health": "health-and-fitness",
    "healthcare": "health-and-fitness",
    "fitness": "health-and-fitness",
    "outdoor": "home",
    "sport": "health-and-fitness",
    "sports": "health-and-fitness",
    "mobility": "tech-and-innovation",
    "transport": "tech-and-innovation",
}


def parse_category_slugs(categories_csv: str | None) -> list[str] | None:
    if not categories_csv:
        return None
    slugs = [s.strip().lower() for s in categories_csv.split(",") if s.strip()]
    return slugs or None


def resolve_kickstarter_categories(slugs: list[str] | None) -> list[tuple[int, str]]:
    if not slugs:
        return list(KICKSTARTER_CATEGORY_IDS)
    seen_ids: set[int] = set()
    result: list[tuple[int, str]] = []
    for slug in slugs:
        entry = KICKSTARTER_SLUGS.get(slug)
        if not entry:
            print(f"[category] unknown slug '{slug}', skipping")
            continue
        cat_id, label = entry
        if cat_id in BLOCKED_KICKSTARTER_CATEGORY_IDS:
            print(f"[category] blocked Games category_id={cat_id}, skipping")
            continue
        if cat_id in seen_ids:
            continue
        seen_ids.add(cat_id)
        result.append((cat_id, label))
    return result or list(KICKSTARTER_CATEGORY_IDS)


def resolve_indiegogo_explore_urls(slugs: list[str] | None) -> list[str]:
    if not slugs:
        return list(INDIEGOGO_EXPLORE_URLS)
    seen: set[str] = set()
    urls: list[str] = []
    for slug in slugs:
        path = INDIEGOGO_SLUG_PATHS.get(slug)
        if not path:
            print(f"[category] unknown slug '{slug}' for Indiegogo, skipping")
            continue
        url = f"https://www.indiegogo.com/explore/{path}"
        if url in seen:
            continue
        seen.add(url)
        urls.append(url)
    return urls or list(INDIEGOGO_EXPLORE_URLS)


def is_allowed_category(category: str) -> bool:
    """Return True if category matches priority groups and is not excluded."""
    if not category or not category.strip():
        return False

    cat = category.strip()
    parent = cat.split("/")[0].strip()
    lower = cat.lower()

    if parent in EXCLUDED_PARENTS:
        return False

    if any(keyword in lower for keyword in EXCLUDED_KEYWORDS):
        return False

    if parent in ALLOWED_PARENTS:
        return True

    if any(keyword in lower for keyword in ALLOWED_KEYWORDS):
        return True

    return False


def category_group_ja(category: str) -> str | None:
    """Map a platform category string to a Japanese priority group label."""
    lower = category.lower()
    if any(k in lower for k in ("technology", "gadget", "hardware", "software", "3d printing", "robot", "phone")):
        return "テクノロジー・ガジェット"
    if any(k in lower for k in ("health", "fitness", "medical", "wellness")):
        return "ヘルスケア・フィットネス"
    if any(k in lower for k in ("outdoor", "sport", "camping", "hike", "travel")):
        return "アウトドア・スポーツ"
    if any(k in lower for k in ("kitchen", "food", "cook", "appliance", "home")):
        return "キッチン・家電"
    if any(k in lower for k in ("mobility", "transport", "vehicle", "bike", "ebike", "scooter", "flight")):
        return "モビリティ・乗り物"
    if any(k in lower for k in ("design", "lifestyle", "fashion", "wearable", "furniture", "product")):
        return "ライフスタイル・デザイン"
    return None
