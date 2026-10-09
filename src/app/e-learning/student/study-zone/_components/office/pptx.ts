// Reads a .pptx into plain slide data the viewer draws: positioned text boxes (with their real sizes, colours, fonts,
// alignment and bullets), pictures, tables, slide backgrounds and speaker notes. Formatting follows PowerPoint's own
// inheritance — slide -> slide layout -> slide master -> theme — so placeholder text gets the position and style the
// lecturer's template gives it. Deliberately not covered: animations, charts, SmartArt, WordArt effects, gradients
// (drawn as their first colour) and non-rectangular shape outlines.

import { openZip, type ZipArchive } from "./zip";
import { adjustColor, attr, desc, hex, imageUrl, kid, kids, num, path, readRels, readXml, relAttr } from "./ooxml";

export interface Box { x: number; y: number; w: number; h: number } // EMU

export interface PptxRun { text: string; sizePt: number; bold: boolean; italic: boolean; underline: boolean; color: string; font: string; lineBreak?: boolean }
export interface PptxParagraph {
  runs: PptxRun[];
  align: "left" | "center" | "right" | "justify";
  marginLeft: number; // EMU
  indent: number; // EMU (negative = hanging bullet)
  bullet: { char: string; color: string; sizePt: number } | null;
  spaceBeforePt: number;
  lineHeight: number; // multiple of font size
  emptySizePt: number; // height of an empty line
}
export type PptxShape =
  | { kind: "text"; box: Box; fill: string | null; border: { color: string; width: number } | null; round: "none" | "ellipse" | "round"; anchor: "start" | "center" | "end"; insets: [number, number, number, number]; paragraphs: PptxParagraph[] }
  | { kind: "image"; box: Box; src: string }
  // A straight line across its box (top-left -> bottom-right, unless flipped).
  | { kind: "line"; box: Box; color: string; width: number; dash: boolean; flipH: boolean; flipV: boolean }
  | { kind: "table"; box: Box; columns: number[]; rows: { height: number; cells: { fill: string | null; paragraphs: PptxParagraph[] }[] }[] };
export interface PptxSlide { number: number; background: { color: string; image: string | null }; shapes: PptxShape[]; notes: string }
export interface PptxDeck { width: number; height: number; slides: PptxSlide[]; objectUrls: string[] }

type Category = "title" | "body" | "other";
interface Theme { colors: Record<string, string>; major: string; minor: string; bgFills: Element[]; part: string }
interface Part { name: string; doc: Document; rels: Map<string, { target: string; type: string }> }
interface Ctx { zip: ZipArchive; theme: Theme; clrMap: Record<string, string>; defaultText: Element | null; masterTx: Element | null; urls: string[] }

