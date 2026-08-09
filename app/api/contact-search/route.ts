import { NextRequest, NextResponse } from "next/server";
import { searchMakerContacts } from "@/lib/contact-search";
import { createServerSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { projectId, title, existingWebsite, campaignUrl } = await req.json() as {
    projectId: string;
    title: string;
    existingWebsite?: string | null;
    campaignUrl?: string | null;
  };

  if (!projectId || !title) {
    return NextResponse.json({ error: "projectId and title required" }, { status: 400 });
  }

  try {
    const result = await searchMakerContacts(title, existingWebsite, campaignUrl);

    // Supabase に自動保存
    if (result.source !== "none") {
      const supabase = createServerSupabase();
      const patch: Record<string, string | null> = {};

      if (result.officialUrl && !existingWebsite) patch.maker_website = result.officialUrl;
      if (result.email) patch.maker_email = result.email;
      if (result.contactFormUrl) patch.maker_contact_form = result.contactFormUrl;
      if (result.instagram) patch.maker_instagram = result.instagram;
      if (result.twitter) patch.maker_twitter = result.twitter;
      if (result.facebook) patch.maker_facebook = result.facebook;
      if (result.linkedin) patch.maker_linkedin = result.linkedin;

      if (Object.keys(patch).length > 0) {
        await supabase.from("projects").update(patch).eq("id", projectId);
      }
    }

    return NextResponse.json({ success: true, result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
