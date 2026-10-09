"use client";

// Shows the slides of a .pptx inside Study Zone: each slide is drawn from the file's own content (office/pptx.ts) at
// its real aspect ratio, and every position and font size is expressed in container-query units relative to the
// slide's width, so a slide scales exactly with the panel. Slides scroll vertically; the bar on top tracks the
// current slide and steps between them. Speaker notes, when the lecturer wrote any, sit under their slide.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { readPptx, type PptxDeck, type PptxParagraph, type PptxShape, type PptxSlide } from "../office/pptx";
import { useOfficeDocument } from "../office/useOfficeDocument";
import { LoadError, PageSkeleton, StatusCard } from "./ViewerStates";
import type { StudyDocument } from "@/services/e-learning/student/study-zone";

const EMU_PER_PT = 12700;
const safeFont = (f: string) => `"${f.replace(/[^\w \-]/g, "")}", Calibri, Arial, sans-serif`;

export default function PowerPointViewer({ doc }: { doc: StudyDocument }) {
  const [state, retry] = useOfficeDocument(doc.id, readPptx);
  if (state.status === "loading") return <PageSkeleton label={`Loading ${doc.title}`} />;
  if (state.status === "error") return <LoadError message={state.message} onRetry={retry} />;
  if (state.doc.slides.length === 0) return <StatusCard tone="neutral" title="This presentation has no slides." body="Download it to check the file." />;
  return <Deck deck={state.doc} title={doc.title} />;
}

