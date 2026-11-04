// Legacy binary Office files use compound streams, not OOXML ZIPs.
import * as CFB from "cfb";
import WordExtractor from "word-extractor";
import { badRequest } from "@/lib/service-error";
import { STEWART_MAX_EXTRACTED_CHARS } from "@/lib/stewart/config";

export async function extractLegacyOffice(kind: "doc" | "ppt", bytes: Uint8Array) {
  try {
    if (!Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) throw new Error("Not compound Office");
    let text: string;
    if (kind === "doc") {
      text = (await new WordExtractor().extract(Buffer.from(bytes))).getBody();
    } else {
      const compound = CFB.read(Buffer.from(bytes), { type: "buffer" });
      const stream = CFB.find(compound, "PowerPoint Document");
      if (!stream?.content) throw new Error("Missing presentation stream");
      const data = Buffer.from(stream.content);
      const parts: string[] = [];
      let records = 0;
      // MS-PPT record headers: containers contain records; TextCharsAtom and TextBytesAtom contain text.
      const walk = (start: number, end: number, depth: number) => {
        if (depth > 32) throw new Error("Nested presentation");
        for (let p = start; p + 8 <= end;) {
          if (++records > 100_000) throw new Error("Too many records");
          const options = data.readUInt16LE(p), type = data.readUInt16LE(p + 2), size = data.readUInt32LE(p + 4);
          const next = p + 8 + size;
          if (next > end) throw new Error("Corrupt record");
          if ((options & 15) === 15) walk(p + 8, next, depth + 1);
          else if (type === 4000 || type === 4008) parts.push(data.subarray(p + 8, next).toString(type === 4000 ? "utf16le" : "latin1"));
          p = next;
        }
      };
      walk(0, data.length, 0);
      text = parts.join("\n");
    }
    text = text.replace(/\u0000/g, "").trim();
    if (text.replace(/\s/g, "").length < 20) throw new Error("No readable text");
    return { text: text.slice(0, STEWART_MAX_EXTRACTED_CHARS), truncated: text.length > STEWART_MAX_EXTRACTED_CHARS };
  } catch {
    throw badRequest("We couldn't read that legacy Office file. It may be damaged or encrypted. Try exporting it as PDF.");
  }
}