export async function readPptx(buffer: ArrayBuffer): Promise<PptxDeck> {
  const zip = openZip(buffer);
  const pres = await readXml(zip, "ppt/presentation.xml");
  if (!pres) throw new Error("Not a PowerPoint file");
  const presRels = await readRels(zip, "ppt/presentation.xml");
  const size = desc(pres, "sldSz")[0];
  const width = num(size, "cx") ?? 9144000;
  const height = num(size, "cy") ?? 5143500;

  const urls: string[] = [];
  const parts = new Map<string, Part>();
  const load = async (name: string): Promise<Part | null> => {
    if (!parts.has(name)) {
      const doc = await readXml(zip, name);
      if (!doc) return null;
      parts.set(name, { name, doc, rels: await readRels(zip, name) });
    }
    return parts.get(name)!;
  };
  const related = (part: Part | null, type: string) => [...(part?.rels.values() ?? [])].find((r) => r.type.endsWith(`/${type}`))?.target;

  const slides: PptxSlide[] = [];
  const ids = kids(desc(pres, "sldIdLst")[0], "sldId");
  for (const [i, sldId] of ids.entries()) {
    const target = presRels.get(relAttr(sldId, "id") ?? "")?.target;
    const slide = target ? await load(target) : null;
    if (!slide) continue;
    const layout = await load(related(slide, "slideLayout") ?? "");
    const master = await load(related(layout, "slideMaster") ?? "");
    const themePart = await load(related(master, "theme") ?? "");
    const ctx: Ctx = {
      zip,
      theme: readTheme(themePart),
      clrMap: Object.fromEntries([...(desc(master?.doc, "clrMap")[0]?.attributes ?? [])].map((a) => [a.name, a.value])),
      defaultText: desc(pres, "defaultTextStyle")[0] ?? null,
      masterTx: desc(master?.doc, "txStyles")[0] ?? null,
      urls,
    };

    const shapes: PptxShape[] = [];
    const showMaster = (p: Part | null) => attr(p?.doc.documentElement, "showMasterSp") !== "0";
    // Template decorations first (behind the slide's own content), never the template's placeholders.
    if (showMaster(slide) && showMaster(layout) && master) shapes.push(...(await readTree(ctx, master, null, null, true)));
    if (showMaster(slide) && layout) shapes.push(...(await readTree(ctx, layout, null, master, true)));
    shapes.push(...(await readTree(ctx, slide, layout, master, false)));

    const notesPart = await load(related(slide, "notesSlide") ?? "");
    const notesBody = desc(notesPart?.doc, "sp").find((sp) => attr(path(sp, "nvSpPr", "nvPr", "ph"), "type") === "body");
    const notes = kids(kid(notesBody ?? null, "txBody"), "p").map((p) => desc(p, "t").map((t) => t.textContent ?? "").join("")).join("\n").trim();

    slides.push({ number: i + 1, background: await readBackground(ctx, [slide, layout, master]), shapes, notes });
  }
  return { width, height, slides, objectUrls: urls };
}

function readTheme(part: Part | null): Theme {
  const colors: Record<string, string> = {};
  for (const c of [...(desc(part?.doc, "clrScheme")[0]?.children ?? [])]) {
    const v = kid(c, "srgbClr") ? hex(attr(kid(c, "srgbClr"), "val")) : hex(attr(kid(c, "sysClr"), "lastClr"));
    if (v) colors[c.localName] = v;
  }
  const font = (n: string) => attr(path(desc(part?.doc, n)[0], "latin"), "typeface") ?? "Calibri";
  return { colors, major: font("majorFont"), minor: font("minorFont"), bgFills: [...(desc(part?.doc, "bgFillStyleLst")[0]?.children ?? [])], part: part?.name ?? "" };
}

// The colour inside a fill/colour element (solidFill, buClr, fontRef...). `phClr` is the placeholder colour a style
// reference supplies.
function color(ctx: Ctx, el: Element | null, phClr?: string | null): string | null {
  if (!el) return null;
  for (const c of [...el.children]) {
    let base: string | null = null;
    if (c.localName === "srgbClr") base = hex(attr(c, "val"));
    else if (c.localName === "sysClr") base = hex(attr(c, "lastClr"));
    else if (c.localName === "prstClr") base = ({ black: "#000000", white: "#ffffff", red: "#ff0000", blue: "#0000ff", green: "#008000", yellow: "#ffff00" } as Record<string, string>)[attr(c, "val") ?? ""] ?? null;
    else if (c.localName === "schemeClr") {
      const v = attr(c, "val") ?? "";
      base = v === "phClr" ? (phClr ?? null) : (ctx.theme.colors[ctx.clrMap[v] ?? v] ?? null);
    }
    if (base) return adjustColor(base, c);
  }
  return null;
}

// Fill of a shape/cell/background properties element: solid, first stop of a gradient, or explicitly none.
function fillOf(ctx: Ctx, props: Element | null): string | null | undefined {
  if (!props) return undefined;
  if (kid(props, "noFill")) return null;
  if (kid(props, "solidFill")) return color(ctx, kid(props, "solidFill"));
  if (kid(props, "gradFill")) return color(ctx, desc(kid(props, "gradFill"), "gs")[0] ?? null);
  return undefined;
}

