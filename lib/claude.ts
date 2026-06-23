import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
});

export async function translateToJapanese(title: string, subtitle: string): Promise<{
  title_ja: string;
  subtitle_ja: string;
}> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      title_ja: `【翻訳デモ】${title}`,
      subtitle_ja: `【翻訳デモ】${subtitle.slice(0, 120)}...`,
    };
  }

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `以下のクラウドファンディング商品情報を自然な日本語に翻訳してください。JSON形式で返してください。

{"title_ja": "...", "subtitle_ja": "..."}

title: ${title}
subtitle: ${subtitle}`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("翻訳結果の解析に失敗しました");
  }

  return JSON.parse(jsonMatch[0]) as { title_ja: string; subtitle_ja: string };
}
