// Fetching a course document from the browser. Every request goes through /api/e-learning/documents/[id]/access,
// which re-checks the student's registration and returns a 60-second signed Storage URL.

export const GENERIC_ERROR = "Unable to load this document. Please try again.";

// Messages for refused requests (4xx) are written for students and are shown as-is; anything else becomes a generic
// message so no technical detail reaches the page.
export async function requestDocumentUrl(id: string, inline: boolean): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`/api/e-learning/documents/${id}/access${inline ? "?inline=1" : ""}`, { cache: "no-store" });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (res.ok && body.url) return body.url;
  throw new Error(res.status < 500 && body.error ? body.error : GENERIC_ERROR);
}

// The file's bytes, for formats the browser can't display itself (PowerPoint / Word are rendered from these).
export async function fetchDocumentBytes(id: string): Promise<ArrayBuffer> {
  const url = await requestDocumentUrl(id, true);
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error();
    return await res.arrayBuffer();
  } catch {
    throw new Error(GENERIC_ERROR);
  }
}
