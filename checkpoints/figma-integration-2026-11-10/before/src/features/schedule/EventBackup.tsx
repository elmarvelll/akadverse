import type { PersonalEvent } from "./domain";

export function EventBackup({ event }: { event: Pick<PersonalEvent, "backup"> }) {
  return <><dt>Backup</dt><dd>{event.backup ? `${event.backup.date} · ${event.backup.start}–${event.backup.end}` : "No backup time set"}</dd></>;
}