function Deck({ deck, title }: { deck: PptxDeck; title: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(1);

  // The current slide is the last one whose top has passed a third of the way down the view.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = root.scrollTop + root.clientHeight / 3;
      let n = 1;
      root.querySelectorAll<HTMLElement>("[data-slide]").forEach((el) => {
        if (el.offsetTop <= line) n = Number(el.dataset.slide);
      });
      setCurrent(n);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [deck]);

  const go = (n: number) => {
    const target = Math.min(deck.slides.length, Math.max(1, n));
    const root = scrollRef.current;
    const el = root?.querySelector<HTMLElement>(`[data-slide="${target}"]`);
    if (root && el) root.scrollTo({ top: el.offsetTop - 12, behavior: "smooth" });
    setCurrent(target);
  };

  const navButton = "flex h-7 w-7 items-center justify-center rounded-md text-gray-700 hover:bg-gray-200 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-blue-600";
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex shrink-0 items-center justify-center gap-2 border-b border-gray-200 bg-white px-3 py-1">
        <button type="button" onClick={() => go(current - 1)} disabled={current <= 1} aria-label="Previous slide" title="Previous slide" className={navButton}>
          <ChevronLeft size={16} aria-hidden />
        </button>
        <span className="min-w-[6.5rem] text-center text-xs font-semibold text-gray-800" aria-live="polite">
          Slide {current} of {deck.slides.length}
        </span>
        <button type="button" onClick={() => go(current + 1)} disabled={current >= deck.slides.length} aria-label="Next slide" title="Next slide" className={navButton}>
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
      <div ref={scrollRef} tabIndex={0} aria-label={`${title}, slides`} className="relative min-h-0 flex-1 overflow-y-auto bg-gray-100 p-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 sm:p-5">
        <div className="mx-auto max-w-5xl space-y-5">
          {deck.slides.map((s) => (
            <figure key={s.number} data-slide={s.number} aria-label={`Slide ${s.number} of ${deck.slides.length}`} className="space-y-1.5">
              <SlideView deck={deck} slide={s} />
              <figcaption className="flex items-start justify-between gap-3 px-0.5 text-xs text-gray-700">
                <span className="shrink-0 font-semibold">{s.number}</span>
                {s.notes && (
                  <details className="min-w-0 flex-1 text-right">
                    <summary className="cursor-pointer font-medium text-blue-800">Speaker notes</summary>
                    <p className="mt-1 whitespace-pre-line rounded-lg bg-white p-3 text-left text-sm text-gray-900">{s.notes}</p>
                  </details>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}

function SlideView({ deck, slide }: { deck: PptxDeck; slide: PptxSlide }) {
  return (
    <div
      className="@container relative w-full overflow-hidden rounded-sm shadow-md ring-1 ring-black/5"
      style={{
        aspectRatio: `${deck.width} / ${deck.height}`,
        backgroundColor: slide.background.color,
        backgroundImage: slide.background.image ? `url("${slide.background.image}")` : undefined,
        backgroundSize: "cover",
      }}
    >
      {slide.shapes.map((shape, i) => <ShapeView key={i} deck={deck} shape={shape} />)}
    </div>
  );
}

// EMU / points -> a length relative to the slide's width. Text sizes are also multiplied by the box's --fit factor
// (see TextBox), so text that wouldn't fit its box can shrink.
const units = (deck: PptxDeck) => ({
  u: (emu: number) => `${(emu / deck.width) * 100}cqw`,
  pt: (points: number) => `calc(${((points * EMU_PER_PT) / deck.width) * 100}cqw * var(--fit, 1))`,
});

function ShapeView({ deck, shape }: { deck: PptxDeck; shape: PptxShape }) {
  const { u } = units(deck);
  const { x, y, w, h } = shape.box;
  const position: React.CSSProperties = { position: "absolute", left: `${(x / deck.width) * 100}%`, top: `${(y / deck.height) * 100}%`, width: `${(w / deck.width) * 100}%`, height: `${(h / deck.height) * 100}%` };

  if (shape.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- a blob: URL read from the file itself; next/image can't optimise it
    return <img src={shape.src} alt="" style={{ ...position, objectFit: "fill" }} />;
  }
  if (shape.kind === "line") {
    // Drawn in the shape's own EMU coordinates, padded by the stroke width so horizontal/vertical lines (0 high/wide)
    // still have a box; the uniform scale keeps the stroke at its real thickness relative to the slide.
    const pad = shape.width;
    const [x1, x2] = shape.flipH ? [w, 0] : [0, w];
    const [y1, y2] = shape.flipV ? [h, 0] : [0, h];
    return (
      <svg
        aria-hidden
        viewBox={`${-pad} ${-pad} ${w + 2 * pad} ${h + 2 * pad}`}
        preserveAspectRatio="none"
        style={{ position: "absolute", left: `${((x - pad) / deck.width) * 100}%`, top: `${((y - pad) / deck.height) * 100}%`, width: `${((w + 2 * pad) / deck.width) * 100}%`, height: `${((h + 2 * pad) / deck.height) * 100}%`, overflow: "visible" }}
      >
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={shape.color} strokeWidth={shape.width} strokeDasharray={shape.dash ? `${shape.width * 4} ${shape.width * 3}` : undefined} />
      </svg>
    );
  }
  if (shape.kind === "table") {
    const total = shape.columns.reduce((a, b) => a + b, 0) || 1;
    return (
      <table style={{ ...position, borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>{shape.columns.map((c, i) => <col key={i} style={{ width: `${(c / total) * 100}%` }} />)}</colgroup>
        <tbody>
          {shape.rows.map((row, r) => (
            <tr key={r}>
              {row.cells.map((cell, c) => (
                <td key={c} style={{ border: "1px solid #9ca3af", padding: `${u(45720)} ${u(91440)}`, background: cell.fill ?? undefined, verticalAlign: "top" }}>
                  <Paragraphs deck={deck} paragraphs={cell.paragraphs} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return <TextBox deck={deck} shape={shape} position={position} />;
}

// A text box. Text may run past its own box, as in PowerPoint — but the deck's fonts usually aren't installed in the
// browser, and a wider fallback font can push text past the slide's edge, where it would be clipped. So once fonts
// are ready the box measures its visible text and, only if some would leave the slide, lowers --fit just enough to
// keep it on the slide (never below 40%). Every size is relative to the slide's width, so the factor holds at any panel size.
function TextBox({ deck, shape, position }: { deck: PptxDeck; shape: Extract<PptxShape, { kind: "text" }>; position: React.CSSProperties }) {
  const { u } = units(deck);
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = boxRef.current, inner = innerRef.current;
    if (!box || !inner) return;
    let cancelled = false;
    const slide = box.parentElement!;
    // Only visible text counts: authors often pad a title with blank lines, which PowerPoint lets sit off-slide.
    const textSpans = [...inner.querySelectorAll<HTMLElement>("span:not([aria-hidden])")].filter((el) => el.textContent?.trim());
    const fits = () => {
      const s = slide.getBoundingClientRect();
      return textSpans.every((el) => { const t = el.getBoundingClientRect(); return t.top >= s.top - 1 && t.bottom <= s.bottom + 1; });
    };
    const fit = () => {
      if (cancelled) return;
      box.style.setProperty("--fit", "1");
      if (fits()) return;
      let lo = 0.4, hi = 1;
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        box.style.setProperty("--fit", String(mid));
        if (fits()) lo = mid;
        else hi = mid;
      }
      box.style.setProperty("--fit", String(lo));
    };
    fit();
    document.fonts?.ready.then(fit);
    return () => {
      cancelled = true;
    };
  }, [shape]);

  const [l, t, r, b] = shape.insets;
  return (
    <div
      ref={boxRef}
      style={{
        ...position,
        display: "flex",
        flexDirection: "column",
        justifyContent: shape.anchor,
        padding: `${u(t)} ${u(r)} ${u(b)} ${u(l)}`,
        background: shape.fill ?? undefined,
        border: shape.border ? `max(1px, ${u(shape.border.width)}) solid ${shape.border.color}` : undefined,
        borderRadius: shape.round === "ellipse" ? "50%" : shape.round === "round" ? "8%" : undefined,
        overflowWrap: "break-word",
      }}
    >
      <div ref={innerRef}>
        <Paragraphs deck={deck} paragraphs={shape.paragraphs} />
      </div>
    </div>
  );
}

function Paragraphs({ deck, paragraphs }: { deck: PptxDeck; paragraphs: PptxParagraph[] }) {
  const { u, pt } = units(deck);
  return paragraphs.map((p, i) => {
    const empty = p.runs.every((r) => !r.text && !r.lineBreak);
    return (
      <p
        key={i}
        style={{
          margin: 0,
          marginTop: i === 0 ? 0 : pt(p.spaceBeforePt),
          paddingLeft: u(p.marginLeft),
          textIndent: p.bullet ? undefined : u(p.indent),
          textAlign: p.align,
          lineHeight: p.lineHeight,
          whiteSpace: "pre-wrap",
          fontSize: pt(p.emptySizePt),
        }}
      >
        {p.bullet && (
          // Inline (so it sits on the first line's baseline) and pulled into the hanging indent.
          <span
            aria-hidden
            style={{
              display: "inline-block",
              marginLeft: p.indent < 0 ? u(p.indent) : undefined,
              width: p.indent < 0 ? u(-p.indent) : undefined,
              paddingRight: p.indent < 0 ? undefined : "0.4em",
              textIndent: 0,
              color: p.bullet.color,
              fontSize: pt(p.bullet.sizePt),
            }}
          >
            {p.bullet.char}
          </span>
        )}
        {empty
          ? " "
          : p.runs.map((r, j) =>
              r.lineBreak ? (
                <br key={j} />
              ) : (
                <span
                  key={j}
                  style={{
                    fontSize: pt(r.sizePt),
                    fontWeight: r.bold ? 700 : undefined,
                    fontStyle: r.italic ? "italic" : undefined,
                    textDecoration: r.underline ? "underline" : undefined,
                    color: r.color,
                    fontFamily: r.font ? safeFont(r.font) : undefined,
                  }}
                >
                  {r.text}
                </span>
              ),
            )}
      </p>
    );
  });
}