async function readBackground(ctx: Ctx, chain: (Part | null)[]): Promise<PptxSlide["background"]> {
  for (const part of chain) {
    const bg = path(part?.doc.documentElement, "cSld", "bg");
    if (!part || !bg) continue;
    const bgPr = kid(bg, "bgPr");
    if (bgPr) {
      const blip = path(bgPr, "blipFill", "blip");
      const img = blip ? part.rels.get(relAttr(blip, "embed") ?? "")?.target : undefined;
      return { color: fillOf(ctx, bgPr) ?? "#ffffff", image: img ? await imageUrl(ctx.zip, img, ctx.urls) : null };
    }
    const ref = kid(bg, "bgRef");
    if (ref) {
      const phClr = color(ctx, ref);
      const style = ctx.theme.bgFills[(num(ref, "idx") ?? 0) - 1001];
      if (style?.localName === "blipFill") {
        const rels = await readRels(ctx.zip, ctx.theme.part);
        const img = rels.get(relAttr(kid(style, "blip"), "embed") ?? "")?.target;
        return { color: phClr ?? "#ffffff", image: img ? await imageUrl(ctx.zip, img, ctx.urls) : null };
      }
      const styled = style?.localName === "solidFill" ? color(ctx, style, phClr) : style?.localName === "gradFill" ? color(ctx, desc(style, "gs")[0] ?? null, phClr) : null;
      return { color: styled ?? phClr ?? "#ffffff", image: null };
    }
  }
  return { color: "#ffffff", image: null };
}

const placeholderOf = (el: Element) => path(el, "nvSpPr", "nvPr", "ph") ?? path(el, "nvPicPr", "nvPr", "ph") ?? path(el, "nvGraphicFramePr", "nvPr", "ph");
const titleTypes = new Set(["title", "ctrTitle"]);

// The matching placeholder in a layout/master: same idx first, then same type.
function findPlaceholder(part: Part | null, ph: Element, byTypeOnly: boolean): Element | null {
  if (!part) return null;
  const type = attr(ph, "type") ?? "body";
  const idx = attr(ph, "idx");
  const candidates = desc(part.doc, "sp").filter((sp) => placeholderOf(sp));
  const norm = (t: string) => (titleTypes.has(t) ? "title" : t === "subTitle" || t === "obj" ? "body" : t);
  return (
    (!byTypeOnly && idx !== null ? candidates.find((sp) => attr(placeholderOf(sp), "idx") === idx) : undefined) ??
    candidates.find((sp) => (attr(placeholderOf(sp), "type") ?? "body") === type) ??
    candidates.find((sp) => norm(attr(placeholderOf(sp), "type") ?? "body") === norm(type)) ??
    null
  );
}

type Transform = (b: Box) => Box;
const identity: Transform = (b) => b;

function boxOf(xfrm: Element | null): Box | null {
  const off = kid(xfrm, "off"), ext = kid(xfrm, "ext");
  if (!off || !ext) return null;
  return { x: num(off, "x") ?? 0, y: num(off, "y") ?? 0, w: num(ext, "cx") ?? 0, h: num(ext, "cy") ?? 0 };
}

