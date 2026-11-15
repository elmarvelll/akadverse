import type { HabitInput } from "./domain";

// Keep the HH:mm format used by habit settings and event details. These are
// already local wall-clock times; no browser-timezone conversion is needed.
export function habitScheduleDescription(settings: HabitInput) {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days = settings.frequency === "daily" ? "Daily" : [1, 2, 3, 4, 5, 6, 0].filter(day => settings.weekdays.includes(day)).map(day => labels[day]).join(", ");
  if (!settings.time) return days;
  const time = settings.type === "task" ? `Due ${settings.time}` : `${settings.time}${settings.end ? `–${settings.end}` : ""}`;
  return `${days} · ${time}`;
}
