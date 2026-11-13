// Public library assets only; course documents still use the authenticated access route.
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
// Explicitly packaged by outputFileTracingIncludes in next.config.ts.
const assetRoot = path.join(process.cwd(), "node_modules", "pdfjs-dist");
export async function GET(_request: Request, { params }: { params: Promise<{ asset: string[] }> }) {
  const { asset } = await params;
  if (asset.length !== 2 || !["build", "cmaps", "standard_fonts", "wasm"].includes(asset[0]) || !/^[\w.-]+$/.test(asset[1]) || (asset[0] === "build" && asset[1] !== "pdf.worker.min.mjs")) return new Response(null, { status: 404 });
  try {
    const bytes = await readFile(path.join(assetRoot, ...asset));
    return new Response(bytes, { headers: { "Content-Type": asset[1].endsWith(".mjs") ? "text/javascript" : asset[1].endsWith(".wasm") ? "application/wasm" : "application/octet-stream", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (asset[0] === "build" || (code !== "ENOENT" && code !== "EISDIR")) {
      console.error("[pdfjs-assets] Failed to read packaged asset", { asset: asset.join("/"), code });
      return new Response("PDF viewer assets are unavailable.", { status: 503 });
    }
    return new Response(null, { status: 404 });
  }
}
