/**
 * Google Custom Search API でメーカー公式サイトを検索し、
 * サイトからメール・SNS URLを自動取得する
 */

export interface SiteContactResult {
  officialUrl: string | null;
  email: string | null;
  contactFormUrl: string | null;
  instagram: string | null;
  twitter: string | null;
  facebook: string | null;
  linkedin: string | null;
  source: "campaign_page" | "google_search" | "site_parse" | "none";
}

// ブランド名をタイトルから抽出
function extractBrand(title: string): string {
  return title.split(/[:—–|]/)[0].trim();
}

// クラファンサイト・SNS・大手ECサイトを除外リスト（公式サイト判定用）
const NON_OFFICIAL_DOMAINS = [
  "kickstarter.com", "indiegogo.com", "makuake.com", "wadiz.kr", "zeczec.com",
  "greenfunding.jp", "campfire.jp",
  "facebook.com", "instagram.com", "twitter.com", "x.com", "linkedin.com",
  "youtube.com", "tiktok.com", "discord.gg", "discord.com",
  "amazon.com", "amazon.co.jp", "rakuten.co.jp",
  "kickstarter-cf.imgix.net", "ksr-ugc.imgix.net",
];

function isNonOfficialDomain(url: string): boolean {
  return NON_OFFICIAL_DOMAINS.some((d) => url.includes(d));
}

// Kickstarter/Indiegogoのキャンペーンページから、クリエイターが掲載している
// 外部の公式サイトリンクを直接抽出する（Google検索より確実な一次情報）
export async function extractWebsiteFromCampaignPage(
  campaignUrl: string
): Promise<string | null> {
  try {
    const res = await fetch(campaignUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CrowdJARVIS/1.0)" },
    });
    if (!res.ok) return null;

    const html = await res.text();
    const hrefMatches = html.match(/href="(https?:\/\/[^"]+)"/g) ?? [];
    const campaignHost = new URL(campaignUrl).hostname;

    for (const match of hrefMatches) {
      const url = match.replace(/^href="/, "").replace(/"$/, "");
      if (url.includes(campaignHost)) continue;
      if (isNonOfficialDomain(url)) continue;
      // Kickstarter外部リンクのリダイレクト形式 (?ref=...) はそのまま使える
      try {
        const parsed = new URL(url);
        return `${parsed.protocol}//${parsed.hostname}`;
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Hunter.io Domain Search API でメールアドレスを検索
async function searchEmailViaHunter(domain: string): Promise<string | null> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return null;

  try {
    const url = new URL("https://api.hunter.io/v2/domain-search");
    url.searchParams.set("domain", domain);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("limit", "5");

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const data = await res.json() as {
      data?: { emails?: Array<{ value: string; confidence: number }> };
    };

    const emails = data.data?.emails ?? [];
    // confidenceが高い順に並べて最初のものを返す
    const best = emails.sort((a, b) => b.confidence - a.confidence)[0];
    return best?.value ?? null;
  } catch {
    return null;
  }
}

// Google Custom Search API でブランドの公式サイトを検索
async function searchOfficialSite(brand: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;

  if (!apiKey || !cseId) return null;

  const query = `${brand} official site`;
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cseId);
  url.searchParams.set("q", query);
  url.searchParams.set("num", "5");

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: Array<{ link: string; title: string }>;
    };

    // ソーシャルメディア・クラファンサイトを除外して最初の結果を返す
    const EXCLUDE = [
      "kickstarter.com", "indiegogo.com", "makuake.com", "wadiz.kr", "zeczec.com",
      "facebook.com", "instagram.com", "twitter.com", "x.com", "linkedin.com",
      "amazon.com", "rakuten.co.jp", "youtube.com",
    ];
    const item = data.items?.find((i) => !EXCLUDE.some((d) => i.link.includes(d)));
    return item?.link ?? null;
  } catch {
    return null;
  }
}

// HTMLからメールアドレスを抽出
function extractEmails(html: string): string | null {
  // mailto: リンク
  const mailtoMatches = html.match(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g);
  if (mailtoMatches && mailtoMatches.length > 0) {
    const email = mailtoMatches[0].replace("mailto:", "").split("?")[0];
    if (!email.includes("example") && !email.includes("noreply")) return email;
  }

  // テキスト中のメールアドレス
  const emailMatch = html.match(/\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/);
  if (emailMatch) {
    const email = emailMatch[1];
    if (!email.includes("example") && !email.includes("noreply") && !email.includes("@sentry")) {
      return email;
    }
  }

  return null;
}

