import "../helpers/env";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { boundedStewartRequest } from "@/app/api/e-learning/stewart/shared";
import { GET } from "@/app/api/e-learning/pdfjs/[...asset]/route";
import { ServiceError } from "@/lib/service-error";

describe("Stewart request boundaries", () => {
  it("reads valid multipart bodies without modifying bytes", async () => {
    const form = new FormData();
    form.set("file", new File(["supporting notes"], "Lecture.txt"));
    const limited = await boundedStewartRequest(new Request("http://localhost/attachments", { method: "POST", body: form }), 4096);
    const parsed = await limited.formData();
    assert.equal(await (parsed.get("file") as File).text(), "supporting notes");
  });

  it("rejects oversized streamed bodies even when Content-Length is absent or false", async () => {
    for (const declared of [undefined, "1"]) {
      let cancelled = false;
      const body = new ReadableStream<Uint8Array>({
        pull(controller) { controller.enqueue(new Uint8Array(1024)); },
        cancel() { cancelled = true; },
      });
      const req = new Request("http://localhost/chat", { method: "POST", headers: declared ? { "content-length": declared } : {}, body, duplex: "half" } as RequestInit);
      await assert.rejects(boundedStewartRequest(req, 2048), (error: unknown) => error instanceof ServiceError && error.status === 413);
      assert.equal(cancelled, true);
    }
  });
});

describe("PDF.js public asset route", () => {
  it("serves the installed worker with the correct MIME and blocks other paths", async () => {
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ asset: ["build", "pdf.worker.min.mjs"] }) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "text/javascript");
    assert.ok((await response.text()).length > 1000);
    for (const asset of [["..", ".env"], ["build", "pdf.mjs"], ["cmaps", "../../.env"], ["build", "pdf.worker.min.mjs", "extra"]]) {
      assert.equal((await GET(new Request("http://localhost"), { params: Promise.resolve({ asset }) })).status, 404);
    }
  });
});
