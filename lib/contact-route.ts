/**
 * メーカー公式サイトから「先方に確実に届く連絡窓口」を探す。
 *
 * 実務で分かったこと（2026-08-30）:
 *   ・KickstarterのメッセージはWebからは送れない（支援済み案件からのみ）
 *   ・メールアドレスが取れても、それが事業開発の窓口とは限らない
 *   ・実際に効いたのは公式サイトの「Become a Wholesaler」フォームだった
 *
 * そこで、メールアドレスを探すのではなく
 * 「相手が用意している窓口」を種類ごとに見つけて優先度をつける。
 *
 * 費用: Anthropic APIも有料APIも使わない。HTTPリクエストのみ。
 */

export type ContactRouteKind =
  | "wholesale"   // 卸・代理店・取扱店の申込窓口（最優先）
  | "business"    // 法人・提携・OEMの窓口
  | "contact"     // 一般の問い合わせ
  | "support"     // サポート・ヘルプ
  | "press"       // プレス・メディア
  | "email";      // ページ内に直接書かれたメールアドレス

export interface ContactRoute {
  kind: ContactRouteKind;
  /** 画面に出すラベル（リンクの文言をそのまま使う） */
  label: string;
  url: string;
  /** そのページに入力フォームがあったか（未確認なら null） */
  hasForm: boolean | null;
}

export interface ContactRouteResult {
  siteUrl: string;
  routes: ContactRoute[];
  /** 一番に当たるべき窓口。無ければ null */
  best: ContactRoute | null;
  summary: string;
  /** 取得できなかった理由（空なら正常） */
  failure: string | null;
}

const TIMEOUT_MS = 10_000;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

/**
 * 窓口の種類ごとの判定語と優先度。
 * 数字が小さいほど優先して提示する。
 */
const RULES: Array<{ kind: ContactRouteKind; rank: number; words: string[] }> = [
  {
    kind: "wholesale",
    rank: 1,
    words: [
      "wholesale", "wholesaler", "dealer", "distributor", "distribution",
      "reseller", "retailer", "stockist", "trade account", "trade-account",
      "b2b", "become a partner", "become-a-partner",
      "卸", "代理店", "取扱店", "販売店",
    ],
  },
  {
    kind: "business",
    rank: 2,
    words: [
      "business inquir", "business-inquir", "bulk order", "corporate",
      "partnership", "partner with", "collaborat", "oem", "odm", "affiliate",
      "法人", "提携", "業務",
    ],
  },
  {
    kind: "contact",
    rank: 3,
    words: [
      "contact", "get in touch", "get-in-touch", "reach us", "reach-us",
      "お問い合わせ", "お問合せ", "問い合わせ",
    ],
  },
  { kind: "press", rank: 4, words: ["press", "media kit", "media-kit", "newsroom"] },
  {
    kind: "support",
    rank: 5,
    words: ["support", "help center", "help-center", "customer service", "サポート"],
  },
];

/** 公式サイトに置かれていがちな窓口ページのパス（リンクが見つからないとき用） */
const FALLBACK_PATHS = [
  "/pages/wholesale", "/wholesale", "/pages/become-a-dealer", "/dealers",
  "/pages/contact", "/contact", "/contact-us", "/pages/contact-us",
  "/pages/support", "/support",
];

async function fetchHtml(url: string, maxBytes = 600_000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9,ja;q=0.8",
      },
    });
    if (!res.ok) return null;
    return (await res.text()).slice(0, maxBytes);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 商品ページ・記事ページは窓口ではない。文言がたまたま一致するため除外する。
 *  （実測: "Natural Expressions" が press に、
 *   "Oversized Lumbar Support Folding Chair" が support に誤判定された） */
const NOT_A_ROUTE_PATH =
  /\/(products?|collections?|blogs?|blog|news|cart|account|login|register|search)\//i;

function normalizeSiteUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** リンクの行き先と文言から窓口の種類を判定する */
function matchesWord(haystack: string, word: string): boolean {
  // 日本語は語境界を取れないので単純な部分一致にする
  if (!/^[a-z0-9 \-]+$/.test(word)) return haystack.includes(word);
  // 英単語は「語の途中から始まらない」ことだけを求める。
  // 前方の境界だけ見るのは、"collaborat" のような語幹で
  // "Collaboration" にも当てたいため（語尾まで縛ると取りこぼす）。
  // これで "Expressions" が "press" に当たる誤検出は防げる。
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[ \-]/g, "[ \\-]");
  return new RegExp(`(^|[^a-z])${escaped}`, "i").test(haystack);
}

