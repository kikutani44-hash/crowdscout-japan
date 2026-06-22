/** Returns true when running on Vercel serverless (Python scripts unavailable). */
export function isVercelRuntime(): boolean {
  return Boolean(process.env.VERCEL);
}

export function pythonUnavailableResponse(feature: string) {
  return {
    error: `${feature} は Vercel 本番環境では利用できません。ローカルで Python スクリプトを実行するか、Supabase 連携後にデータを同期してください。`,
    vercel: true,
  };
}
