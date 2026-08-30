/**
 * 日本参入チェック（自動）。
 *
 * 既存の japan_cf_check は Makuake 等の「日本のクラウドファンディング」に
 * 出ているかしか見ない。しかし実務で脱落した案件の大半は、CFではなく
 * 自社の日本語ECサイト・Amazon.co.jp・楽天で既に正規流通していた。
 * （2026-08-30 の実地調査で4件中3件がこのパターン）
 *
 * ここでは次の4つを機械的に調べ、根拠を添えて判定する。
 *   1. 日本向けドメインの存在   brandjapan.com / jp.brand.com / brand.jp / brand.co.jp
 *   2. Amazon.co.jp の商品名一致
 *   3. 楽天市場の商品名一致
 *   4. 公式サイトの日本語・JPY表記（日本向けページを持っているか）
 *
 * 費用: Anthropic APIも有料検索APIも使わない。HTTPリクエストのみ。
 */

export type JapanPresenceVerdict = "entered" | "clear" | "unknown";

export interface JapanPresenceEvidence {
  /** 'domain' | 'amazon' | 'rakuten' | 'official_site' */
  kind: "domain" | "amazon" | "rakuten" | "official_site";
  label: string;
  url: string | null;
  /** 見つかった商品名など（最大3件） */
  samples: string[];
}

export interface JapanPresenceResult {
  verdict: JapanPresenceVerdict;
  /** 0〜100。高いほど「既に日本で売られている」確信度が高い */
  score: number;
  brand: string;
  evidence: JapanPresenceEvidence[];
  /** 画面に出す1行の要約 */
  summary: string;
  /** 調べられなかった項目（ネットワークエラー等）。空なら全項目を確認できた */
  failures: string[];
}

const TIMEOUT_MS = 9_000;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

const HEADERS = {
  "User-Agent": UA,
  "Accept-Language": "ja-JP,ja;q=0.9,en;q=0.8",
  Accept: "text/html,application/xhtml+xml",
};

/**
 * 案件タイトルの先頭部分（ブランドが置かれる位置）を取り出す。
 * "Nomis ONE™ - Inflatable Rooftop Tent" → "Nomis ONE"
 */
function leadingSegment(title: string): string {
  let head = title.split(/[:—–|｜]/)[0];
  head = head.replace(/[™®©]/g, "");
  head = head.split(/\s+[-–—]\s+/)[0];
  head = head.replace(/\s*\((?:[^)]*)\)\s*$/, "");
  return head.trim();
}

/** 比較用に記号と空白を落として小文字化する */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9぀-ヿ一-龯]/g, "");
}

/**
 * 一般的すぎる語は、EC検索で無関係な商品に必ず一致してしまうため
 * 単独ではブランド名として使わない。
 */
const TOO_GENERIC = new Set([
  "one", "go", "air", "pro", "max", "mini", "plus", "smart", "the", "my",
  "new", "home", "life", "eco", "solo", "duo", "top", "key", "box", "cube",
  "ever", "all", "up", "fit", "zip", "pod", "kit", "set", "lab", "co",
]);

/** 公式サイトのURLからブランド名を取り出す（最も信頼できる手がかり） */
function brandFromUrl(rawUrl: string): string | null {
  try {
    const host = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).hostname;
    const parts = host.replace(/^www\./, "").split(".");
    // jp.brand.com → brand / brand.co.jp → brand
    const label = parts.length > 2 && (parts[0] === "jp" || parts[0] === "shop") ? parts[1] : parts[0];
    return label && label.length >= 3 ? label : null;
  } catch {
    return null;
  }
}

export interface BrandTerms {
  /** EC検索に投げる語 */
  searchTerm: string;
  /** 商品名がこの語を含んでいれば「そのブランドの商品」とみなす */
  matchKey: string;
  /** 画面表示用 */
  display: string;
}

/**
 * 検索語と一致判定語を決める。
 *
 * タイトル全体（"EVER ADVANCED Folding Wagon"）で検索すると商品名に一致せず
 * 取りこぼす。逆に1語目だけ（"EVER"）だと無関係な商品を拾う。
 * そこで「先頭2語で検索し、1語目が十分に特徴的ならその語で一致を見る」。
 */
