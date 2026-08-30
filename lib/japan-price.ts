/**
 * 海外クラファン価格から「日本でいくらになるか」を概算する。
 *
 * 従来はこの数字を市場分析（Sonnet）で毎回生成していたが、
 * 計算で出せる内容なのでAIを使わずに常時表示する。クレジット消費ゼロ。
 *
 * ■ なぜこの数字が要るか
 * 日本CFでの想定価格が現実離れしていれば、その時点で見送れる。
 * 例: 海外22万円の電動芝刈り機 → 日本では60〜70万円。
 *     この金額でクラファンは成立しないと即断できる。
 *
 * ■ 精度について
 * あくまで一次スクリーニング用の概算。実際の価格は
 * 原価・ロット・認証費用・送料で大きく動くため、
 * 「桁を見て足切りする」用途に留めること。
 */

/** 想定為替レート。既存コード（lib/claude.ts の日本向けページ生成）と揃えている。 */
export const USD_JPY = Number(process.env.NEXT_PUBLIC_USD_JPY ?? 150);

/**
 * 海外CF価格に対する日本CF価格の倍率。
 *
 * 内訳の目安:
 *   輸入送料・関税        × 1.2〜1.3
 *   認証取得（PSE/技適等） 商品単価に按分
 *   CFプラットフォーム手数料 約20%
 *   輸入元マージン・広告費  残り
 *
 * 実運用で観測される 2.5〜3.5倍 をレンジとして採用する。
 */
export const JP_MULTIPLE_LOW = 2.5;
export const JP_MULTIPLE_HIGH = 3.5;

export interface JapanPriceEstimate {
  /** 海外での1人あたり平均支援額（USD） */
  avgPledgeUsd: number;
  /** 同（円換算） */
  avgPledgeJpy: number;
  /** 日本での想定価格レンジ（円） */
  jpyLow: number;
  jpyHigh: number;
  /** 「22.0万円 → 55〜77万円」のような表示用文字列 */
  label: string;
  /** カード上での短縮表示「55〜77万円」 */
  shortLabel: string;
}

/** 円を「55万円」「1,200万円」のように読みやすく整形する。 */
function formatJpy(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}億円`;
  if (value >= 10_000) {
    const man = value / 10_000;
    return man >= 100 ? `${Math.round(man).toLocaleString()}万円` : `${man.toFixed(1)}万円`;
  }
  return `${Math.round(value).toLocaleString()}円`;
}

/**
 * 想定日本価格を算出する。
 *
 * 支援者数が無い/極端に少ない案件は平均支援額が信用できないため null を返す。
 * （1人あたり平均は複数個購入やアドオンを含むので上振れしやすい点に注意）
 */
export function estimateJapanPrice(
  raisedUsd: number | null | undefined,
  backers: number | null | undefined,
): JapanPriceEstimate | null {
  const raised = raisedUsd ?? 0;
  const count = backers ?? 0;
  if (raised <= 0 || count < 5) return null;

  const avgPledgeUsd = raised / count;
  // 1人あたり数ドルは「応援だけの支援枠」で商品価格ではないため除外する
  if (avgPledgeUsd < 20) return null;

  const avgPledgeJpy = avgPledgeUsd * USD_JPY;
  const jpyLow = avgPledgeJpy * JP_MULTIPLE_LOW;
  const jpyHigh = avgPledgeJpy * JP_MULTIPLE_HIGH;

  const shortLabel = `${formatJpy(jpyLow)}〜${formatJpy(jpyHigh)}`;
  return {
    avgPledgeUsd,
    avgPledgeJpy,
    jpyLow,
    jpyHigh,
    label: `海外 ${formatJpy(avgPledgeJpy)} → 日本 ${shortLabel}`,
    shortLabel,
  };
}

/**
 * 日本CFで現実的に売れる価格帯かどうかのざっくり判定。
 * 高額すぎる案件を一覧上で足切りするために使う。
 */
export function japanPriceVerdict(
  estimate: JapanPriceEstimate | null,
): { level: "ok" | "high" | "very-high"; note: string } | null {
  if (!estimate) return null;
  const mid = (estimate.jpyLow + estimate.jpyHigh) / 2;
  if (mid >= 300_000) {
    return { level: "very-high", note: "日本CFでは相当厳しい価格帯" };
  }
  if (mid >= 100_000) {
    return { level: "high", note: "高価格帯。訴求次第" };
  }
  return { level: "ok", note: "日本CFで現実的な価格帯" };
}
