// Which week and which document the Study Zone shows — the selection rules, kept as pure functions so they can be
// tested without a browser and so the dropdown, the viewer and Stewart can never disagree about "the current document".
//
// Identity is always the document's stable id (the CourseMaterial id), never its title, file name or position:
// two notes in a week may share a title or file name, and positions shift when a lecturer adds or removes one.

import type { StudyDocument, StudyWeek } from "@/services/e-learning/student/study-zone";

// The student's explicit pick per week (week number -> document id). A week with no entry shows its first document.
export type ChosenDocuments = Record<number, string>;

export interface StudySelection {
  week: StudyWeek;
  // The document to mount in the viewer; null when the week has none.
  document: StudyDocument | null;
  // True when the student had picked a document for this week that is no longer in the list (the lecturer removed it,
  // or access changed) — the selection has fallen back to the week's first document and the UI should say so.
  chosenIsGone: boolean;
}

// The week opened by default: the first one that has material, else the first week.
export function initialWeek(weeks: StudyWeek[]): number {
  return (weeks.find((w) => w.documents.length > 0) ?? weeks[0]).weekNumber;
}

export function resolveSelection(weeks: StudyWeek[], activeWeek: number, chosen: ChosenDocuments): StudySelection {
  const week = weeks.find((w) => w.weekNumber === activeWeek) ?? weeks[0];
  const chosenId = chosen[week.weekNumber];
  const picked = chosenId ? week.documents.find((d) => d.id === chosenId) : undefined;
  return {
    week,
    document: picked ?? week.documents[0] ?? null,
    chosenIsGone: Boolean(chosenId) && !picked,
  };
}

// What the dropdown shows for one document. Titles aren't unique, so the category is always part of the label and a
// repeated label within the week gets its file name appended to tell the entries apart.
export function documentOptionLabels(documents: StudyDocument[]): Map<string, string> {
  const base = (d: StudyDocument) => `${d.category}: ${d.title}`;
  const counts = new Map<string, number>();
  for (const d of documents) counts.set(base(d), (counts.get(base(d)) ?? 0) + 1);
  return new Map(documents.map((d) => [d.id, (counts.get(base(d)) ?? 0) > 1 ? `${base(d)} (${d.fileName})` : base(d)]));
}
