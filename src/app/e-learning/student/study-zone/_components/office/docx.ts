// Reads a .docx into a flow of blocks the viewer draws as a page: headings, paragraphs (alignment, bold / italic /
// underline / colour / size), numbered and bulleted lists, tables and inline pictures. Styles follow Word's own
// chain (document defaults -> paragraph style and the styles it is based on -> direct formatting). Not covered:
// headers/footers, footnotes, text boxes, columns and exact page breaks.

import { openZip, type ZipArchive } from "./zip";
import { attr, desc, hex, imageUrl, kid, kids, readRels, readXml, relAttr } from "./ooxml";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const val = (el: Element | null | undefined, name = "val"): string | null => el?.getAttributeNS(W_NS, name) || el?.getAttribute(`w:${name}`) || null;
// <w:b/> and <w:b w:val="true"/> are on; <w:b w:val="0"/> is off; absent is "not set".
const flag = (el: Element | null): boolean | null => (el ? !["0", "false", "off"].includes(val(el) ?? "") : null);

export interface DocxRun { text: string; bold: boolean; italic: boolean; underline: boolean; strike: boolean; color: string | null; sizePt: number | null; lineBreak?: boolean; image?: { src: string; width: number; height: number } }
export type DocxBlock =
  | { kind: "para"; variant: "title" | "subtitle" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p"; align: "left" | "center" | "right" | "justify"; list: { level: number; marker: string } | null; indentPt: number; runs: DocxRun[] }
  | { kind: "table"; rows: DocxBlock[][][] };
export interface DocxDocument { blocks: DocxBlock[]; baseSizePt: number; objectUrls: string[] }

interface RunProps { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; color?: string | null; sizePt?: number }
interface StyleInfo { name: string; basedOn: string | null; rPr: Element | null; pPr: Element | null }

function runProps(rPr: Element | null): RunProps {
  const out: RunProps = {};
  if (!rPr) return out;
  const b = flag(kid(rPr, "b")); if (b !== null) out.bold = b;
  const i = flag(kid(rPr, "i")); if (i !== null) out.italic = i;
  const s = flag(kid(rPr, "strike")); if (s !== null) out.strike = s;
  const u = kid(rPr, "u"); if (u) out.underline = val(u) !== "none";
  const c = val(kid(rPr, "color")); if (c) out.color = c === "auto" ? null : hex(c);
  const sz = Number(val(kid(rPr, "sz"))); if (sz) out.sizePt = sz / 2;
  return out;
}

const ALIGN: Record<string, "left" | "center" | "right" | "justify"> = { left: "left", start: "left", center: "center", right: "right", end: "right", both: "justify", distribute: "justify" };

function toRoman(n: number) {
  return [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]].reduce((s, [k, r]) => { while (n >= (k as number)) { s += r; n -= k as number; } return s; }, "");
}
function formatNumber(fmt: string, n: number) {
  if (fmt === "lowerLetter") return String.fromCharCode(96 + ((n - 1) % 26) + 1);
  if (fmt === "upperLetter") return String.fromCharCode(64 + ((n - 1) % 26) + 1);
  if (fmt === "lowerRoman") return toRoman(n);
  if (fmt === "upperRoman") return toRoman(n).toUpperCase();
  return String(n);
}
// Symbol/Wingdings bullet characters (often in the private-use area) -> readable glyphs.
const SYMBOL_BULLETS: Record<number, string> = { 0xf0b7: "•", 0xf0a7: "▪", 0xf0d8: "➢", 0xf0fc: "✓", 0xf076: "❖", 0xf06e: "■", 0xf0a8: "◆" };
function bulletText(text: string) {
  const c = text.charCodeAt(0);
  if (!text || text === "·") return "•";
  if (c >= 0xf000 && c <= 0xf0ff) return SYMBOL_BULLETS[c] ?? "•";
  return text;
}