async function readTree(ctx: Ctx, part: Part, layout: Part | null, master: Part | null, templateOnly: boolean): Promise<PptxShape[]> {
  const tree = path(part.doc.documentElement, "cSld", "spTree");
  const out: PptxShape[] = [];
  const walk = async (container: Element | null, t: Transform) => {
    for (const el of [...(container?.children ?? [])]) {
      const ph = placeholderOf(el);
      if (templateOnly && ph) continue;
      if (el.localName === "grpSp") {
        const x = path(el, "grpSpPr", "xfrm");
        const outer = boxOf(x), chOff = kid(x, "chOff"), chExt = kid(x, "chExt");
        const sx = outer && (num(chExt, "cx") ?? 0) ? outer.w / num(chExt, "cx")! : 1;
        const sy = outer && (num(chExt, "cy") ?? 0) ? outer.h / num(chExt, "cy")! : 1;
        const inner: Transform = outer
          ? (b) => t({ x: outer.x + (b.x - (num(chOff, "x") ?? 0)) * sx, y: outer.y + (b.y - (num(chOff, "y") ?? 0)) * sy, w: b.w * sx, h: b.h * sy })
          : t;
        await walk(el, inner);
      } else if (el.localName === "sp" || el.localName === "cxnSp") {
        const shape = readShape(ctx, el, ph, layout, master, t);
        if (shape) out.push(shape);
      } else if (el.localName === "pic") {
        const box = boxOf(path(el, "spPr", "xfrm")) ?? boxOf(path(findPlaceholder(layout, ph ?? el, false), "spPr", "xfrm"));
        const target = part.rels.get(relAttr(path(el, "blipFill", "blip"), "embed") ?? "")?.target;
        const src = target ? await imageUrl(ctx.zip, target, ctx.urls) : null;
        if (box && src) out.push({ kind: "image", box: t(box), src });
      } else if (el.localName === "graphicFrame") {
        const tbl = desc(el, "tbl")[0];
        const box = boxOf(kid(el, "xfrm"));
        if (tbl && box) {
          out.push({
            kind: "table",
            box: t(box),
            columns: kids(kid(tbl, "tblGrid"), "gridCol").map((c) => num(c, "w") ?? 0),
            rows: kids(tbl, "tr").map((tr) => ({
              height: num(tr, "h") ?? 0,
              cells: kids(tr, "tc").map((tc) => ({ fill: fillOf(ctx, kid(tc, "tcPr")) ?? null, paragraphs: readParagraphs(ctx, kid(tc, "txBody"), [], "other", 1) })),
            })),
          });
        }
      }
    }
  };
  await walk(tree, identity);
  return out;
}

function readShape(ctx: Ctx, sp: Element, ph: Element | null, layout: Part | null, master: Part | null, t: Transform): PptxShape | null {
  const layoutPh = ph ? findPlaceholder(layout, ph, false) : null;
  const masterPh = ph ? findPlaceholder(master, layoutPh ? (placeholderOf(layoutPh) ?? ph) : ph, true) : null;
  const inherited = [sp, layoutPh, masterPh].filter((e): e is Element => !!e);

  const box = inherited.map((e) => boxOf(path(e, "spPr", "xfrm"))).find((b) => b);
  if (!box) return null;

  const spPr = kid(sp, "spPr");
  const style = kid(sp, "style");
  const prst = attr(path(spPr, "prstGeom"), "prst");

  if (sp.localName === "cxnSp" || prst === "line" || prst?.includes("Connector")) {
    const ln = kid(spPr, "ln");
    const lineColor = kid(ln, "noFill") ? null : (color(ctx, kid(ln, "solidFill")) ?? ((num(kid(style, "lnRef"), "idx") ?? 0) > 0 ? color(ctx, kid(style, "lnRef")) : null));
    const xfrm = path(spPr, "xfrm");
    if (!lineColor) return null;
    return {
      kind: "line",
      box: t(box),
      color: lineColor,
      width: num(ln, "w") ?? 9525,
      dash: !!attr(kid(ln, "prstDash"), "val") && attr(kid(ln, "prstDash"), "val") !== "solid",
      flipH: attr(xfrm, "flipH") === "1",
      flipV: attr(xfrm, "flipV") === "1",
    };
  }

  let fill = fillOf(ctx, spPr);
  if (fill === undefined) fill = (num(kid(style, "fillRef"), "idx") ?? 0) > 0 ? color(ctx, kid(style, "fillRef")) : null;
  const ln = kid(spPr, "ln");
  const lnColor = kid(ln, "noFill") ? null : (color(ctx, kid(ln, "solidFill")) ?? ((num(kid(style, "lnRef"), "idx") ?? 0) > 0 ? color(ctx, kid(style, "lnRef")) : null));
  const border = lnColor ? { color: lnColor, width: num(ln, "w") ?? 9525 } : null;

  const bodyPrs = inherited.map((e) => path(e, "txBody", "bodyPr")).filter((e): e is Element => !!e);
  const firstAttr = (name: string) => bodyPrs.map((b) => attr(b, name)).find((v) => v !== null) ?? null;
  const autofit = kid(bodyPrs[0], "normAutofit");
  const fontScale = (num(autofit, "fontScale") ?? 100000) / 100000;
  const lineReduction = (num(autofit, "lnSpcReduction") ?? 0) / 100000;

  const type = ph ? (attr(ph, "type") ?? "body") : null;
  const category: Category = type === null || ["dt", "ftr", "sldNum"].includes(type) ? "other" : titleTypes.has(type) ? "title" : "body";
  const lists = inherited.map((e) => path(e, "txBody", "lstStyle"));
  const paragraphs = readParagraphs(ctx, kid(sp, "txBody"), lists, category, fontScale, lineReduction);
  if (!fill && !border && paragraphs.every((p) => p.runs.every((r) => !r.text.trim()))) return null;

  const anchor = firstAttr("anchor");
  const ins = (n: string, d: number) => { const v = firstAttr(n); return v === null ? d : Number(v); };
  return {
    kind: "text",
    box: t(box),
    fill: fill ?? null,
    border,
    round: prst === "ellipse" ? "ellipse" : prst === "roundRect" ? "round" : "none",
    anchor: anchor === "ctr" ? "center" : anchor === "b" ? "end" : "start",
    insets: [ins("lIns", 91440), ins("tIns", 45720), ins("rIns", 91440), ins("bIns", 45720)],
    paragraphs,
  };
}

