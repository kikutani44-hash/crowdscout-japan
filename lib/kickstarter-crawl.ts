import { createServerSupabase } from "@/lib/supabase";

const DISCOVER_BASE = "https://www.kickstarter.com/discover/advanced.json";
const MIN_RAISED_USD = 50000;
const MAX_DAYS_SINCE_END = 180;

const CATEGORY_IDS = [16, 7, 11, 10];

function withinDaysSinceEnd(deadlineTs: number, maxDays: number): boolean {
  if (!deadlineTs) return true;
  const deadline = new Date(deadlineTs * 1000);
  const delta = (Date.now() - deadline.getTime()) / (1000 * 60 * 60 * 24);
  return delta >= 0 && delta <= maxDays;
}

function tsToIso(ts: number | null): string | null {
  if (!ts) return null;
  return new Date(ts * 1000).toISOString();
}

function computeMetrics(
  status: string,
  backers: number,
  deadlineTs: number | null,
  launchedTs: number | null
) {
  const now = Date.now();
  const deadline = deadlineTs ? new Date(deadlineTs * 1000).getTime() : null;
  const launched = launchedTs ? new Date(launchedTs * 1000).getTime() : null;

  let daysRemaining: number | null = null;
  if (status === "active" && deadline) {
    daysRemaining = Math.max(0, Math.floor((deadline - now) / 86400000));
  }

  let daysElapsed = 1;
  if (launched && deadline && status === "ended") {
    daysElapsed = Math.max(1, Math.floor((deadline - launched) / 86400000));
  } else if (launched) {
    daysElapsed = Math.max(1, Math.floor((now - launched) / 86400000));
  }

  return {
    deadline_at: tsToIso(deadlineTs),
    launched_at: tsToIso(launchedTs),
    days_remaining: daysRemaining,
    backers_per_day: Math.round((backers / daysElapsed) * 100) / 100,
  };
}

function mapProject(item: Record<string, unknown>, minRaised: number = MIN_RAISED_USD) {
  const pledged = parseInt(String(item.usd_pledged ?? item.pledged ?? 0));
  const goal = parseInt(String(item.goal ?? 0));
  const state = String(item.state ?? "");

  if (pledged < minRaised) return null;

  let status: string;
  if (state === "successful") {
    if (!withinDaysSinceEnd(parseInt(String(item.deadline ?? 0)), MAX_DAYS_SINCE_END)) return null;
    status = "ended";
  } else if (state === "live") {
    status = "active";
  } else {
    return null;
  }

  const category = (item.category as Record<string, string>) ?? {};
  const parent = category.parent_name ?? "";
  const child = category.name ?? "";
  const categoryName = parent ? `${parent}/${child}` : child;

  if (["games", "comics", "publishing"].includes(parent.toLowerCase())) return null;

  const urls = (item.urls as Record<string, Record<string, string>>) ?? {};
  const web = urls.web ?? {};
  const photo = (item.photo as Record<string, string>) ?? {};

  const deadlineTs = parseInt(String(item.deadline ?? 0)) || null;
  const launchedTs = parseInt(String(item.launched_at ?? item.created_at ?? 0)) || null;
  const backers = parseInt(String(item.backers_count ?? 0));
  const metrics = computeMetrics(status, backers, deadlineTs, launchedTs);

  const raised = pledged;
  const rate = goal > 0 ? (raised / goal) * 100 : 0;
  let score = 0;
  if (raised >= 500000) score += 30;
  else if (raised >= 100000) score += 20;
  else if (raised >= 50000) score += 10;
  if (rate >= 500) score += 25;
  else if (rate >= 200) score += 20;
  else if (rate >= 100) score += 10;
  if (backers >= 10000) score += 20;
  else if (backers >= 5000) score += 15;
  else if (backers >= 1000) score += 8;
  if (status === "active") score += 8;
  score = Math.min(score, 100);

  return {
    title: String(item.name ?? ""),
    subtitle: String(item.blurb ?? ""),
    platform: "kickstarter",
    original_url: web.project ?? `https://www.kickstarter.com/projects/${item.slug}`,
    image_url: photo["1024x576"] ?? photo.full ?? photo.med ?? null,
    raised_usd: pledged,
    goal_usd: goal,
    backers,
    category: categoryName || "Other",
    country: String(item.country_displayable_name ?? item.country ?? ""),
    status,
    ...metrics,
    score,
    offer_status: "未接触",
    japan_cf_checked: false,
    japan_cf_result: null,
    pse_ok: false,
    giteki_ok: false,
    maker_email: null,
    maker_website: null,
    maker_sns: null,
    updated_at: new Date().toISOString(),
  };
}

async function fetchCategoryPages(
  categoryId: number,
  sort: "magic" | "newest",
  maxPages: number,
  seenUrls: Set<string>,
  minRaised: number = MIN_RAISED_USD,
): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${DISCOVER_BASE}?sort=${sort}&page=${page}&category_id=${categoryId}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "application/json",
      },
    });
    if (!res.ok) break;
    const data = await res.json();
    const batch: Record<string, unknown>[] = data.projects ?? [];
    if (!batch.length) break;

    for (const item of batch) {
      const mapped = mapProject(item, minRaised);
      if (!mapped || seenUrls.has(mapped.original_url)) continue;
      // newest: live only
      if (sort === "newest" && mapped.status !== "active") continue;
      seenUrls.add(mapped.original_url);
      results.push(mapped);
    }
  }
  return results;
}

export async function runKickstarterCrawl(): Promise<number> {
  const supabase = createServerSupabase();
  const projects: Record<string, unknown>[] = [];
  const seenUrls = new Set<string>();

  // popular (magic) — 20 pages per category
  for (const categoryId of CATEGORY_IDS) {
    const batch = await fetchCategoryPages(categoryId, "magic", 20, seenUrls);
    projects.push(...batch);
  }

  // newest — 10 pages per category, relaxed $1,000 minimum
  for (const categoryId of CATEGORY_IDS) {
    const batch = await fetchCategoryPages(categoryId, "newest", 10, seenUrls, 1_000);
    projects.push(...batch);
  }

  if (projects.length === 0) {
    throw new Error("No projects found");
  }

  const { error } = await supabase
    .from("projects")
    .upsert(projects, { onConflict: "original_url" });

  if (error) throw error;

  return projects.length;
}
