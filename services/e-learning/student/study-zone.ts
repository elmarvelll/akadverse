// services/e-learning/student/study-zone.ts
//
// Read model for the Study Zone: a registered course as a sequence of weeks, each with the documents a lecturer
// uploaded for it. The UI only ever sees the plain types below, so this file is the single boundary to swap when
// course/week/document data moves behind a dedicated API. Built on the same queries as My Learning: a course must be
// in the student's APPROVED registration for the current session/semester (getRegisteredCourses enforces it), and
// documents come from that course's own offering. Opening a file still goes through
// /api/e-learning/documents/[id]/access, which re-authorizes every request.

import type { CurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { getOfferingDetail } from "@/services/e-learning/shared/offering-detail";
import { getRegisteredCourses, type RegisteredCourse } from "@/services/e-learning/student/registered-courses";
import { CANONICAL_MIME, MATERIAL_LABELS, MATERIAL_TYPES, weekRangeLabel } from "@/lib/course-materials/config";

// How the viewer displays a file. Anything that isn't PDF / PowerPoint / Word (today: ZIP) is "other".
export type StudyDocumentKind = "pdf" | "pptx" | "docx" | "other";

export interface StudyDocument {
  id: string;
  title: string;
  description: string | null;
  kind: StudyDocumentKind;
  // "Notes" / "Assignment" / "Quiz" — the lecturer's category for the upload.
  category: string;
  fileName: string;
  fileSize: number;
  // "Week 3" or "Weeks 1–3": a multi-week document appears in every week it covers.
  rangeLabel: string;
}

export interface StudyWeek {
  weekNumber: number;
  // What the week is about, taken from its main document's title (weeks have no titles of their own); null when empty.
  topic: string | null;
  // Notes first, then assignments, then quizzes. Empty when nothing was uploaded for the week.
  documents: StudyDocument[];
}

export interface StudyCourse {
  id: string;
  code: string;
  title: string;
  level: number | null;
  creditUnits: number;
  courseType: string | null;
  lecturerName: string | null;
  sessionName: string;
  semesterName: string;
}

export interface StudyWorkspaceData {
  course: StudyCourse;
  // Empty when the course has no offering yet (no lecturer assigned, so nowhere for materials to live).
  weeks: StudyWeek[];
}

const KIND_BY_MIME: Record<string, StudyDocumentKind> = {
  [CANONICAL_MIME.pdf]: "pdf",
  [CANONICAL_MIME.pptx]: "pptx",
  [CANONICAL_MIME.docx]: "docx",
};

const toStudyCourse = (c: RegisteredCourse): StudyCourse => ({
  id: c.id,
  code: c.code,
  title: c.title,
  level: c.level,
  creditUnits: c.creditUnits,
  courseType: c.courseType,
  lecturerName: c.lecturerName,
  sessionName: c.sessionName,
  semesterName: c.semesterName,
});

export async function getStudyCourses(studentUserId: string, ctx: CurrentAcademicContext): Promise<StudyCourse[]> {
  return (await getRegisteredCourses(studentUserId, ctx)).map(toStudyCourse);
}

// null when the course isn't one of this student's approved courses (the caller renders a 404).
export async function getStudyWorkspace(studentUserId: string, ctx: CurrentAcademicContext, courseId: string): Promise<StudyWorkspaceData | null> {
  const registered = (await getRegisteredCourses(studentUserId, ctx)).find((c) => c.id === courseId);
  if (!registered) return null;
  const course = toStudyCourse(registered);
  if (!registered.offeringId) return { course, weeks: [] };

  const detail = await getOfferingDetail(registered.offeringId);
  const typeOrder = (t: string) => MATERIAL_TYPES.indexOf(t as (typeof MATERIAL_TYPES)[number]);
  const weeks = Array.from({ length: detail.totalWeeks }, (_, i): StudyWeek => {
    const weekNumber = i + 1;
    const documents = detail.materials
      .filter((m) => m.startWeek <= weekNumber && weekNumber <= m.endWeek)
      .sort((a, b) => typeOrder(a.type) - typeOrder(b.type))
      .map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        kind: KIND_BY_MIME[m.mimeType] ?? "other",
        category: MATERIAL_LABELS[m.type].singular,
        fileName: m.fileName,
        fileSize: m.fileSize,
        rangeLabel: weekRangeLabel(m.startWeek, m.endWeek),
      }));
    return { weekNumber, topic: documents[0]?.title ?? null, documents };
  });
  return { course, weeks };
}