export async function readDocx(buffer: ArrayBuffer): Promise<DocxDocument> {
  const zip: ZipArchive = openZip(buffer);
  const doc = await readXml(zip, "word/document.xml");
  const body = desc(doc, "body")[0];
  if (!body) throw new Error("Not a Word document");
  const rels = await readRels(zip, "word/document.xml");
  const stylesDoc = await readXml(zip, "word/styles.xml");
  const numberingDoc = await readXml(zip, "word/numbering.xml");
  const urls: string[] = [];

  const styles = new Map<string, StyleInfo>();
  for (const s of desc(stylesDoc, "style")) {
    styles.set(val(s, "styleId") ?? "", { name: (val(kid(s, "name")) ?? "").toLowerCase(), basedOn: val(kid(s, "basedOn")), rPr: kid(s, "rPr"), pPr: kid(s, "pPr") });
  }
  const chain = (id: string | null): StyleInfo[] => {
    const out: StyleInfo[] = [];
    for (let s = id ? styles.get(id) : undefined; s && out.length < 20; s = s.basedOn ? styles.get(s.basedOn) : undefined) out.push(s);
    return out;
  };
  const defaultStyle = [...styles.entries()].find(([, s]) => s.name === "normal")?.[0] ?? null;
  const docDefaults = runProps(desc(desc(stylesDoc, "rPrDefault")[0], "rPr")[0] ?? null);
  const baseSizePt = { ...docDefaults, ...[...chain(defaultStyle)].reverse().reduce((a, s) => ({ ...a, ...runProps(s.rPr) }), {} as RunProps) }.sizePt ?? 11;

  // numId -> abstract numbering levels.
  const abstracts = new Map(desc(numberingDoc, "abstractNum").map((a) => [val(a, "abstractNumId"), a]));
  const nums = new Map(desc(numberingDoc, "num").map((n) => [val(n, "numId"), abstracts.get(val(kid(n, "abstractNumId")))]));
  const counters = new Map<string, number[]>();
  const marker = (numId: string, level: number): string | null => {
    const lvl = kids(nums.get(numId) ?? null, "lvl").find((l) => Number(val(l, "ilvl")) === level);
    if (!lvl) return null;
    const fmt = val(kid(lvl, "numFmt")) ?? "decimal";
    const text = val(kid(lvl, "lvlText")) ?? "";
    if (fmt === "bullet") return bulletText(text);
    if (fmt === "none") return "";
    const c = counters.get(numId) ?? [];
    c[level] = (c[level] ?? (Number(val(kid(lvl, "start"))) || 1) - 1) + 1;
    c.length = level + 1; // a new item resets deeper levels
    counters.set(numId, c);
    return text.replace(/%(\d)/g, (_, d: string) => {
      const l = Number(d) - 1;
      const f = val(kid(kids(nums.get(numId) ?? null, "lvl").find((x) => Number(val(x, "ilvl")) === l) ?? null, "numFmt")) ?? "decimal";
      return formatNumber(f, c[l] ?? 1);
    });
  };

  async function paragraph(p: Element): Promise<DocxBlock> {
    const pPr = kid(p, "pPr");
    const styleChain = chain(val(kid(pPr, "pStyle")) ?? defaultStyle);
    const styleName = styleChain[0]?.name ?? "";
    const outline = [pPr, ...styleChain.map((s) => s.pPr)].map((e) => val(kid(e, "outlineLvl"))).find((v) => v !== null);
    const heading = /^heading (\d)$/.exec(styleName)?.[1] ?? (outline !== undefined && outline !== null ? String(Number(outline) + 1) : null);
    const variant: Extract<DocxBlock, { kind: "para" }>["variant"] =
      styleName === "title" ? "title" : styleName === "subtitle" ? "subtitle" : heading && Number(heading) <= 6 ? (`h${heading}` as "h1") : "p";

    const pick = (f: (e: Element) => string | null) => [pPr, ...styleChain.map((s) => s.pPr)].map((e) => (e ? f(e) : null)).find((v) => v !== null && v !== undefined) ?? null;
    const align = ALIGN[pick((e) => val(kid(e, "jc"))) ?? "left"] ?? "left";
    const numPr = [pPr, ...styleChain.map((s) => s.pPr)].map((e) => kid(e, "numPr")).find((e) => e);
    const numId = val(kid(numPr ?? null, "numId"));
    const level = Number(val(kid(numPr ?? null, "ilvl")) ?? 0);
    const listMarker = numId && numId !== "0" ? marker(numId, level) : null;
    const indentTwips = Number(pick((e) => val(kid(e, "ind"), "left") ?? val(kid(e, "ind"), "start")) ?? 0);

    const base: RunProps = { ...docDefaults, ...[...styleChain].reverse().reduce((a, s) => ({ ...a, ...runProps(s.rPr) }), {} as RunProps) };
    const runs: DocxRun[] = [];
    const walk = async (el: Element) => {
      for (const c of [...el.children]) {
        if (c.localName === "r") {
          const rProps = { ...base, ...chain(val(kid(kid(c, "rPr"), "rStyle"))).reverse().reduce((a, s) => ({ ...a, ...runProps(s.rPr) }), {} as RunProps), ...runProps(kid(c, "rPr")) };
          const style = { bold: !!rProps.bold, italic: !!rProps.italic, underline: !!rProps.underline, strike: !!rProps.strike, color: rProps.color ?? null, sizePt: rProps.sizePt ?? null };
          for (const part of [...c.children]) {
            if (part.localName === "t") runs.push({ ...style, text: part.textContent ?? "" });
            else if (part.localName === "tab") runs.push({ ...style, text: "\t" });
            else if (part.localName === "br" || part.localName === "cr") runs.push({ ...style, text: "", lineBreak: true });
            else if (part.localName === "drawing" || part.localName === "pict") {
              const blip = desc(part, "blip")[0];
              const target = rels.get(relAttr(blip, "embed") ?? "")?.target;
              const src = target ? await imageUrl(zip, target, urls) : null;
              const extent = desc(part, "extent")[0];
              if (src) runs.push({ ...style, text: "", image: { src, width: Number(attr(extent, "cx") ?? 0) / 9525, height: Number(attr(extent, "cy") ?? 0) / 9525 } });
            }
          }
        } else if (["hyperlink", "ins", "smartTag", "fldSimple", "customXml", "sdt", "sdtContent"].includes(c.localName)) {
          await walk(c);
        }
      }
    };
    await walk(p);
    return { kind: "para", variant, align, list: listMarker !== null ? { level, marker: listMarker } : null, indentPt: listMarker !== null ? 0 : indentTwips / 20, runs };
  }

  async function blocks(container: Element): Promise<DocxBlock[]> {
    const out: DocxBlock[] = [];
    for (const el of [...container.children]) {
      if (el.localName === "p") out.push(await paragraph(el));
      else if (el.localName === "tbl") {
        const rows: DocxBlock[][][] = [];
        for (const tr of kids(el, "tr")) {
          const cells: DocxBlock[][] = [];
          for (const tc of kids(tr, "tc")) cells.push(await blocks(tc));
          rows.push(cells);
        }
        out.push({ kind: "table", rows });
      } else if (el.localName === "sdt") {
        const content = kid(el, "sdtContent");
        if (content) out.push(...(await blocks(content)));
      }
    }
    return out;
  }

  return { blocks: await blocks(body), baseSizePt, objectUrls: urls };
}