// HTMLからSNS URLを抽出
function extractSnsUrls(html: string): {
  instagram: string | null;
  twitter: string | null;
  facebook: string | null;
  linkedin: string | null;
} {
  const extract = (pattern: RegExp): string | null => {
    const match = html.match(pattern);
    return match?.[0] ?? null;
  };

  return {
    instagram: extract(/https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?(?!p\/)/),
    twitter: extract(/https?:\/\/(www\.)?(twitter|x)\.com\/[a-zA-Z0-9_]+\/?/),
    facebook: extract(/https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9_.]+\/?/),
    linkedin: extract(/https?:\/\/(www\.)?linkedin\.com\/(company|in)\/[a-zA-Z0-9_-]+\/?/),
  };
}

// ページHTMLに問い合わせフォーム（<form>タグ）が存在するか判定
function hasContactForm(html: string): boolean {
  return /<form[\s>]/i.test(html);
}

// 追加で試すコンタクトページのパス候補
const CONTACT_PATHS = [
  "/contact",
  "/pages/contact",
  "/pages/contact-us",
  "/contact-us",
  "/pages/support",
  "/support",
  "/pages/about",
  "/about",
];

type ContactPageResult = Pick<SiteContactResult, "email" | "instagram" | "twitter" | "facebook" | "linkedin" | "contactFormUrl">;

// 公式サイトをフェッチしてコンタクト情報を取得（バッチ処理からも使用）
export async function parseContactFromWebsite(siteUrl: string): Promise<ContactPageResult> {
  return parseContactFromSite(siteUrl);
}

async function parseContactFromSite(siteUrl: string): Promise<ContactPageResult> {
  const empty: ContactPageResult = { email: null, contactFormUrl: null, instagram: null, twitter: null, facebook: null, linkedin: null };

  try {
    // まずトップページを取得
    const res = await fetch(siteUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CrowdJARVIS/1.0)" },
    });
    if (!res.ok) return empty;

    const html = await res.text();
    const email = extractEmails(html);
    const sns = extractSnsUrls(html);
    let contactFormUrl: string | null = hasContactForm(html) ? siteUrl : null;

    if (email) {
      return { email, contactFormUrl, ...sns };
    }

    // メールが見つからなければ、候補のコンタクトページを順に試す
    for (const path of CONTACT_PATHS) {
      try {
        const contactUrl = new URL(path, siteUrl).href;
        const contactRes = await fetch(contactUrl, {
          signal: AbortSignal.timeout(6000),
          headers: { "User-Agent": "Mozilla/5.0 (compatible; CrowdJARVIS/1.0)" },
        });
        if (!contactRes.ok) continue;

        const contactHtml = await contactRes.text();
        const contactEmail = extractEmails(contactHtml);
        if (contactEmail) {
          return { email: contactEmail, contactFormUrl, ...sns };
        }
        // メールは無いがフォームがあれば記録しておく（最初に見つかったもの優先）
        if (!contactFormUrl && hasContactForm(contactHtml)) {
          contactFormUrl = contactUrl;
        }
      } catch {
        continue;
      }
    }

    // サイトスクレイピングで見つからなければ Hunter.io で検索
    try {
      const domain = new URL(siteUrl).hostname.replace(/^www\./, "");
      const hunterEmail = await searchEmailViaHunter(domain);
      if (hunterEmail) {
        return { email: hunterEmail, contactFormUrl, ...sns };
      }
    } catch {
      // Hunter.io 失敗は無視
    }

    return { email: null, contactFormUrl, ...sns };
  } catch {
    return empty;
  }
}

// メインエントリーポイント
export async function searchMakerContacts(
  title: string,
  existingWebsite?: string | null,
  campaignUrl?: string | null
): Promise<SiteContactResult> {
  const brand = extractBrand(title);
  const empty: SiteContactResult = {
    officialUrl: null, email: null, contactFormUrl: null,
    instagram: null, twitter: null, facebook: null, linkedin: null, source: "none",
  };

  // 公式サイトの特定: ① 既存DB ② Kickstarter/Indiegogoページの直リンク ③ Google検索
  let officialUrl = existingWebsite ?? null;
  let source: SiteContactResult["source"] = "site_parse";

  if (!officialUrl && campaignUrl) {
    officialUrl = await extractWebsiteFromCampaignPage(campaignUrl);
    if (officialUrl) source = "campaign_page";
  }

  if (!officialUrl) {
    officialUrl = await searchOfficialSite(brand);
    if (officialUrl) source = "google_search";
  }

  if (!officialUrl) {
    return empty;
  }

  // サイトを解析してコンタクト情報を取得
  const contacts = await parseContactFromSite(officialUrl);

  return {
    officialUrl,
    ...contacts,
    source,
  };
}
