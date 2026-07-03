export async function sendChatworkNotification(message: string): Promise<void> {
  const apiToken = process.env.CHATWORK_API_TOKEN;
  const roomId = process.env.CHATWORK_ROOM_ID ?? "441627252";
  if (!apiToken) return;

  await fetch(`https://api.chatwork.com/v2/rooms/${roomId}/messages`, {
    method: "POST",
    headers: {
      "X-ChatWorkToken": apiToken,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `body=${encodeURIComponent(message)}`,
  });
}

export function formatNewProjectsMessage(projects: Array<{ title: string; score: number; raisedUsd: number }>): string {
  const threshold = parseInt(process.env.CHATWORK_SCORE_THRESHOLD ?? "80", 10);
  const high = projects.filter((p) => p.score >= threshold);
  if (high.length === 0) return "";

  const lines = high.map(
    (p) => `・[${p.score}点] ${p.title} ($${p.raisedUsd.toLocaleString()})`
  );
  return `[info][title]🔥 CrowdJARVIS: 高スコア新着案件 ${high.length}件[/title]${lines.join("\n")}[/info]`;
}

export function formatReplyAlertMessage(projectTitle: string, makerEmail: string): string {
  return `[info][title]✉️ CrowdJARVIS: メーカーから返信あり[/title]案件: ${projectTitle}\n差出人: ${makerEmail}[/info]`;
}

export function formatCrawlCompleteMessage(total: number, newCount: number): string {
  return `[info][title]✅ CrowdJARVIS: クロール完了[/title]総案件数: ${total}件\n新着案件: ${newCount}件[/info]`;
}
