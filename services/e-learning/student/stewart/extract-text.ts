// services/e-learning/student/stewart/extract-text.ts
//
// Turns an uploaded study document into text the model can read. Server-only, no third-party parser:
//   .txt / .md — decoded as UTF-8.
//   .docx      — the document body's paragraphs (word/document.xml), in order.
//   .pptx      — each slide's text, then its speaker notes, labelled "Slide N".
//   .pdf       — NOT parsed here; the model reads PDFs natively (see upload-attachment.ts). Only its signature is checked.
//
// Uploaded files are untrusted input, so:
//  - the real format is checked from the file's own bytes, never just its name;
//  - .docx/.pptx are ZIP archives and are inflated with a hard output cap per entry and in total, so a "zip bomb"
//    can't exhaust memory;
//  - output is capped at STEWART_MAX_EXTRACTED_CHARS, and the caller is told when that happened.
// Not extracted: images, charts, SmartArt, headers/footers, footnotes, tracked changes, embedded files. A document
// that is only scanned images therefore yields no text and is reported as unreadable rather than sent empty.

import { inflateRawSync } from "node:zlib";
import { badRequest } from "@/lib/service-error";
import { STEWART_MAX_EXTRACTED_CHARS, type StewartAttachmentKind } from "@/lib/stewart/config";

const MAX_ENTRY_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
const MAX_SLIDES = 500;

export interface ExtractedText {
  text: string;
  // True when the document was longer than the limit and only the beginning is included.
  truncated: boolean;
}

const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((b, i) => bytes[i] === b);
export const looksLikePdf = (bytes: Uint8Array) => startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const looksLikeZip = (bytes: Uint8Array) => startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04

// Minimal, bounded ZIP reader (stored + deflate entries; no ZIP64, no encryption — what Office writes).
function openZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.byteLength - 22; i >= Math.max(0, bytes.byteLength - 22 - 65535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const entries = new Map<string, { method: number; compressedSize: number; localOffset: number }>();
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (p + 46 > bytes.byteLength || view.getUint32(p, true) !== 0x02014b50) throw new Error("corrupt zip");
    const nameLen = view.getUint16(p + 28, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    entries.set(name, { method: view.getUint16(p + 10, true), compressedSize: view.getUint32(p + 20, true), localOffset: view.getUint32(p + 42, true) });
    p += 46 + nameLen + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
  }
  let total = 0;
  return {
    names: () => Array.from(entries.keys()),
    text(name: string): string | null {
      const e = entries.get(name);
      if (!e) return null;
      const start = e.localOffset + 30 + view.getUint16(e.localOffset + 26, true) + view.getUint16(e.localOffset + 28, true);
      const data = bytes.subarray(start, start + e.compressedSize);
      let out: Uint8Array;
      if (e.method === 0) out = data;
      else if (e.method === 8) out = inflateRawSync(data, { maxOutputLength: MAX_ENTRY_BYTES });
      else throw new Error("unsupported compression");
      total += out.byteLength;
      if (out.byteLength > MAX_ENTRY_BYTES || total > MAX_TOTAL_BYTES) throw new Error("archive too large");
      return decoder.decode(out);
    },
  };
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decodeEntities = (s: string) =>
  s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return ENTITIES[body] ?? whole;
  });

// Text of every <prefix:p> paragraph in an OOXML part: its <prefix:t> runs joined, tabs/line breaks kept.
function paragraphs(xml: string, prefix: "w" | "a"): string[] {
  const out: string[] = [];
  const paragraph = new RegExp(`<${prefix}:p[ >][\\s\\S]*?</${prefix}:p>`, "g");
  const piece = new RegExp(`<${prefix}:t(?: [^>]*)?>([\\s\\S]*?)</${prefix}:t>|<${prefix}:(tab|br|cr)(?: [^>]*)?/>`, "g");
  for (const block of xml.match(paragraph) ?? []) {
    let line = "";
    for (const m of block.matchAll(piece)) line += m[1] !== undefined ? decodeEntities(m[1]) : m[2] === "tab" ? "\t" : "\n";
    if (line.trim()) out.push(line.trim());
  }
  return out;
}

function docxText(zip: ReturnType<typeof openZip>): string {
  const body = zip.text("word/document.xml");
  if (body === null) throw new Error("not a docx");
  return paragraphs(body, "w").join("\n");
}

function pptxText(zip: ReturnType<typeof openZip>): string {
  const slideNumbers = zip
    .names()
    .map((name) => /^ppt\/slides\/slide(\d+)\.xml$/.exec(name)?.[1])
    .filter((n): n is string => Boolean(n))
    .map(Number)
    .sort((a, b) => a - b)
    .slice(0, MAX_SLIDES);
  if (slideNumbers.length === 0) throw new Error("not a pptx");
  const parts: string[] = [];
  for (const n of slideNumbers) {
    const slide = paragraphs(zip.text(`ppt/slides/slide${n}.xml`) ?? "", "a");
    const notesXml = zip.text(`ppt/notesSlides/notesSlide${n}.xml`);
    // The notes part repeats the slide number as its own paragraph — drop bare numbers.
    const notes = notesXml ? paragraphs(notesXml, "a").filter((line) => !/^\d+$/.test(line)) : [];
    if (slide.length === 0 && notes.length === 0) continue;
    parts.push([`Slide ${n}`, ...slide, ...(notes.length ? ["Speaker notes:", ...notes] : [])].join("\n"));
  }
  return parts.join("\n\n");
}

export function extractText(kind: Exclude<StewartAttachmentKind, "pdf">, bytes: Uint8Array): ExtractedText {
  let text: string;
  if (kind === "txt" || kind === "md") {
    if (looksLikePdf(bytes) || looksLikeZip(bytes) || bytes.subarray(0, 4096).includes(0)) {
      throw badRequest("That doesn't look like a text file. Attach it with its real file type.");
    }
    text = new TextDecoder("utf-8").decode(bytes);
  } else {
    if (!looksLikeZip(bytes)) throw badRequest(`That file isn't a valid ${kind === "docx" ? "Word" : "PowerPoint"} document.`);
    try {
      const zip = openZip(bytes);
      text = kind === "docx" ? docxText(zip) : pptxText(zip);
    } catch {
      throw badRequest(`We couldn't read that ${kind === "docx" ? "Word document" : "presentation"}. It may be damaged, password-protected, or saved in an older format — try exporting it as PDF.`);
    }
  }

  // Normalise whitespace noise without changing meaning.
  text = text.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
  if (text.replace(/\s/g, "").length < 20) {
    throw badRequest("We couldn't find any readable text in that file. If it's made of scanned pages or images, try a PDF or a text version.");
  }
  if (text.length > STEWART_MAX_EXTRACTED_CHARS) return { text: text.slice(0, STEWART_MAX_EXTRACTED_CHARS), truncated: true };
  return { text, truncated: false };
}
