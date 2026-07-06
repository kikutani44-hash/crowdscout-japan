// Test: Supabase import only — to isolate which package causes "Node.js 20 detect" error
import { createClient } from "@supabase/supabase-js";

export const handler = async (event) => {
  console.log("MJS_STARTED:", new Date().toISOString());

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );

    const { error } = await supabase.from("reports").upsert({
      project_id: "test-ping",
      status: "generating",
      error: "started:" + new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("SUPABASE_ERROR:", JSON.stringify(error));
    } else {
      console.log("SUPABASE_WRITE_OK");
    }
  } catch (e) {
    console.error("CATCH_ERROR:", e.message);
  }
};
