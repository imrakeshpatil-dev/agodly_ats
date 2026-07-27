import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const script = await readFile(path.join(process.cwd(), "app.js"), "utf8");

  return new Response(script, {
    headers: {
      "cache-control": "no-store",
      "content-type": "application/javascript; charset=utf-8"
    }
  });
}
