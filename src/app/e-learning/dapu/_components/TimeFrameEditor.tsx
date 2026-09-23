// src/app/e-learning/dapu/_components/TimeFrameEditor.tsx
//
// Shared UI for all five Academic Time Frame pages — the same "current status + set start/end for
// the current session/semester" shape for every type. Course Registration is ONE period, set
// here by DAPU (start AND end timestamps); the phase (Upcoming / Active / Ended) is computed from
// those timestamps and the server clock, never from a stored flag.

import { requireElearningRole, requireDapuProfile } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { getTimeFrame } from "@/services/e-learning/shared/timeframes";
import { saveTimeFrameAction } from "../timeframes/actions";
import DateTimeRange, { LocalTime } from "./DateTimeRange";
import type { TimeFrameType } from "@/generated/prisma-elearning";
import SubmitButton from "@/app/e-learning/_components/SubmitButton";

const PHASE: Record<string, { label: string; cls: string }> = {
  NOT_CONFIGURED: { label: "Not configured", cls: "bg-gray-200 text-gray-900" },
  UPCOMING: { label: "Upcoming", cls: "bg-amber-100 text-amber-900" },
  ACTIVE: { label: "Active", cls: "bg-green-100 text-green-900" },
  ENDED: { label: "Ended", cls: "bg-red-100 text-red-900" },
};

export async function TimeFrameEditor({ type, title, error }: { type: TimeFrameType; title: string; error?: string }) {
  await requireElearningRole(["dapu"]).then(requireDapuProfile);
  const academicContext = await getCurrentAcademicContext();

  if (!academicContext?.session || !academicContext.semester) {
    return <p className="text-sm text-gray-800">No current academic session and semester are set yet.</p>;
  }
  const t = await getTimeFrame(type, academicContext.session.id, academicContext.semester.id);
  const ph = PHASE[t.phase];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-800 text-sm mt-1">{academicContext.session.name} · {academicContext.semester.name}</p>
      </div>
      {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>}

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1.5">Status</p>
        <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${ph.cls}`}>{ph.label}</span>
        {t.startAt && t.endAt ? (
          <p className="mt-2 text-sm text-gray-900">Opens <strong><LocalTime iso={t.startAt.toISOString()} /></strong> · Closes <strong><LocalTime iso={t.endAt.toISOString()} /></strong></p>
        ) : (
          <p className="mt-2 text-sm text-gray-900">Not configured yet — every dependent action treats this as closed.</p>
        )}
      </div>

      <form action={saveTimeFrameAction} className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-wrap items-end gap-3">
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="academicSessionId" value={academicContext.session.id} />
        <input type="hidden" name="semesterId" value={academicContext.semester.id} />
        <DateTimeRange start={t.startAt?.toISOString() ?? null} end={t.endAt?.toISOString() ?? null} />
        <SubmitButton className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition">Save</SubmitButton>
      </form>
    </div>
  );
}
