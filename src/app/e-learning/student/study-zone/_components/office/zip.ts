// Minimal ZIP reader for Office files (.pptx / .docx are ZIP archives of XML + media). Uses the browser's built-in
// DecompressionStream("deflate-raw"), so no library is needed. Handles what Office writes: stored and deflated
// entries, no ZIP64 (course files are capped at 8 MB), no encryption.

export interface ZipArchive {
  has(name: string): boolean;
  bytes(name: string): Promise<Uint8Array | null>;
  text(name: string): Promise<string | null>;
}

interface Entry { method: number; compressedSize: number; localOffset: number }

export function openZip(buffer: ArrayBuffer): ZipArchive {
  const view = new DataView(buffer);
  const u8 = new Uint8Array(buffer);

  // End of central directory: the last record with this signature (it may be followed by a comment).
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 22 - 65535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Not a ZIP file");

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const entries = new Map<string, Entry>();
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error("Corrupt ZIP directory");
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const name = decoder.decode(u8.subarray(p + 46, p + 46 + nameLen));
    entries.set(name, { method: view.getUint16(p + 10, true), compressedSize: view.getUint32(p + 20, true), localOffset: view.getUint32(p + 42, true) });
    p += 46 + nameLen + extraLen + commentLen;
  }

  async function bytes(name: string): Promise<Uint8Array | null> {
    const e = entries.get(name);
    if (!e) return null;
    const start = e.localOffset + 30 + view.getUint16(e.localOffset + 26, true) + view.getUint16(e.localOffset + 28, true);
    const data = u8.slice(start, start + e.compressedSize);
    if (e.method === 0) return data;
    if (e.method !== 8) throw new Error("Unsupported ZIP compression");
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  return {
    has: (name) => entries.has(name),
    bytes,
    text: async (name) => {
      const b = await bytes(name);
      return b ? decoder.decode(b) : null;
    },
  };
}
