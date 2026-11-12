import "../helpers/env";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { docx, pdf, pptx, zip } from "../helpers/office-files";
import { extractText } from "@/services/e-learning/student/stewart/extract-text";
import { normalizeHistory } from "@/services/e-learning/student/stewart/chat";
import { cleanAttachmentName, validateAttachment } from "@/services/e-learning/student/stewart/validate-attachment";
import { checkStewartAttachment, STEWART_MAX_ATTACHMENT_BYTES } from "@/lib/stewart/config";
import { ServiceError } from "@/lib/service-error";
const status = (code: number) => (e: unknown) => e instanceof ServiceError && e.status === code;

describe("Concept Explainer file validation", () => {
  it("accepts all eight supported formats and rejects legacy Office, empty and oversized files", () => {
    for (const name of ["a.pdf", "a.docx", "a.pptx", "a.txt", "a.md", "a.png", "a.jpg", "a.jpeg", "a.webp"]) assert.equal(checkStewartAttachment(name, 1), null);
    for (const name of ["a.doc", "a.ppt", "a.exe", "a.zip", "a.xlsx", "constructor", "__proto__"]) assert.ok(checkStewartAttachment(name, 1));
    assert.match(checkStewartAttachment("a.txt", 0)!, /empty/);
    assert.match(checkStewartAttachment("a.txt", STEWART_MAX_ATTACHMENT_BYTES + 1)!, /too large/);
    assert.equal(checkStewartAttachment("a.txt", STEWART_MAX_ATTACHMENT_BYTES), null);
  });
  it("validates contents and canonicalizes MIME without changing document bytes", async () => {
    for (const [name, bytes, mime] of [["a.pdf", pdf(), "application/pdf"], ["a.docx", docx(["A paragraph"]), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], ["a.pptx", pptx([{ text: ["A slide"] }]), "application/vnd.openxmlformats-officedocument.presentationml.presentation"], ["a.txt", new TextEncoder().encode("x"), "text/plain"], ["a.md", new TextEncoder().encode("# Note"), "text/markdown"]] as const) {
      const file = await validateAttachment(new File([new Uint8Array(bytes)], name, { type: "application/octet-stream" }));
      assert.equal(file.type, mime);
      assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes);
    }
  });
  it("decodes PNG, JPEG and WEBP, preserving original image bytes", async () => {
    for (const format of ["png", "jpeg", "webp"] as const) {
      const bytes = await sharp({ create: { width: 30, height: 20, channels: 3, background: "white" } }).toFormat(format).toBuffer();
      const file = await validateAttachment(new File([new Uint8Array(bytes)], `equation.${format}`));
      assert.equal(file.type, `image/${format}`);
      assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
      await assert.rejects(validateAttachment(new File([new Uint8Array(bytes)], format === "png" ? "fake.jpg" : "fake.png")), status(422));
    }
  });
  it("rejects forged MIME/extension, invalid UTF-8, corrupt archives, zip bombs and empty files", async () => {
    const cases = [new File(["text"], "fake.pdf", { type: "application/pdf" }), new File([new Uint8Array(pdf())], "binary.txt"), new File([new Uint8Array([255, 0])], "bad.md"), new File([new Uint8Array(pptx([{ text: ["slide"] }]))], "wrong.docx"), new File(["text"], "bad.png"), new File([], "empty.pdf"), new File([new Uint8Array(zip({ "[Content_Types].xml": "<Types/>", "word/document.xml": new Uint8Array(24 * 1024 * 1024) }))], "bomb.docx")];
    for (const file of cases) await assert.rejects(validateAttachment(file), status(422));
    await assert.rejects(validateAttachment(new File([new Uint8Array(STEWART_MAX_ATTACHMENT_BYTES + 1)], "large.pdf")), status(413));
  });
  it("sanitizes filenames", () => {
    assert.equal(cleanAttachmentName("../../etc/passwd.txt"), "passwd.txt");
    assert.equal(cleanAttachmentName("C:\\Users\\me\\notes.pdf"), "notes.pdf");
    assert.equal(cleanAttachmentName("a\0b.pdf"), "ab.pdf");
  });
});
describe("existing extraction and chat regression", () => {
  it("preserves bounded OOXML extraction", () => {
    assert.equal(extractText("docx", docx(["A complete paragraph explaining recursion."])).text, "A complete paragraph explaining recursion.");
    assert.match(extractText("pptx", pptx([{ text: ["A slide explaining recursion."], notes: ["Explain the base case."] }])).text, /Speaker notes/);
    assert.throws(() => extractText("docx", zip({ "word/document.xml": new Uint8Array(24 * 1024 * 1024) })), status(400));
  });
  it("validates questions and preserves recent conversational turns", () => {
    assert.deepEqual(normalizeHistory([{ role: "student", text: " Explain recursion " }]), [{ role: "student", text: "Explain recursion" }]);
    for (const raw of [null, [], [{ role: "system", text: "x" }], [{ role: "student", text: "x".repeat(4001) }], [{ role: "stewart", text: "x" }]]) assert.throws(() => normalizeHistory(raw), status(400));
  });
});
