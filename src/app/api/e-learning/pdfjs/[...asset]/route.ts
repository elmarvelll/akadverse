// Public library assets only; course documents still use the authenticated access route.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const requireModule = createRequire(import.meta.url);
export async function GET(_request: Request, { params }: { params: Promise<{ asset: string[] }> }) {
  const { asset } = await params;
  if (asset.length !== 2 || !["build", "cmaps", "standard_fonts", "wasm"].includes(asset[0]) || !/^[\w.-]+$/.test(asset[1]) || (asset[0] === "build" && asset[1] !== "pdf.worker.min.mjs")) return new Response(null, { status: 404 });
  try {
    const root = path.dirname(requireModule.resolve("pdfjs-dist/package.json"));
    const bytes = await readFile(path.join(root, ...asset));
    return new Response(bytes, { headers: { "Content-Type": asset[1].endsWith(".mjs") ? "text/javascript" : asset[1].endsWith(".wasm") ? "application/wasm" : "application/octet-stream", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response(null, { status: 404 }); }
}