function classify(href: string, text: string): { kind: ContactRouteKind; rank: number } | null {
  if (NOT_A_ROUTE_PATH.test(href)) return null;
  const haystack = `${href} ${text}`.toLowerCase();
  for (const rule of RULES) {
    if (rule.words.some((word) => matchesWord(haystack, word))) {
      return { kind: rule.kind, rank: rule.rank };
    }
  }
  return null;
}

export function contactRouteKindLabel(kind: ContactRouteKind): string {
  switch (kind) {
    case "wholesale": return "卸・代理店の申込窓口";
    case "business": return "法人・提携の窓口";
    case "contact": return "問い合わせ";
    case "press": return "プレス";
    case "support": return "サポート";
    case "email": return "メールアドレス";
  }
}

export async function findContactRoutes(rawSiteUrl: string): Promise<ContactRouteResult> {
  const siteUrl = normalizeSiteUrl(rawSiteUrl);
  if (!siteUrl) {
    return { siteUrl: rawSiteUrl, routes: [], best: null, summary: "URLの形式が不正です", failure: "invalid_url" };
  }

  const html = await fetchHtml(siteUrl);
  if (html === null) {
    return {
      siteUrl,
      routes: [],
      best: null,
      summary: "公式サイトを読み込めませんでした（サイトが閉鎖された可能性もあります）",
      failure: "fetch_failed",
    };
  }

  const found = new Map<string, ContactRoute & { rank: number }>();

  // 1) ページ内のリンクを走査する
  const anchors = Array.from(
    html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)
  );
  for (const [, href, inner] of anchors) {
    if (href.startsWith("mailto:")) continue;
    let absolute: URL;
    try {
      absolute = new URL(href, siteUrl);
    } catch {
      continue;
    }
    // 別ドメイン（SNS等）は窓口として扱わない
    if (absolute.origin !== siteUrl) continue;

    const text = stripTags(inner).slice(0, 60);
    const hit = classify(absolute.pathname + absolute.search, text);
    if (!hit) continue;

    const key = absolute.toString();
    const existing = found.get(key);
    if (existing && existing.rank <= hit.rank) continue;
    found.set(key, {
      kind: hit.kind,
      rank: hit.rank,
      label: text || contactRouteKindLabel(hit.kind),
      url: key,
      hasForm: null,
    });
  }

  // 2) リンクが1つも取れないサイト（JSで描画される等）は既定のパスを直接叩く
  if (found.size === 0) {
    const probes = await Promise.all(
      FALLBACK_PATHS.map(async (path) => {
        const url = `${siteUrl}${path}`;
        const page = await fetchHtml(url, 120_000);
        if (page === null) return null;
        const hit = classify(path, "");
        if (!hit) return null;
        return {
          kind: hit.kind,
          rank: hit.rank,
          label: contactRouteKindLabel(hit.kind),
          url,
          hasForm: /<form[\s>]/i.test(page),
        };
      })
    );
    for (const probe of probes) {
      if (probe) found.set(probe.url, probe);
    }
  }

  // 3) ページ内に直接書かれたメールアドレス
  const mailto = html.match(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
  const email = mailto?.[1];
  if (email && !/example|noreply|sentry|\.png$|\.jpg$/i.test(email)) {
    found.set(`mailto:${email}`, {
      kind: "email",
      rank: 6,
      label: email,
      url: `mailto:${email}`,
      hasForm: null,
    });
  }

  const routes = Array.from(found.values())
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 8)
    .map(({ rank: _rank, ...route }) => route);

  const best = routes[0] ?? null;

  let summary: string;
  if (!best) {
    summary = "連絡窓口が見つかりませんでした（サイトを直接確認してください）";
  } else if (best.kind === "wholesale") {
    summary = "卸・代理店の申込窓口があります。先方が用意した窓口なので最優先で使えます";
  } else if (best.kind === "business") {
    summary = "法人・提携向けの窓口があります";
  } else {
    summary = `${contactRouteKindLabel(best.kind)}が見つかりました`;
  }

  return { siteUrl, routes, best, summary, failure: null };
}

/** 窓口ページを開いて入力フォームの有無を確かめる（best のみ・任意） */
export async function inspectRouteForm(route: ContactRoute): Promise<boolean | null> {
  if (route.url.startsWith("mailto:")) return null;
  const html = await fetchHtml(route.url, 200_000);
  if (html === null) return null;
  return /<form[\s>]/i.test(html);
}
