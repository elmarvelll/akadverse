import { requireElearningRole, requireStudentProfile } from "@/services/e-learning/shared/auth";
import RevisionsWorkspace from "./RevisionsWorkspace";
export default async function RevisionsPage() {
  const session = await requireElearningRole(["student"]); await requireStudentProfile(session);
  return <main className="mx-auto w-full max-w-5xl space-y-5 p-2 sm:p-4"><header><h1 className="text-3xl font-bold text-slate-900">Revisions</h1><p className="mt-2 text-sm text-slate-600">Practise what you have studied. Your review schedule stays the same across Course and Random revision.</p></header><RevisionsWorkspace /></main>;
}
