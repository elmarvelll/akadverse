// src/lib/course-materials/config.ts
//
// Course-material rules shared by the browser (to show/validate early) and the server (which
// enforces them again — the browser is never trusted). The 8 MB limit is defined ONCE, here.
// Safe to import from client components: no server-only code.

export const MAX_MATERIAL_BYTES = 8 * 1024 * 1024; // 8 MB per file
export const MAX_MATERIAL_MB = MAX_MATERIAL_BYTES / (1024 * 1024);

export const MATERIAL_TYPES = ["NOTES", "ASSIGNMENT", "QUIZ"] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];
export const MATERIAL_LABELS: Record<MaterialType, { singular: string; plural: string; icon: string }> = {
  NOTES: { singular: "Notes", plural: "Notes", icon: "📄" },
  ASSIGNMENT: { singular: "Assignment", plural: "Assignments", icon: "📎" },
  QUIZ: { singular: "Quiz", plural: "Quizzes", icon: "📝" },
};

// Documents a lecturer may share: exactly what the Storage bucket accepts. Checked by extension AND the
// MIME type the browser reports (a browser may report an empty or platform-specific type for a zip, so those are listed).
export const ALLOWED_TYPES: Record<string, string[]> = {
  pdf: ["application/pdf"],
  zip: ["application/zip", "application/x-zip-compressed", "application/octet-stream", ""],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
};
export const ALLOWED_EXTENSIONS = Object.keys(ALLOWED_TYPES) as readonly string[] as readonly ("pdf" | "zip" | "docx" | "pptx")[];
// The canonical MIME type stored for each extension (also what the bucket's allow-list contains).
export const CANONICAL_MIME: Record<string, string> = { pdf: "application/pdf", zip: "application/zip", docx: ALLOWED_TYPES.docx[0], pptx: ALLOWED_TYPES.pptx[0] };

export const extensionOf = (name: string) => (name.split(".").length > 1 ? name.split(".").pop()!.toLowerCase() : "");

// Returns an error message, or null when the file's metadata is acceptable.
export function checkFileMeta(name: string, size: number, mimeType?: string): string | null {
  if (!name.trim()) return "Choose a file to upload.";
  if (!Number.isFinite(size) || size <= 0) return "That file is empty.";
  if (size > MAX_MATERIAL_BYTES) return `That file is too large. The maximum is ${MAX_MATERIAL_MB} MB per file.`;
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extensionOf(name))) return `That file type isn't supported. Allowed: PDF, DOCX, PPTX, ZIP.`;
  if (mimeType !== undefined && !ALLOWED_TYPES[extensionOf(name)].includes(mimeType)) return "That file's type doesn't match its extension. Allowed: PDF, DOCX, PPTX, ZIP.";
  return null;
}

export function safeFileName(name: string) {
  const ext = extensionOf(name);
  const base = name.slice(0, name.length - (ext ? ext.length + 1 : 0)).normalize("NFKD").replace(/[^\w.\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "file";
  return ext ? `${base}.${ext}` : base;
}

// Weeks in a semester, from its own start/end dates — never a hard-coded "14 weeks".
export function weeksInSemester(start: Date, end: Date) {
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  return Math.ceil(days / 7);
}

export const weekRangeLabel = (start: number, end: number) => (start === end ? `Week ${start}` : `Weeks ${start}–${end}`);
