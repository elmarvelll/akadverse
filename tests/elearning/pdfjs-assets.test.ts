import { it } from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { GET } from "../../src/app/api/e-learning/pdfjs/[...asset]/route";
const request = new Request("http://localhost/api/e-learning/pdfjs/build/pdf.worker.min.mjs");
it("serves the PDF worker with a JavaScript MIME type", async () => {
 const res = await GET(request, { params: Promise.resolve({ asset: ["build", "pdf.worker.min.mjs"] }) });
 assert.equal(res.status, 200);assert.equal(res.headers.get("content-type"), "text/javascript");assert.ok((await res.arrayBuffer()).byteLength > 100000);
});
it("serves packaged font, character-map and wasm resources", async () => {
 for (const directory of ["cmaps", "standard_fonts", "wasm"]) {
  const file=(await readdir(path.join(process.cwd(),"node_modules/pdfjs-dist",directory))).find(name=> /\.(bcmap|pfb|ttf|wasm)$/.test(name));assert.ok(file);
  const res=await GET(request,{params:Promise.resolve({asset:[directory,file]})});assert.equal(res.status,200);assert.ok((await res.arrayBuffer()).byteLength>0);
 }
});
it("rejects paths outside the public asset allowlist", async () => {
 for(const asset of [["build","pdf.mjs"],["..","package.json"],["cmaps","../package.json"],["build","nested","pdf.worker.min.mjs"]])assert.equal((await GET(request,{params:Promise.resolve({asset})})).status,404);
});
