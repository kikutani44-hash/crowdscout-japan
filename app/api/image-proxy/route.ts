import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = ["assets.zeczec.com", "zeczec.com", "www.zeczec.com"];

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
    return NextResponse.json({ error: "host not allowed" }, { status: 400 });
  }

  const upstream = await fetch(parsed.toString(), {
    headers: {
      Referer: "https://www.zeczec.com/",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    },
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "upstream fetch failed" }, { status: upstream.status });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
