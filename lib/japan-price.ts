/**
 * 海外クラファン価格から「日本でいくらで売ることになるか」を概算する。
 *
 * 従来はこの数字を市場分析（Sonnet）で毎回生成していたが、
 * 計算で出せる内容なのでAIを使わずに常時表示する。クレジット消費ゼロ。
 *
 * ■ 前提となるビジネスモデル
 * ブリンクジャパンは代理店として小売価格で仕入れるのではなく、
 * 日本の独占権を取得してメーカーから「卸値」で仕入れる。
 * したがって出発点は海外の小売価格ではなく、そこから卸掛率を掛けた金額。
 *
 *   海外CF価格 22万円
 *     → 卸値（30〜50%）      6.6万〜11万円
 *     → 送料・関税・認証      上乗せ
 *     → CF手数料（約20%）     上乗せ
 *     → 自社利益              上乗せ
 *     → 日本CF価格           16万〜27万円
 *
 * ■ 精度について
 * 卸掛率は交渉次第で大きく動くため、あくまで一次スクリーニング用。
 * 「桁を見て見送るかどうか」の判断に留め、実際の条件は交渉で確認すること。
 */

/** 想定為替レート。既存コード（lib/claude.ts の日本向けページ生成）と揃えている。 */
export const USD_JPY = Number(process.env.NEXT_PUBLIC_USD_JPY ?? 150);

/**
 * 海外CF小売価格に対する卸掛率。
 * 理想的な条件で30%、現実的な着地点として50%を見込む。
 * 実際の掛率は交渉とロット次第。
 */
export const WHOLESALE_RATE_BEST = 0.3;
export const WHOLESALE_RATE_TYPICAL = 0.5;

/**
 * 卸値から日本CF販売価格までの倍率。
 * 国際送料・関税・認証取得（PSE/技適等）・CF手数料（約20%）・
 * 広告費・自社利益を含む。
 */
export const LANDED_MULTIPLE = 2.5;

export interface JapanPriceEstimate {
  /** 海外での1人あたり平均支援額（USD） */
  avgPledgeUsd: number;
  /** 同（円換算）＝海外CF小売価格の目安 */
  overseasJpy: number;
  /** 想定卸値レンジ（円） */
  wholesaleLow: number;
  wholesaleHigh: number;
  /** 日本CFでの想定販売価格レンジ（円） */
  jpyLow: number;
  jpyHigh: number;
  /** カード上での短縮表示「16.5万円〜27.5万円」 */
  shortLabel: string;
  /** 卸値の表示用「6.6万円〜11.0万円」 */
  wholesaleLabel: string;
  /** 海外価格の表示用 */
  overseasLabel: string;
}

/** 円を「55万円」「1,200万円」のように読みやすく整形する。 */
export function formatJpy(value: number): string {
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

  const overseasJpy = avgPledgeUsd * USD_JPY;

  // 卸値（掛率が低いほど有利なので low = 理想条件）
  const wholesaleLow = overseasJpy * WHOLESALE_RATE_BEST;
  const wholesaleHigh = overseasJpy * WHOLESALE_RATE_TYPICAL;

  const jpyLow = wholesaleLow * LANDED_MULTIPLE;
  const jpyHigh = wholesaleHigh * LANDED_MULTIPLE;

  return {
    avgPledgeUsd,
    overseasJpy,
    wholesaleLow,
    wholesaleHigh,
    jpyLow,
    jpyHigh,
    shortLabel: `${formatJpy(jpyLow)}〜${formatJpy(jpyHigh)}`,
    wholesaleLabel: `${formatJpy(wholesaleLow)}〜${formatJpy(wholesaleHigh)}`,
    overseasLabel: formatJpy(overseasJpy),
  };
}

/**
 * 日本CFで現実的に売れる価格帯かどうかのざっくり判定。
 *
 * 足切りではなく目安。卸掛率は交渉で動くため、
 * 高額でもまずアプローチして条件を聞く価値はある。
 */
export function japanPriceVerdict(
  estimate: JapanPriceEstimate | null,
): { level: "ok" | "high" | "very-high"; note: string } | null {
  if (!estimate) return null;
  const mid = (estimate.jpyLow + estimate.jpyHigh) / 2;
  if (mid >= 300_000) {
    return { level: "very-high", note: "高額。条件次第" };
  }
  if (mid >= 100_000) {
    return { level: "high", note: "高価格帯" };
  }
  return { level: "ok", note: "現実的な価格帯" };
}