export function resolveBrandTerms(title: string, officialUrl?: string | null): BrandTerms | null {
  let head = leadingSegment(title);
  // 冠詞で始まるタイトルは1語ずれるため落とす（"The Nomis ONE ..."）
  head = head.replace(/^(the|a|an)\s+/i, "");

  const words = head.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  // 先頭2語をブランド名とみなす。
  // 1語目だけで一致を見ると "Portal" が無関係な商品にまで当たり、
  // タイトル全体で見ると商品名に一致せず取りこぼす（実測で確認）。
  const phrase = words.slice(0, 2).join(" ");

  const hostBrand = officialUrl ? brandFromUrl(officialUrl) : null;
  const searchTerm = hostBrand && normalize(hostBrand).length >= 4 ? hostBrand : phrase;
  const matchKey = normalize(searchTerm);

  // 短い語・一般名詞はEC検索で必ず誤検出するため自動判定しない
  if (matchKey.length < 5) return null;
  if (words.length === 1 && TOO_GENERIC.has(words[0].toLowerCase())) return null;

  return { searchTerm, matchKey, display: searchTerm };
}

async function fetchText(url: string, maxBytes = 900_000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: HEADERS,
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, maxBytes);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── 1. 日本向けドメイン ───────────────────────────────────────────
function japanDomainCandidates(brand: string): string[] {
  const slug = brand.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!slug) return [];
  const hyphen = brand.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const bases = hyphen && hyphen !== slug ? [slug, hyphen] : [slug];
  const hosts: string[] = [];
  for (const base of bases) {
    hosts.push(`${base}japan.com`, `jp.${base}.com`, `${base}.jp`, `${base}.co.jp`);
  }
  return Array.from(new Set(hosts));
}

async function checkJapanDomains(brand: string): Promise<JapanPresenceEvidence[]> {
  const found: JapanPresenceEvidence[] = [];
  const hosts = japanDomainCandidates(brand);

  await Promise.all(
    hosts.map(async (host) => {
      const html = await fetchText(`https://${host}`, 200_000);
      if (html === null) return;
      // ドメインパーキング・売出し中のページを除外する
      if (/domain (is )?for sale|このドメインは.*販売|parked (free )?at/i.test(html)) return;
      found.push({
        kind: "domain",
        label: `日本向けドメインが存在: ${host}`,
        url: `https://${host}`,
        samples: [],
      });
    })
  );

  return found;
}

// ── 2. Amazon.co.jp ─────────────────────────────────────────────
//
// 通常の /s?k= はサーバーからのアクセスにボット検知の中間ページを返すことがある。
// 同じ検索を返す /gp/search はそのまま応答するため、そちらを使う。
// 中間ページが返った場合は突破を試みず「未確認」として扱い、
// 判定を clear（形跡なし）に倒さないようにする。
async function checkAmazon(
  terms: BrandTerms
): Promise<{ evidence: JapanPresenceEvidence | null; failed: boolean }> {
  const url = `https://www.amazon.co.jp/gp/search?keywords=${encodeURIComponent(terms.searchTerm)}`;
  const html = await fetchText(url);
  if (html === null) return { evidence: null, failed: true };

  // 検索結果カードごとに切り出し、その中の <h2>（商品名）を見る。
  // カード単位で見ないと、広告やサイドバーの文字列を拾ってしまう。
  const blocks = html.split('data-component-type="s-search-result"').slice(1);
  const titles: string[] = [];
  for (const block of blocks) {
    const match = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
    if (match) {
      const text = stripTags(match[1]);
      if (text.length > 4) titles.push(text);
    }
  }
  if (titles.length === 0) {
    // Amazon自身が「該当なし」と言っている場合は、確認できた上でのゼロ件。
    // そうでなくカードが無い場合はボット検知の中間ページを疑い「未確認」にする。
    const noResults = /に一致する商品はありませんでした|No results for|検索結果がありません/.test(html);
    return { evidence: null, failed: !noResults };
  }

  const hits = titles.filter((t) => normalize(t).includes(terms.matchKey));
  if (hits.length < 2) return { evidence: null, failed: false };

  return {
    evidence: {
      kind: "amazon",
      label: `Amazon.co.jp に ${hits.length}件（検索結果${titles.length}件中）`,
      url,
      samples: hits.slice(0, 3),
    },
    failed: false,
  };
}

// ── 3. 楽天市場 ──────────────────────────────────────────────────
async function checkRakuten(
  terms: BrandTerms
): Promise<{ evidence: JapanPresenceEvidence | null; failed: boolean }> {
  const url = `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(terms.searchTerm)}/`;
  const html = await fetchText(url);
  if (html === null) return { evidence: null, failed: true };

  const titles = Array.from(html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g))
    .map((m) => stripTags(m[1]))
    .filter((t) => t.length > 5);
  if (titles.length === 0) return { evidence: null, failed: false };

  const hits = titles.filter((t) => normalize(t).includes(terms.matchKey));
  if (hits.length < 2) return { evidence: null, failed: false };

  return {
    evidence: {
      kind: "rakuten",
      label: `楽天市場に ${hits.length}件（検索結果${titles.length}件中）`,
      url,
      samples: hits.slice(0, 3),
    },
    failed: false,
  };
}