const ALIGN: Record<string, PptxParagraph["align"]> = { l: "left", ctr: "center", r: "right", just: "justify", dist: "justify" };

// Wingdings/Symbol bullet glyphs -> their Unicode look-alikes (glyphs in the private-use area are mapped the same way).
const SYMBOL_BULLETS: Record<string, string> = { "§": "▪", "Ø": "➢", "ü": "✓", "q": "❑", "v": "❖", "n": "■", "l": "●", "Ÿ": "•", "·": "•", "o": "○", "": "▶" };
function bulletGlyph(char: string, font: string | null): string {
  const base = char.charCodeAt(0) >= 0xf000 && char.charCodeAt(0) <= 0xf0ff ? String.fromCharCode(char.charCodeAt(0) - 0xf000) : char;
  if (/wingdings|symbol|webdings/i.test(font ?? "") || base !== char) return SYMBOL_BULLETS[base] ?? "•";
  return char || "•";
}

function autoNumber(scheme: string, n: number): string {
  const roman = (v: number) => [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]].reduce((s, [k, r]) => { while (v >= (k as number)) { s += r; v -= k as number; } return s; }, "");
  const value = scheme.startsWith("alphaLc") ? String.fromCharCode(96 + ((n - 1) % 26) + 1) : scheme.startsWith("alphaUc") ? String.fromCharCode(64 + ((n - 1) % 26) + 1) : scheme.startsWith("romanLc") ? roman(n) : scheme.startsWith("romanUc") ? roman(n).toUpperCase() : String(n);
  return scheme.endsWith("ParenBoth") ? `(${value})` : scheme.endsWith("ParenR") ? `${value})` : scheme.endsWith("Plain") ? value : `${value}.`;
}

