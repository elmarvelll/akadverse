import { settingsFor, type Habit } from "./domain";

export function HabitBadge() {
  return <span className="badge habit-badge">Habit</span>;
}

export function HabitRecurrence({ habit, date }: { habit?: Habit; date: string }) {
  const settings = habit && settingsFor(habit, date);
  if (!settings) return <p className="hint">Repeating settings unavailable. Review the source habit in Habit Tracker.</p>;
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return <p className="hint">Recurrence: {settings.frequency === "daily" ? "Daily" : settings.weekdays.map(day => days[day]).join(", ")} · {settings.type === "task" ? "Task" : "Event"}{settings.archived ? " · Archived" : ""}. Repeating settings are managed in Habit Tracker; this item is one occurrence.</p>;
}