// ── 4. 公式サイトの日本語・JPY表記 ────────────────────────────────
async function checkOfficialSite(siteUrl: string): Promise<JapanPresenceEvidence | null> {
  const html = await fetchText(siteUrl, 400_000);
  if (html === null) return null;

  const hasKana = /[぀-ゟ゠-ヿ]/.test(html);
  const hasJpy = /JPY|￥|&#165;/.test(html);
  if (!hasKana && !hasJpy) return null;

  const signals = [hasKana ? "日本語表記" : null, hasJpy ? "JPY表記" : null]
    .filter(Boolean)
    .join(" / ");

  return {
    kind: "official_site",
    label: `公式サイトに${signals}あり`,
    url: siteUrl,
    samples: [],
  };
}

// ── 判定 ────────────────────────────────────────────────────────

/**
 * ブランド名から日本での販売の形跡を調べる。
 *
 * @param title        案件タイトル（ここからブランド名を推定する）
 * @param officialUrl  分かっていればメーカー公式サイトのURL
 */
export async function checkJapanPresence(
  title: string,
  officialUrl?: string | null
): Promise<JapanPresenceResult> {
  const terms = resolveBrandTerms(title, officialUrl);

  if (!terms) {
    return {
      verdict: "unknown",
      score: 0,
      brand: leadingSegment(title),
      evidence: [],
      summary: "ブランド名が短く一般的すぎるため自動判定できません（手動で確認してください）",
      failures: ["ブランド名の抽出"],
    };
  }

  const [domains, amazon, rakuten, official] = await Promise.all([
    checkJapanDomains(terms.display),
    checkAmazon(terms),
    checkRakuten(terms),
    officialUrl ? checkOfficialSite(officialUrl) : Promise.resolve(null),
  ]);

  const evidence: JapanPresenceEvidence[] = [...domains];
  if (amazon.evidence) evidence.push(amazon.evidence);
  if (rakuten.evidence) evidence.push(rakuten.evidence);
  if (official) evidence.push(official);

  const failures: string[] = [];
  if (amazon.failed) failures.push("Amazon.co.jp");
  if (rakuten.failed) failures.push("楽天市場");

  // 重み付け。ECでの商品名一致が最も強い証拠。
  let score = 0;
  score += domains.length > 0 ? 45 : 0;
  score += amazon.evidence ? 40 : 0;
  score += rakuten.evidence ? 30 : 0;
  score += official ? 20 : 0;
  score = Math.min(100, score);

  const sources = evidence.map((e) => {
    switch (e.kind) {
      case "domain": return "日本向けドメイン";
      case "amazon": return "Amazon.co.jp";
      case "rakuten": return "楽天市場";
      case "official_site": return "公式サイトの日本語対応";
    }
  });

  let verdict: JapanPresenceVerdict;
  let summary: string;

  if (evidence.length > 0) {
    verdict = "entered";
    summary = `日本での販売の形跡あり（${Array.from(new Set(sources)).join(" / ")}）`;
  } else if (failures.length >= 2) {
    // 主要な2経路とも調べられていない状態で「形跡なし」とは言えない
    verdict = "unknown";
    summary = `判定できませんでした（${failures.join("・")}に接続できず）`;
  } else if (failures.length === 1) {
    verdict = "clear";
    summary = `日本での販売の形跡は見つかりませんでした（ただし${failures[0]}は未確認）`;
  } else {
    verdict = "clear";
    summary = "日本での販売の形跡は見つかりませんでした";
  }

  return { verdict, score, brand: terms.display, evidence, summary, failures };
}

// ── 表示用 ──────────────────────────────────────────────────────

export function japanPresenceBadgeLabel(verdict: JapanPresenceVerdict): string {
  switch (verdict) {
    case "entered":
      return "⚠️ 日本販売の形跡あり";
    case "clear":
      return "✅ 日本販売なし";
    case "unknown":
      return "❔ 判定できず";
  }
}

export function japanPresenceBadgeClass(verdict: JapanPresenceVerdict): string {
  switch (verdict) {
    case "entered":
      return "border-red-500/50 bg-red-500/20 text-red-200";
    case "clear":
      return "border-emerald-500/50 bg-emerald-500/20 text-emerald-200";
    case "unknown":
      return "border-muted bg-muted/30 text-muted-foreground";
  }
}
