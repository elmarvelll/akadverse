import { ServiceError } from "@/lib/service-error";
import { checkStewartAttachment, extensionOfFile, isStewartImage, STEWART_ATTACHMENT_TYPES, type StewartAttachmentKind } from "@/lib/stewart/config";
import { looksLikePdf, openZip } from "./extract-text";

export function cleanAttachmentName(name: string) {
  return (name.split(/[\\/]/).pop() || "attachment").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120) || "attachment";
}
// Validate bytes independently of browser MIME; forward original bytes with a canonical, supported MIME.
export async function validateAttachment(file: File): Promise<File> {
  const name = cleanAttachmentName(file.name);
  const problem = checkStewartAttachment(name, file.size);
  if (problem) throw new ServiceError(file.size > 4 * 1024 * 1024 ? 413 : 422, problem);
  const kind = extensionOfFile(name) as StewartAttachmentKind;
  const mime = STEWART_ATTACHMENT_TYPES[kind].mime[0];
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    if (kind === "pdf") { if (!looksLikePdf(bytes)) throw new Error(); }
    else if (isStewartImage(kind)) {
      const { default: sharp } = await import("sharp");
      const image = sharp(bytes, { limitInputPixels: 25_000_000, animated: false });
      const meta = await image.metadata();
      if (meta.format !== (kind === "jpg" ? "jpeg" : kind)) throw new Error();
      await image.stats();
    } else if (kind === "docx" || kind === "pptx") {
      const zip = openZip(bytes);
      if (!zip.text("[Content_Types].xml") || !(kind === "docx" ? zip.text("word/document.xml") : zip.names().some((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)))) throw new Error();
      // Bound decompression of every XML part before forwarding an untrusted archive.
      for (const name of zip.names()) if (name.endsWith(".xml")) zip.text(name);
    } else {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (text.includes("\0") || !text.trim() || looksLikePdf(bytes) || (bytes[0] === 0x50 && bytes[1] === 0x4b)) throw new Error();
    }
  } catch { throw new ServiceError(422, "The file contents do not match a readable supported format. Try exporting it again."); }
  return new File([bytes], name, { type: mime });
}
