import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);

import { isServerlessRuntime, pythonUnavailableResponse } from "@/lib/serverless-runtime";

export async function POST(request: Request) {
  if (isServerlessRuntime()) {
    return NextResponse.json(pythonUnavailableResponse("Indiegogoクロール"), { status: 503 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const max = String(body.max ?? 15);

    const scriptPath = path.join(process.cwd(), "scripts", "crawl_indiegogo.py");
    const { stdout, stderr } = await execFileAsync("python3", [scriptPath, "--max", max], {
      cwd: process.cwd(),
      timeout: 15 * 60 * 1000,
      env: process.env,
    });

    return NextResponse.json({
      ok: true,
      platform: "indiegogo",
      stdout: stdout.slice(-4000),
      stderr: stderr.slice(-1000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "クロールに失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
