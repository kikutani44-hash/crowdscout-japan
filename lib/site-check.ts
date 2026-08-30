/**
 * メーカー公式サイトの生存チェック。
 *
 * 過去案件へオファーをかける運用では、会社が畳まれていたり
 * サイトが消えているケースがある。オファー前に判別して空振りを減らす。
 *
 * Anthropic APIは使わない（HTTPリクエストのみ）ため、クレジットは消費しない。
 */

export interface SiteCheckResult {
  alive: boolean;
  statusCode: number | null;
  /** 画面に出す短い説明 */
  reason: string;
  finalUrl: string | null;
}

const TIMEOUT_MS = 12_000;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function request(url: string, method: "HEAD" | "GET"): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function checkSiteAlive(rawUrl: string): Promise<SiteCheckResult> {
  const url = normalizeUrl(rawUrl);
  if (!url) {
    return { alive: false, statusCode: null, reason: "URLの形式が不正です", finalUrl: null };
  }

  try {
    // まずHEADで軽く確認。HEADを塞いでいるサイトが多いのでGETにも落とす。
    let res = await request(url, "HEAD");
    if (res.status === 405 || res.status === 403 || res.status === 501) {
      res = await request(url, "GET");
    }

    const code = res.status;
    if (code >= 200 && code < 400) {
      return { alive: true, statusCode: code, reason: "サイトは生きています", finalUrl: res.url || url };
    }
    if (code === 404 || code === 410) {
      return { alive: false, statusCode: code, reason: "ページが存在しません（404/410）", finalUrl: res.url || url };
    }
    if (code >= 500) {
      return { alive: false, statusCode: code, reason: `サーバーエラー（${code}）`, finalUrl: res.url || url };
    }
    return { alive: false, statusCode: code, reason: `到達できません（${code}）`, finalUrl: res.url || url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("abort")) {
      return { alive: false, statusCode: null, reason: "応答がありません（タイムアウト）", finalUrl: url };
    }
    // DNS解決失敗＝ドメイン自体が消えている可能性が高い
    return { alive: false, statusCode: null, reason: "ドメインに接続できません", finalUrl: url };
  }
}
