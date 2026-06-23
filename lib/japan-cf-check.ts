import type { JapanCfResult, JapanCfSiteResult } from "./types";

const NO_RESULT_PATTERNS = [
  /条件に一致するプロジェクトは見つかりませんでした/,
  /該当するプロジェクトがありません/,
  /0件/,
  /見つかりませんでした/,
  /検索結果はありません/,
  /結果がありません/,
];

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Accept-Language": "ja,en-US;q=0.9",
  Accept: "text/html,application/xhtml+xml",
};

function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}

/** Pick a concise search phrase from product title. */
export function buildCfSearchQuery(titleJa: string | null, titleEn: string): string {
  const primary = normalizeQuery(titleJa || titleEn);
  const beforeColon = primary.split(/[:：|｜]/)[0]?.trim() || primary;
  const cleaned = beforeColon.replace(/【[^】]+】/g, "").trim();
  if (cleaned.length >= 3) return cleaned.slice(0, 80);
  return normalizeQuery(titleEn).slice(0, 80);
}

function extractTerms(query: string): string[] {
  const q = normalizeQuery(query);
  const terms: string[] = [];
  for (const part of q.split(/[\s:/\-|]+/)) {
    const token = part.replace(/[^\w\u3040-\u30ff\u4e00-\u9fff]/g, "");
    if (token.length >= 3) terms.push(token.toLowerCase());
  }
  if (!terms.length && q) terms.push(q.toLowerCase());
  return terms.slice(0, 5);
}

function isRelevantMatch(query: string, text: string): boolean {
  if (!text) return false;
  const terms = extractTerms(query);
  const hay = text.toLowerCase();
  if (!terms.length) return false;
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(hay)) return true;
    if (term.length >= 6 && hay.includes(term)) return true;
  }
  return false;
}

function hasNoResults(text: string): boolean {
  return NO_RESULT_PATTERNS.some((p) => p.test(text));
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLinks(html: string): { href: string; text: string }[] {
  const links: { href: string; text: string }[] = [];
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    links.push({ href: match[1], text: stripHtml(match[2]) });
  }
  return links;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    redirect: "follow",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

function buildMakuakeUrl(query: string): string {
  return `https://www.makuake.com/discover/projects/?keyword=${encodeURIComponent(query)}`;
}

function buildGreenfundingUrl(query: string): string {
  const params = new URLSearchParams({ "q[title_or_planner_name_cont]": query });
  return `https://greenfunding.jp/portals/search?${params.toString()}`;
}

function buildCampfireUrl(query: string): string {
  return `https://camp-fire.jp/projects/search?word=${encodeURIComponent(query)}`;
}

async function checkMakuake(query: string): Promise<JapanCfSiteResult> {
  const url = buildMakuakeUrl(query);
  const html = await fetchHtml(url);
  const text = stripHtml(html);
  const links = extractLinks(html).filter(
    (ln) => ln.href.includes("/project/") && !ln.href.includes("favorite")
  );

  let found = false;
  let matches: string[] = [];
  if (!hasNoResults(text)) {
    matches = links
      .filter((ln) => isRelevantMatch(query, ln.text || ln.href))
      .map((ln) => ln.text || ln.href);
    found = matches.length > 0;
  }

  return { site: "makuake", query, url, found, matches: matches.slice(0, 3) };
}

async function checkGreenfunding(query: string): Promise<JapanCfSiteResult> {
  const url = buildGreenfundingUrl(query);
  const html = await fetchHtml(url);
  const text = stripHtml(html);
  const links = extractLinks(html).filter((ln) => /\/portals\/[^/?#]+$/.test(ln.href));

  let found = false;
  let matches: string[] = [];
  if (!hasNoResults(text)) {
    matches = links
      .filter((ln) => isRelevantMatch(query, ln.text || ln.href))
      .map((ln) => ln.text || ln.href);
    if (!matches.length) {
      const blocks = text.split(/\n{2,}/);
      matches = blocks.filter((b) => isRelevantMatch(query, b) && b.includes("¥")).map((b) => b.slice(0, 120));
    }
    found = matches.length > 0;
  }

  return { site: "greenfunding", query, url, found, matches: matches.slice(0, 3) };
}

async function checkCampfire(query: string): Promise<JapanCfSiteResult> {
  const url = buildCampfireUrl(query);
  const html = await fetchHtml(url);
  const text = stripHtml(html);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripHtml(titleMatch[1]) : "";
  const links = extractLinks(html).filter((ln) => /\/projects\/\d+\/view/.test(ln.href));

  let found = false;
  let matches: string[] = [];
  if (!hasNoResults(text)) {
    matches = links
      .filter((ln) => isRelevantMatch(query, ln.text || ln.href))
      .map((ln) => ln.text || ln.href);
    const titleHasQuery =
      title.toLowerCase().includes(query.toLowerCase()) || title.includes(`「${query}」`);
    if (!matches.length && links.length && titleHasQuery) {
      matches = links.slice(0, 3).map((ln) => ln.text || ln.href);
    }
    found = matches.length > 0;
  }

  return { site: "campfire", query, url, found, matches: matches.slice(0, 3) };
}

/** Search Makuake / GREEN FUNDING / CAMPFIRE and determine Japan market entry status. */
export async function checkJapanCf(query: string): Promise<JapanCfResult> {
  const normalized = normalizeQuery(query);
  const checks = [checkMakuake, checkGreenfunding, checkCampfire];
  const sites: JapanCfSiteResult[] = [];

  for (const run of checks) {
    try {
      sites.push(await run(normalized));
    } catch (err) {
      const site =
        run === checkMakuake ? "makuake" : run === checkGreenfunding ? "greenfunding" : "campfire";
      const fallbackUrl =
        site === "makuake"
          ? buildMakuakeUrl(normalized)
          : site === "greenfunding"
            ? buildGreenfundingUrl(normalized)
            : buildCampfireUrl(normalized);
      sites.push({
        site,
        query: normalized,
        url: fallbackUrl,
        found: false,
        matches: [],
      });
      console.error(`[japan_cf] ${site} error:`, err);
    }
  }

  const isJapanUnentered = sites.every((s) => !s.found);
  return {
    checkedAt: new Date().toISOString(),
    query: normalized,
    sites,
    isJapanUnentered,
  };
}
