// Minimal test — no external dependencies
exports.handler = async (event) => {
  console.log("FUNCTION_STARTED:", new Date().toISOString());
  console.log("EVENT_BODY:", event.body || "(no body)");
  console.log("ENV_CHECK:", {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
  });
  return { statusCode: 202, body: "ok" };
};
