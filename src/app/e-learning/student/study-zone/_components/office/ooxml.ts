// Small helpers shared by the PowerPoint and Word readers. Elements are matched by local name, so the namespace
// prefixes a file happens to use (p:, a:, w:, ...) don't matter.

import type { ZipArchive } from "./zip";

const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

export function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, "application/xml");
}

export const kids = (el: Element | null | undefined, name: string): Element[] => (el ? [...el.children].filter((c) => c.localName === name) : []);
export const kid = (el: Element | null | undefined, name: string): Element | null => kids(el, name)[0] ?? null;
// First descendant along a path of local names, e.g. path(sp, "nvSpPr", "nvPr", "ph").
export const path = (el: Element | null | undefined, ...names: string[]): Element | null => names.reduce<Element | null>((e, n) => kid(e, n), el ?? null);
export const desc = (el: Element | Document | null | undefined, name: string): Element[] => (el ? [...el.getElementsByTagNameNS("*", name)] : []);
export const attr = (el: Element | null | undefined, name: string): string | null => el?.getAttribute(name) ?? null;
export const num = (el: Element | null | undefined, name: string): number | null => {
  const v = attr(el, name);
  return v === null || v === "" || Number.isNaN(Number(v)) ? null : Number(v);
};
// r:id / r:embed attributes.
export const relAttr = (el: Element | null | undefined, name: string): string | null => el?.getAttributeNS(R_NS, name) || el?.getAttribute(`r:${name}`) || null;

export async function readXml(zip: ZipArchive, name: string): Promise<Document | null> {
  const text = await zip.text(name);
  return text ? parseXml(text) : null;
}

// "ppt/slides/slide1.xml" + "../media/image1.png" -> "ppt/media/image1.png"
export function resolvePath(fromFile: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = fromFile.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

// Relationship id -> absolute part name, for one part (from its _rels/<name>.rels file).
export async function readRels(zip: ZipArchive, part: string): Promise<Map<string, { target: string; type: string }>> {
  const dir = part.split("/").slice(0, -1).join("/");
  const file = part.split("/").pop();
  const doc = await readXml(zip, `${dir ? `${dir}/` : ""}_rels/${file}.rels`);
  const rels = new Map<string, { target: string; type: string }>();
  for (const r of desc(doc, "Relationship")) {
    if (attr(r, "TargetMode") === "External") continue;
    rels.set(attr(r, "Id") ?? "", { target: resolvePath(part, attr(r, "Target") ?? ""), type: attr(r, "Type") ?? "" });
  }
  return rels;
}

const IMAGE_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp", svg: "image/svg+xml", webp: "image/webp" };

// A blob: URL for an image part; null for formats browsers can't show (EMF/WMF/TIFF). Callers revoke the URLs.
export async function imageUrl(zip: ZipArchive, part: string, created: string[]): Promise<string | null> {
  const type = IMAGE_TYPES[part.split(".").pop()?.toLowerCase() ?? ""];
  if (!type) return null;
  const data = await zip.bytes(part);
  if (!data) return null;
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  created.push(url);
  return url;
}

// Only plain hex reaches a style attribute.
export const hex = (v: string | null | undefined): string | null => (v && /^[0-9a-fA-F]{6}$/.test(v) ? `#${v}` : null);

// Lightness adjustments Office applies to theme colours (e.g. "Accent 1, 40% lighter").
export function adjustColor(color: string, el: Element): string {
  const lumMod = num(kid(el, "lumMod"), "val");
  const lumOff = num(kid(el, "lumOff"), "val");
  const tint = num(kid(el, "tint"), "val");
  const shade = num(kid(el, "shade"), "val");
  if (lumMod === null && lumOff === null && tint === null && shade === null) return color;
  let [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
  if (shade !== null) [r, g, b] = [r, g, b].map((c) => c * (shade / 100000));
  if (tint !== null) [r, g, b] = [r, g, b].map((c) => 1 - (1 - c) * (tint / 100000));
  if (lumMod !== null || lumOff !== null) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    let l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    l = Math.min(1, Math.max(0, l * ((lumMod ?? 100000) / 100000) + (lumOff ?? 0) / 100000));
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t: number) => {
      t = (t + 1) % 1;
      return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    };
    [r, g, b] = s === 0 ? [l, l, l] : [f(h + 1 / 3), f(h), f(h - 1 / 3)];
  }
  return `#${[r, g, b].map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("")}`;
}
