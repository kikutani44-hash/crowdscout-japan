export type ActivityAction =
  | "translate"
  | "cf_check"
  | "market_analysis"
  | "offer_open"
  | "status_change"
  | "view_pipeline"
  | "external_link"
  | "page_view"
  | "card_click"
  | "filter_use";

export async function logActivity(
  token: string | null,
  action: ActivityAction,
  opts?: {
    projectId?: string;
    projectTitle?: string;
    metadata?: Record<string, unknown>;
  }
) {
  if (!token) return;
  fetch("/api/activity-log", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action,
      projectId: opts?.projectId,
      projectTitle: opts?.projectTitle,
      metadata: opts?.metadata,
    }),
  }).catch(() => {});
}
