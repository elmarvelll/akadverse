// Verified against the deployed OpenAPI, 2026-11-15. No fallback indicator is published.
export interface AnalysisConcept {
  concept_id: string; title: string; description: string; learning_objective: string;
  difficulty: "introductory" | "intermediate" | "advanced";
  prerequisite_concept_ids: string[]; source_chunk_ids: string[];
}
export interface AnalysisResult {
  document_id: string; chunks_analysed: number;
  lesson_plan: { document_id: string; sections: { section_id: string; title: string; concept_ids: string[] }[];
    concepts: AnalysisConcept[]; missing_prerequisites: string[]; notes: string | null };
}
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 100_000;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 10000 && v.every(text);
export function validateAnalysis(value: unknown, documentId: string): AnalysisResult {
  const fail = (): never => { throw new Error("Invalid AI analysis response; contract review required."); };
  if (!value || typeof value !== "object") return fail();
  const b = value as AnalysisResult, p = b.lesson_plan;
  if (b.document_id !== documentId || !Number.isSafeInteger(b.chunks_analysed) || b.chunks_analysed <= 0 || b.chunks_analysed > 2147483647 ||
    !p || p.document_id !== documentId || !Array.isArray(p.sections) || !p.sections.length || p.sections.length > 1000 ||
    !Array.isArray(p.concepts) || !p.concepts.length || p.concepts.length > 1000) return fail();
  const ids = new Set<string>();
  for (const c of p.concepts) {
    if (!c || ![c.concept_id, c.title, c.description, c.learning_objective].every(text) ||
      !["introductory", "intermediate", "advanced"].includes(c.difficulty) || ids.has(c.concept_id) ||
      !strings(c.prerequisite_concept_ids ?? []) || !strings(c.source_chunk_ids ?? [])) return fail();
    ids.add(c.concept_id);
  }
  const sections = new Set<string>();
  for (const s of p.sections) {
    if (!s || !text(s.section_id) || !text(s.title) || sections.has(s.section_id) || !strings(s.concept_ids) || s.concept_ids.some(id => !ids.has(id))) return fail();
    sections.add(s.section_id);
  }
  if (!strings(p.missing_prerequisites ?? []) || (p.notes != null && typeof p.notes !== "string")) return fail();
  // Explicitly select public lesson-plan fields: never persist generated task answer keys here.
  return { document_id: b.document_id, chunks_analysed: b.chunks_analysed, lesson_plan: {
    document_id: p.document_id, sections: p.sections.map(s => ({ section_id: s.section_id, title: s.title, concept_ids: s.concept_ids })),
    concepts: p.concepts.map(c => ({ concept_id: c.concept_id, title: c.title, description: c.description, learning_objective: c.learning_objective,
      difficulty: c.difficulty, prerequisite_concept_ids: c.prerequisite_concept_ids ?? [], source_chunk_ids: c.source_chunk_ids ?? [] })),
    missing_prerequisites: p.missing_prerequisites ?? [], notes: p.notes ?? null,
  } };
}
export const ANALYSIS_CONCURRENCY = 3;
export const ANALYSIS_TIMEOUT_MS = 60_000;
export function retryAt(attempts: number, now = Date.now()) { return new Date(now + Math.min(3600, 60 * 2 ** Math.min(attempts - 1, 10)) * 1000); }
export async function processBatches<T>(claim: () => Promise<T[]>, process: (job: T) => Promise<void>, deadline: number) {
  let processed = 0;
  while (Date.now() + ANALYSIS_TIMEOUT_MS + 20_000 < deadline) {
    const jobs = await claim();
    if (!jobs.length) break;
    if (jobs.length > ANALYSIS_CONCURRENCY) throw new Error("Analysis claim exceeded global capacity.");
    await Promise.allSettled(jobs.map(process));
    processed += jobs.length;
  }
  return processed;
}
