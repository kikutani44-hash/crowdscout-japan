/** Returns true on Netlify/Vercel serverless where Python scripts are unavailable. */
export function isServerlessRuntime(): boolean {
  return Boolean(process.env.NETLIFY || process.env.VERCEL);
}

export function pythonUnavailableResponse(feature: string) {
  return {
    error: `${feature} は Netlify 本番環境では利用できません。ローカルで Python スクリプトを実行するか、Supabase 連携後にデータを同期してください。`,
    serverless: true,
  };
}