function readParagraphs(ctx: Ctx, txBody: Element | null, lists: (Element | null)[], category: Category, fontScale: number, lineReduction = 0): PptxParagraph[] {
  const shared = category === "title" ? kid(ctx.masterTx, "titleStyle") : category === "body" ? kid(ctx.masterTx, "bodyStyle") : ctx.defaultText;
  const counters = new Map<number, number>();
  const fontName = (f: string | null) => (f === "+mj-lt" ? ctx.theme.major : f === "+mn-lt" || !f ? (category === "title" ? ctx.theme.major : ctx.theme.minor) : f);
  const textColor = ctx.theme.colors[ctx.clrMap.tx1 ?? "dk1"] ?? "#000000";

  return kids(txBody, "p").map((p) => {
    const pPr = kid(p, "pPr");
    const level = (num(pPr, "lvl") ?? 0) + 1;
    const chain = [pPr, ...[...lists, kid(txBody, "lstStyle"), shared].map((l) => kid(l, `lvl${level}pPr`))].filter((e): e is Element => !!e);
    const pick = <T,>(f: (e: Element) => T | null | undefined): T | null => { for (const e of chain) { const v = f(e); if (v !== null && v !== undefined) return v; } return null; };
    const defs = chain.map((e) => kid(e, "defRPr")).filter((e): e is Element => !!e);
    const def = <T,>(f: (e: Element) => T | null | undefined): T | null => { for (const e of defs) { const v = f(e); if (v !== null && v !== undefined) return v; } return null; };

    const defSize = def((e) => num(e, "sz")) ?? (category === "title" ? 4400 : 1800);
    const defColor = def((e) => color(ctx, kid(e, "solidFill"))) ?? textColor;
    const defFont = def((e) => attr(kid(e, "latin"), "typeface"));
    const defBold = def((e) => attr(e, "b"));
    const defItalic = def((e) => attr(e, "i"));

    const runs: PptxRun[] = [];
    for (const r of [...p.children]) {
      if (r.localName === "br") { runs.push({ text: "", sizePt: 0, bold: false, italic: false, underline: false, color: defColor, font: "", lineBreak: true }); continue; }
      if (r.localName !== "r" && r.localName !== "fld") continue;
      const rPr = kid(r, "rPr");
      const on = (v: string | null) => v === "1" || v === "true";
      runs.push({
        text: kid(r, "t")?.textContent ?? "",
        sizePt: ((num(rPr, "sz") ?? defSize) / 100) * fontScale,
        bold: on(attr(rPr, "b") ?? defBold),
        italic: on(attr(rPr, "i") ?? defItalic),
        underline: !!attr(rPr, "u") && attr(rPr, "u") !== "none",
        color: color(ctx, kid(rPr, "solidFill")) ?? defColor,
        font: fontName(attr(kid(rPr, "latin"), "typeface") ?? defFont),
      });
    }
    const hasText = runs.some((r) => r.text.trim());
    const firstSize = runs.find((r) => r.text)?.sizePt ?? ((num(kid(p, "endParaRPr"), "sz") ?? defSize) / 100) * fontScale;

    // Bullets: the nearest level that says anything (none / character / auto-number) wins.
    let bullet: PptxParagraph["bullet"] = null;
    const kind = pick((e) => (kid(e, "buNone") ? "none" : kid(e, "buChar") ? "char" : kid(e, "buAutoNum") ? "auto" : null));
    if (hasText && kind && kind !== "none") {
      const bColor = pick((e) => color(ctx, kid(e, "buClr"))) ?? runs.find((r) => r.text)?.color ?? defColor;
      const pct = (pick((e) => num(kid(e, "buSzPct"), "val")) ?? 100000) / 100000;
      if (kind === "char") {
        bullet = { char: bulletGlyph(pick((e) => attr(kid(e, "buChar"), "char")) ?? "•", pick((e) => attr(kid(e, "buFont"), "typeface"))), color: bColor, sizePt: firstSize * pct };
      } else {
        const n = (counters.get(level) ?? (pick((e) => num(kid(e, "buAutoNum"), "startAt")) ?? 1) - 1) + 1;
        counters.set(level, n);
        bullet = { char: autoNumber(pick((e) => attr(kid(e, "buAutoNum"), "type")) ?? "arabicPeriod", n), color: bColor, sizePt: firstSize };
      }
    }
    if (kind !== "auto") counters.delete(level);

    const spcBef = pick((e) => kid(e, "spcBef"));
    const lnSpc = pick((e) => kid(e, "lnSpc"));
    return {
      runs,
      align: ALIGN[pick((e) => attr(e, "algn")) ?? "l"] ?? "left",
      marginLeft: pick((e) => num(e, "marL")) ?? 0,
      indent: pick((e) => num(e, "indent")) ?? 0,
      bullet,
      spaceBeforePt: spcBef ? (num(kid(spcBef, "spcPts"), "val") ?? 0) / 100 + ((num(kid(spcBef, "spcPct"), "val") ?? 0) / 100000) * firstSize : 0,
      lineHeight: (lnSpc ? (num(kid(lnSpc, "spcPct"), "val") ?? 100000) / 100000 : 1) * 1.2 * (1 - lineReduction),
      emptySizePt: firstSize,
    };
  });
}

