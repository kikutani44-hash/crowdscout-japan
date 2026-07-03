export function parseAnthropicError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes("credit balance") || msg.includes("billing")) {
    return "Anthropic APIのクレジット残高が不足しています。console.anthropic.com → Billing でチャージしてください。";
  }
  if (msg.includes("invalid_api_key") || msg.includes("authentication")) {
    return "APIキーが無効です。Vercelの環境変数 ANTHROPIC_API_KEY を確認してください。";
  }
  if (msg.includes("rate_limit")) {
    return "API利用制限に達しました。しばらく待ってから再試行してください。";
  }
  if (msg.includes("overloaded") || msg.includes("529")) {
    return "Anthropic APIが混雑しています。しばらく待ってから再試行してください。";
  }

  // Strip raw JSON from error messages like "400 {...}"
  const jsonMatch = msg.match(/\{.*"message"\s*:\s*"([^"]+)"/s);
  if (jsonMatch) return jsonMatch[1];

  return msg || "エラーが発生しました。再試行してください。";
}
