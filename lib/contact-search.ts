/**
 * Google Custom Search API でメーカー公式サイトを検索し、
 * サイトからメール・SNS URLを自動取得する
 */

export interface SiteContactResult {
  officialUrl: string | null;
  email: string | null;
  instagram: string | null;
  twitter: string | null;
  facebook: string | null;
  linkedin: string | null;
  source: "google_search" | "site_parse" | "none";
}

// ブランド名をタイトルから抽出
function extractBrand(title: string): string {
  return title.split(/[:—–|]/)[0].trim();
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

// 公式サイトをフェッチしてコンタクト情報を取得（バッチ処理からも使用）
export async function parseContactFromWebsite(
  siteUrl: string
): Promise<Pick<SiteContactResult, "email" | "instagram" | "twitter" | "facebook" | "linkedin">> {
  return parseContactFromSite(siteUrl);
}

async function parseContactFromSite(
  siteUrl: string
): Promise<Pick<SiteContactResult, "email" | "instagram" | "twitter" | "facebook" | "linkedin">> {
  const empty = { email: null, instagram: null, twitter: null, facebook: null, linkedin: null };

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

    // メールが見つからなければ /contact ページも試す
    if (!email) {
      const contactUrl = new URL("/contact", siteUrl).href;
      try {
        const contactRes = await fetch(contactUrl, {
          signal: AbortSignal.timeout(6000),
          headers: { "User-Agent": "Mozilla/5.0 (compatible; CrowdJARVIS/1.0)" },
        });
        if (contactRes.ok) {
          const contactHtml = await contactRes.text();
          const contactEmail = extractEmails(contactHtml);
          if (contactEmail) {
            return { email: contactEmail, ...sns };
          }
        }
      } catch {
        // /contact が存在しない場合は無視
      }
    }

    return { email, ...sns };
  } catch {
    return empty;
  }
}

// メインエントリーポイント
export async function searchMakerContacts(
  title: string,
  existingWebsite?: string | null
): Promise<SiteContactResult> {
  const brand = extractBrand(title);

  // 公式サイト（既存 or 新規検索）
  let officialUrl = existingWebsite ?? null;
  if (!officialUrl) {
    officialUrl = await searchOfficialSite(brand);
  }

  if (!officialUrl) {
    return { officialUrl: null, email: null, instagram: null, twitter: null, facebook: null, linkedin: null, source: "none" };
  }

  // サイトを解析してコンタクト情報を取得
  const contacts = await parseContactFromSite(officialUrl);

  return {
    officialUrl,
    ...contacts,
    source: existingWebsite ? "site_parse" : "google_search",
  };
}
