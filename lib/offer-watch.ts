/**
 * 送信済みオファーの「返信監視対象」を組み立てる。
 *
 * ■ なぜ必要か
 *   返信監視はもともと maker_email が分かっている案件しか見ていなかった。
 *   しかし実務では Kickstarter のメッセージが送れず、メールアドレスも取得できないため、
 *   公式サイトの問い合わせフォーム／卸申込フォームから送るのが主な経路になっている。
 *   フォーム送信では「どのアドレスから返信が来るか」を事前に知る方法がない
 *   （support@ かもしれないし、担当者の個人アドレスかもしれない）。
 *
 *   そこで、メールアドレスが分かっていない案件は
 *   公式サイトのドメインを監視対象にする。
 *   Gmail検索は from:example.com でドメイン一致が効くため、
 *   そのドメインの誰から返信が来ても拾える。
 *
 * ■ 限界
 *   先方が Gmail などの個人アドレスで返信してきた場合は捕まえられない。
 *   完全ではないが、フォーム送信の大半はドメイン一致で拾える。
 */

import type { Project } from "./types";

export interface OfferWatchTarget {
  projectId: string;
  title: string;
  /** Gmail検索とfrom一致に使う文字列（メールアドレス or ドメイン） */
  target: string;
  kind: "email" | "domain";
}

/** URLからホスト名を取り出し、www. を落とす */
export function domainFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    const host = url.hostname.replace(/^www\./, "");
    // ドメインとして短すぎる／不正なものは監視に使わない
    if (!host.includes(".") || host.length < 4) return null;
    return host;
  } catch {
    return null;
  }
}

/**
 * オファー送信済みの案件から監視対象を作る。
 * メールアドレスが分かっていればそちらを優先し、無ければ公式サイトのドメインを使う。
 */
export function buildWatchTargets(projects: Project[]): OfferWatchTarget[] {
  const targets: OfferWatchTarget[] = [];

  for (const project of projects) {
    if (!project.offer_sent_at) continue;

    if (project.maker_email) {
      targets.push({
        projectId: project.id,
        title: project.title_ja ?? project.title,
        target: project.maker_email,
        kind: "email",
      });
      continue;
    }

    const domain = project.maker_website ? domainFromUrl(project.maker_website) : null;
    if (domain) {
      targets.push({
        projectId: project.id,
        title: project.title_ja ?? project.title,
        target: domain,
        kind: "domain",
      });
    }
  }

  // 同じ対象が複数案件にまたがることは通常ないが、重複は除く
  const seen = new Set<string>();
  return targets.filter((t) => {
    const key = t.target.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
