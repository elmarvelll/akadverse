export interface CaptureRect { x: number; y: number; width: number; height: number }

// Clip to every scrolling/overflow ancestor, so content hidden behind viewer navigation never leaks into a crop.
function visibleBounds(node: HTMLElement, surface: HTMLElement) {
  const original = node.getBoundingClientRect();
  let left = original.left, top = original.top, right = original.right, bottom = original.bottom;
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const b = parent.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, b.left + parent.clientLeft); right = Math.min(right, b.left + parent.clientLeft + parent.clientWidth); }
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, b.top + parent.clientTop); bottom = Math.min(bottom, b.top + parent.clientTop + parent.clientHeight); }
    if (parent === surface) break;
  }
  return { left, top, right, bottom };
}

// Coordinates are viewport CSS pixels, derived at selection time. PDF pixels come from rendered canvases.
export async function captureRegion(surface: HTMLElement, rect: CaptureRect, pdf: boolean): Promise<File> {
  const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
  const output = document.createElement("canvas");
  if (rect.width * rect.height * scale * scale > 20_000_000) throw new Error("Choose a smaller area for a clear screenshot.");
  output.width = Math.round(rect.width * scale);
  output.height = Math.round(rect.height * scale);
  const ctx = output.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't prepare the screenshot.");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, output.width, output.height);
  if (pdf) {
    let drawn = false;
    for (const canvas of surface.querySelectorAll<HTMLCanvasElement>("canvas")) {
      const b = canvas.getBoundingClientRect();
      const visible = visibleBounds(canvas, surface);
      const left = Math.max(rect.x, visible.left), top = Math.max(rect.y, visible.top);
      const right = Math.min(rect.x + rect.width, visible.right), bottom = Math.min(rect.y + rect.height, visible.bottom);
      if (right <= left || bottom <= top) continue;
      if (!canvas.dataset.pdfReady) throw new Error("Wait for the selected PDF pages to finish rendering, then try again.");
      ctx.drawImage(canvas, (left - b.left) * canvas.width / b.width, (top - b.top) * canvas.height / b.height, (right - left) * canvas.width / b.width, (bottom - top) * canvas.height / b.height, (left - rect.x) * scale, (top - rect.y) * scale, (right - left) * scale, (bottom - top) * scale);
      drawn = true;
    }
    if (!drawn) throw new Error("Select part of a rendered document page.");
  } else {
    const pages = surface.querySelectorAll<HTMLElement>("article, [data-slide]");
    if (!pages.length) throw new Error("Wait for the document to load before capturing.");
    await document.fonts.ready;
    const { toCanvas } = await import("html-to-image");
    let drawn = false;
    // Capture page content directly, so nested scrolling cannot reset the clone to the top of the document.
    for (const page of pages) {
      const b = page.getBoundingClientRect();
      const visible = visibleBounds(page, surface);
      const left = Math.max(rect.x, visible.left), top = Math.max(rect.y, visible.top);
      const right = Math.min(rect.x + rect.width, visible.right), bottom = Math.min(rect.y + rect.height, visible.bottom);
      if (right <= left || bottom <= top) continue;
      const rendered = await toCanvas(page, {
        width: right - left, height: bottom - top, pixelRatio: scale, skipAutoScale: true,
        style: { width: `${b.width}px`, height: `${b.height}px`, margin: "0", transformOrigin: "0 0", transform: `translate(${b.left - left}px, ${b.top - top}px)` },
        filter: (node) => !(node instanceof Element && node.hasAttribute("data-capture-exclude")),
      });
      ctx.drawImage(rendered, (left - rect.x) * scale, (top - rect.y) * scale);
      drawn = true;
    }
    if (!drawn) throw new Error("Select part of the document content.");
  }
  const blob = await new Promise<Blob>((resolve, reject) => output.toBlob((b) => b ? resolve(b) : reject(new Error("Screenshot encoding failed.")), "image/png"));
  const date = new Date();
  const stamp = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()].map((n) => String(n).padStart(2, "0")).join("-");
  return new File([blob], `Screenshot-${stamp}.png`, { type: "image/png" });
}
