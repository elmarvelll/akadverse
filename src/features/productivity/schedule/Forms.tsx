"use client";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { SlotConflictError, duration, type Conflict, type EventInput, type PersonalEvent, type SchedulingOptions, type Student, type SubSchedule } from "./domain";
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="dialog-header">
        <h2 id="dialog-title">{title}</h2>
        <button type="button" aria-label="Close dialog" onClick={onClose}>
          ✕
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function formatDate(date: string, long = false) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: long ? "long" : "short",
    day: "numeric",
    month: long ? "long" : "short",
    ...(long ? { year: "numeric" as const } : {}),
  }).format(new Date(date + "T12:00:00Z"));
}
export function Stamp({
  value,
  timezone,
}: {
  value: string;
  timezone: string;
}) {
  return (
    <time dateTime={value}>
      {new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))}
    </time>
  );
}
export function EventForm({
  event,
  date,
  student,
  schedules,
  defaultScheduleId,
  onSave,
  onClose,
}: {
  event?: PersonalEvent;
  date: string;
  student: Student;
  schedules: SubSchedule[];
  defaultScheduleId?: string;
  onSave: (input: EventInput, eventId?: string, scheduling?: SchedulingOptions) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<EventInput>(() =>
    event
      ? {
          title: event.title,
          description: event.description,
          subScheduleId: event.subScheduleId,
          slot: { ...event.slot, date: event.status === "requires-replanning" ? date : event.slot.date },
          priority: event.priority,
          mustComplete: event.status === "requires-replanning" ? false : event.mustComplete,
          backup: event.status === "requires-replanning" ? undefined : event.backup,
        }
      : {
          title: "",
          description: "",
          subScheduleId: defaultScheduleId || schedules[0]?.id,
          slot: {
            date,
            start: "16:00",
            end: "17:00",
            timezone: student.timezone,
          },
          priority: "medium",
          mustComplete: false,
        },
  );
  const replanning = event?.status === "requires-replanning";
  const [scheduling, setScheduling] = useState<SchedulingOptions>({ mode: "manual" });
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [allowConflicts, setAllowConflicts] = useState(false);
  const [conflictSlot, setConflictSlot] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const options = scheduling.mode === "manual" ? { ...scheduling, allowConflicts: allowConflicts && conflictSlot === JSON.stringify(draft.slot) } : scheduling;
      await onSave(draft, event?.id, options);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof SlotConflictError) {
        setConflicts(e.conflicts);
        setConflictSlot(JSON.stringify(draft.slot));
        setAllowConflicts(false);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={replanning ? "Reschedule missed event" : event ? "Edit event" : "Create an event"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit} onChangeCapture={e => { if (e.target instanceof HTMLInputElement && ["date", "time"].includes(e.target.type)) { setAllowConflicts(false); setConflicts([]); } }}>
        <p className="muted">
          Plan your time · All times in {student.timezone}. Completion is updated in the activity’s own tracker.
        </p>
        <fieldset disabled={busy}>
          <label>
            Event title
            <input
              required
              autoFocus
              maxLength={100}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="e.g. Leg day"
            />
          </label>
          <label>
            Detailed description
            <textarea
              required
              rows={4}
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              placeholder="What will you do? Include the details you need."
            />
          </label>
          <label>
            Sub-category
            <select
              required
              value={draft.subScheduleId || ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  subScheduleId: e.target.value || undefined,
                })
              }
            >
              <option value="" disabled>Select an existing sub-category</option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {replanning && <label>Rescheduling<select value={scheduling.mode} onChange={e => { setScheduling(e.target.value === "smart" ? { mode: "smart", durationMinutes: duration(draft.slot), earliest: "08:00", latest: "22:00" } : { mode: "manual" }); setConflicts([]); setAllowConflicts(false); setError(""); }}><option value="manual">Manual — choose a time</option><option value="smart">Smart — find a free slot</option></select></label>}
          <label>
            Date
            <input
              type="date"
              required
              value={draft.slot.date}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  slot: { ...draft.slot, date: e.target.value },
                  mustComplete: false,
                })
              }
            />
          </label>
          {!replanning || scheduling.mode === "manual" ? <div className="form-row">
            <label>
              Start time
              <input
                type="time"
                required
                value={draft.slot.start}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    slot: { ...draft.slot, start: e.target.value },
                  })
                }
              />
            </label>
            <label>
              End time
              <input
                type="time"
                required
                value={draft.slot.end}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    slot: { ...draft.slot, end: e.target.value },
                  })
                }
              />
            </label>
          </div> : <>
            <label>Duration (minutes)<input type="number" min={1} max={1439} required value={scheduling.durationMinutes} onChange={e => setScheduling({ ...scheduling, durationMinutes: Number(e.target.value) })} /></label>
            <div className="form-row">
              <label>Earliest start<input type="time" required value={scheduling.earliest} onChange={e => setScheduling({ ...scheduling, earliest: e.target.value })} /></label>
              <label>Finish by<input type="time" required value={scheduling.latest} onChange={e => setScheduling({ ...scheduling, latest: e.target.value })} /></label>
            </div>
          </>}
          <p className="hint">
            {scheduling.mode === "smart" ? "Finds the first free slot on this date, checking all activities and lectures. If none fits, choose another day or use manual scheduling." : "An end time earlier than the start means the following day. Clashes are flagged before saving; keeping a clash requires your explicit choice."}
          </p>
          {scheduling.mode === "manual" && conflicts.length > 0 && conflictSlot === JSON.stringify(draft.slot) && <div className="conflict-warning" role="alert">
            <strong>This time overlaps other commitments</strong>
            <ul>{conflicts.map(c => <li key={c.id}>{c.title} · {c.slot.start}–{c.slot.end}</li>)}</ul>
            <label className="check"><input type="checkbox" checked={allowConflicts} onChange={e => setAllowConflicts(e.target.checked)} />Keep this time and show the conflict on the schedule</label>
          </div>}
          <label>
            Priority
            <select
              value={draft.priority}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  priority: e.target.value as EventInput["priority"],
                })
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          {event && event.slot.date !== draft.slot.date && (
            <p className="notice">
              The old focus commitment stays in history. Explicitly choose the
              new day’s commitment below.
            </p>
          )}
          <label className="check">
            <input type="checkbox" checked={!!draft.backup} onChange={e => setDraft({ ...draft, backup: e.target.checked ? { ...draft.slot, date: "" } : undefined })} />
            Use a backup time
          </label>
          {draft.backup && <>
            <p className="hint">Choose a later slot with the same duration as the event.</p>
            <label>Backup date<input type="date" required value={draft.backup.date} onChange={e => setDraft({ ...draft, backup: { ...draft.backup!, date: e.target.value } })} /></label>
            <div className="form-row">
              <label>Backup start<input type="time" required value={draft.backup.start} onChange={e => setDraft({ ...draft, backup: { ...draft.backup!, start: e.target.value } })} /></label>
              <label>Backup end<input type="time" required value={draft.backup.end} onChange={e => setDraft({ ...draft, backup: { ...draft.backup!, end: e.target.value } })} /></label>
            </div>
          </>}
          <label className="check">
            <input
              type="checkbox"
              checked={draft.mustComplete}
              onChange={(e) =>
                setDraft({ ...draft, mustComplete: e.target.checked })
              }
            />
            Must complete on {draft.slot.date || "the selected date"}
          </label>
        </fieldset>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <footer className="dialog-footer">
          <button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy || !schedules.length}>
            {busy ? "Saving…" : scheduling.mode === "smart" ? "Find time and save" : "Save event"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
export function ScheduleForm({
  schedule,
  onSave,
  onClose,
}: {
  schedule?: SubSchedule;
  onSave: (name: string, description: string, id?: string, academic?: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(schedule?.name || ""),
    [academic, setAcademic] = useState(schedule?.academic || false),
    [description, setDescription] = useState(schedule?.description || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(name, description, schedule?.id, academic);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={schedule ? "Edit sub-category" : "New sub-category"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>
            Name
            <input
              autoFocus
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Exercise"
            />
          </label>
          <label>
            Description
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What part of your life is this for?"
            />
          </label>
          <label className="check"><input type="checkbox" checked={academic} onChange={e => setAcademic(e.target.checked)} />Include official academic timetable sessions</label>
        </fieldset>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <footer className="dialog-footer">
          <button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save sub-category"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
