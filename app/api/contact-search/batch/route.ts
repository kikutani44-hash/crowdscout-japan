import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { parseContactFromWebsite } from "@/lib/contact-search";

export const maxDuration = 300;

export async function POST() {
  const supabase = createServerSupabase();

  // maker_website はあるが maker_email がない案件を取得（最大50件）
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, title, maker_website, maker_email")
    .not("maker_website", "is", null)
    .is("maker_email", null)
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!projects || projects.length === 0) {
    return NextResponse.json({ processed: 0, found: 0, message: "対象案件なし" });
  }

  let found = 0;
  const results: { id: string; email: string | null }[] = [];

  for (const project of projects) {
    try {
      const contacts = await parseContactFromWebsite(project.maker_website!);
      const patch: Record<string, string | null> = {};
      if (contacts.email) { patch.maker_email = contacts.email; found++; }
      if (contacts.contactFormUrl) patch.maker_contact_form = contacts.contactFormUrl;
      if (contacts.instagram) patch.maker_instagram = contacts.instagram;
      if (contacts.twitter) patch.maker_twitter = contacts.twitter;
      if (contacts.facebook) patch.maker_facebook = contacts.facebook;
      if (contacts.linkedin) patch.maker_linkedin = contacts.linkedin;

      if (Object.keys(patch).length > 0) {
        await supabase.from("projects").update(patch).eq("id", project.id);
      }
      results.push({ id: project.id, email: contacts.email });
    } catch {
      results.push({ id: project.id, email: null });
    }
  }

  return NextResponse.json({ processed: projects.length, found, results });
}
