import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);

import { isVercelRuntime, pythonUnavailableResponse } from "@/lib/vercel-runtime";

export async function POST(request: Request) {
  if (isVercelRuntime()) {
    return NextResponse.json(pythonUnavailableResponse("日本CF一括チェック"), { status: 503 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const limit = String(body.limit ?? 0);
    const force = body.force ? "--force" : "";

    const scriptPath = path.join(process.cwd(), "scripts", "batch_check_japan_cf.py");
    const args = [scriptPath];
    if (limit !== "0") args.push("--limit", limit);
    if (force) args.push(force);

    const { stdout, stderr } = await execFileAsync("python3", args, {
      cwd: process.cwd(),
      timeout: 30 * 60 * 1000,
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });

    return NextResponse.json({
      ok: true,
      result: JSON.parse(stdout.trim() || "{}"),
      stderr: stderr.slice(-2000),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "一括チェックに失敗しました" },
      { status: 500 }
    );
  }
}
