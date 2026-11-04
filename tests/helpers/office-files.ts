// tests/helpers/office-files.ts
//
// Builds tiny but real .docx / .pptx files (ZIP archives of OOXML parts) in memory for extraction tests.

import { deflateRawSync } from "node:zlib";

function crc32(bytes: Uint8Array): number {
  let crc = ~0;
  for (const b of bytes) {
    crc ^= b;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

export function zip(entries: Record<string, string | Uint8Array>, { compress = true } = {}): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const raw = typeof content === "string" ? encoder.encode(content) : content;
    const data = compress ? deflateRawSync(raw) : Buffer.from(raw);
    const nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(compress ? 8 : 0, 8);
    local.writeUInt32LE(crc32(raw), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(compress ? 8 : 0, 10);
    central.writeUInt32LE(crc32(raw), 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, ...centrals, end]));
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function docx(paragraphs: string[]): Uint8Array {
  const body = paragraphs.map((p) => `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escape(p)}</w:t></w:r></w:p>`).join("");
  return zip({
    "[Content_Types].xml": "<Types/>",
    "word/document.xml": `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
  });
}

export function pptx(slides: { text: string[]; notes?: string[] }[]): Uint8Array {
  const part = (lines: string[]) => `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="x"><p:cSld>${lines.map((l) => `<a:p><a:r><a:t>${escape(l)}</a:t></a:r></a:p>`).join("")}</p:cSld></p:sld>`;
  const entries: Record<string, string> = { "[Content_Types].xml": "<Types/>" };
  slides.forEach((slide, i) => {
    entries[`ppt/slides/slide${i + 1}.xml`] = part(slide.text);
    if (slide.notes) entries[`ppt/notesSlides/notesSlide${i + 1}.xml`] = part([...slide.notes, String(i + 1)]);
  });
  return zip(entries);
}

export const pdf = (body = "study notes") => new TextEncoder().encode(`%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n% ${body}\n%%EOF\n`);
