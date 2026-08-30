/**
 * オファー送信後のフォローアップ判定。
 *
 * ■ 設計の考え方
 *   先方のフォームに「2〜3営業日で回答」と書かれていても、実際には守られない。
 *   海外メーカーの問い合わせフォームはサポート窓口に届くことが多く、
 *   事業開発の担当者まで回るのに時間がかかる。
 *   そのため相手が言った期限を締切として扱わず、
 *   こちらの行動を切り替える目安として段階を持たせる。
 *
 *   また日数は「営業日」で数える。
 *   金曜に送って月曜に「3日経過」と出るのは実態に合わないため。
 *   （先方の祝日までは考慮しない。土日のみ除外する）
 */

export type FollowUpStage = "waiting" | "nudge" | "retry" | "stale";

export interface FollowUpJudgement {
  stage: FollowUpStage;
  businessDays: number;
  calendarDays: number;
  label: string;
  /** 次に取るべき行動 */
  action: string;
}

/** 土日を除いた経過日数。送信当日は0とする。 */
export function businessDaysSince(sentAt: string | null, now = new Date()): number | null {
  if (!sentAt) return null;
  const start = new Date(sentAt);
  if (Number.isNaN(start.getTime())) return null;

  let count = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);

  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

export function calendarDaysSince(sentAt: string | null, now = new Date()): number | null {
  if (!sentAt) return null;
  const start = new Date(sentAt);
  if (Number.isNaN(start.getTime())) return null;
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
}

/**
 * 段階の区切り（営業日）
 *   0〜4   返信待ち     … まだ催促しない。相手の社内で回っている時間
 *   5〜9   そろそろ確認 … 約1〜2週間。別経路での短い確認を検討する
 *   10〜19 別経路を試す … フォームが届いていない可能性。メール等に切り替える
 *   20〜   見送り検討   … 約1ヶ月。優先度を下げる
 */
export function judgeFollowUp(sentAt: string | null, now = new Date()): FollowUpJudgement | null {
  const businessDays = businessDaysSince(sentAt, now);
  const calendarDays = calendarDaysSince(sentAt, now);
  if (businessDays === null || calendarDays === null) return null;

  if (businessDays >= 20) {
    return {
      stage: "stale",
      businessDays,
      calendarDays,
      label: "見送り検討",
      action: "1ヶ月以上返信がありません。優先度を下げるか、却下に変更してください",
    };
  }
  if (businessDays >= 10) {
    return {
      stage: "retry",
      businessDays,
      calendarDays,
      label: "別経路を試す",
      action: "フォームが届いていない可能性があります。メールなど別の窓口を試してください",
    };
  }
  if (businessDays >= 5) {
    return {
      stage: "nudge",
      businessDays,
      calendarDays,
      label: "そろそろ確認",
      action: "短いフォローアップを送る頃合いです",
    };
  }
  return {
    stage: "waiting",
    businessDays,
    calendarDays,
    label: "返信待ち",
    action: "まだ催促しません",
  };
}

export function followUpStageClass(stage: FollowUpStage): string {
  switch (stage) {
    case "stale":
      return "border-red-500/30 bg-red-500/5";
    case "retry":
      return "border-orange-500/30 bg-orange-500/5";
    case "nudge":
      return "border-amber-500/30 bg-amber-500/5";
    case "waiting":
      return "border-border bg-secondary/10";
  }
}

export function followUpBadgeClass(stage: FollowUpStage): string {
  switch (stage) {
    case "stale":
      return "text-red-400";
    case "retry":
      return "text-orange-400";
    case "nudge":
      return "text-amber-400";
    case "waiting":
      return "text-muted-foreground";
  }
}
