"use client";
import { useEffect, useRef, type CSSProperties } from "react";
import { Icon } from "../workspace/Design";
import { HabitBadge } from "../habits/HabitLabel";
import { DAY_HEIGHT, HOUR_HEIGHT, initialTimetableScroll, minuteLabel, placeTimetable, timetableEventGeometry, timetableHours, type TimetableEntry } from "./timetable";

// Adapted from the rendered student/ScheduleManager.tsx: 72px hourly axis,
// date columns, tinted inset event cards and compact conflict indicators.
export function Timetable({ entries, dates, today, currentTime, selectedDate, conflicts, onDate, onOpen }: { entries: TimetableEntry[]; dates: string[]; today: string; currentTime: string; selectedDate: string; conflicts: Map<string, unknown[]>; onDate: (date: string) => void; onOpen: (entry: TimetableEntry) => void }) {
  const scroll = useRef<HTMLDivElement>(null), initializedRange = useRef("");
  const placed = placeTimetable(entries);
  const rangeKey = dates.join(",");
  useEffect(() => {
    if (scroll.current && rangeKey && initializedRange.current !== rangeKey) {
      scroll.current.scrollTop = initialTimetableScroll(rangeKey.split(","), today, currentTime);
      initializedRange.current = rangeKey;
    }
  }, [rangeKey, today, currentTime]);
  const columns = { gridTemplateColumns: `64px repeat(${dates.length}, minmax(${dates.length === 1 ? 300 : 135}px, 1fr))` };
  return <div className="timetable-scroll" ref={scroll} role="region" aria-label={`${dates.length === 1 ? "Day" : "Week"} timetable. Scroll for additional hours or days.`} tabIndex={0}>
    <div className="timetable" style={columns}>
      <div className="timetable-corner">Time</div>{dates.map(date => <button type="button" key={date} className={`timetable-day-head ${date === today ? "is-today" : ""} ${date === selectedDate ? "is-selected" : ""}`} aria-pressed={date === selectedDate} onClick={() => onDate(date)}><span>{new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"))}</span><strong>{Number(date.slice(-2))}</strong>{date === today && <small>Today</small>}</button>)}
      <div className="timetable-axis" style={{ height: DAY_HEIGHT }}>{timetableHours.map(hour => <span key={hour} style={{ top: hour * HOUR_HEIGHT }}>{`${hour % 12 || 12}:00 ${hour < 12 ? "AM" : "PM"}`}</span>)}</div>
      {dates.map(date => <div className={`timetable-day ${date === today ? "today-column" : ""}`} key={date} style={{ height: DAY_HEIGHT }}>
        {placed.filter(item => item.displayDate === date).map(item => {
          const kindLabel = { academic: "Official class", personal: "Event", task: "Task", habit: "Habit" }[item.kind];
          const clash = !!conflicts.get(item.id)?.length || placed.some(other => other.id !== item.id && other.displayDate === date && other.startMinute < item.endMinute && other.endMinute > item.startMinute);
          const start = minuteLabel(item.startMinute), end = minuteLabel(item.endMinute);
          const style: CSSProperties = { ...timetableEventGeometry(item.startMinute, item.endMinute), left: `calc(${item.column / item.columns * 100}% + 4px)`, width: `calc(${100 / item.columns}% - 8px)` };
          return <button type="button" key={item.id} className={`time-event time-${item.kind} ${item.endMinute - item.startMinute <= 45 ? "time-compact" : ""} ${clash ? "has-conflict" : ""}`} style={style} onClick={() => onOpen(item)} aria-label={`${item.title}, ${date}, ${start} to ${end}, ${kindLabel}, ${item.category}${item.priority ? `, ${item.priority} priority` : ""}${item.outcome ? `, ${item.outcome}` : ""}${clash ? ", Time conflict" : ""}`} title={`${kindLabel} · ${item.title} · ${start}–${end}${clash ? " · Time conflict" : ""}`}>
            <span className="time-event-name">{item.kind === "academic" && <Icon name="education"/>}{item.title}</span>
            <span className="time-event-time">{start}–{end}</span>
            <span className="time-event-tags">{item.kind === "habit" ? <HabitBadge/> : <span>{kindLabel}</span>}{item.category !== kindLabel && <span>{item.category}</span>}{item.priority && <span>{item.priority}</span>}{item.outcome && item.outcome !== "unrecorded" && <span>{item.outcome}</span>}</span>
            {item.venue && <span className="time-event-venue">{item.venue}</span>}
            {clash && <span className="time-conflict" aria-label="Time conflict" title="Time conflict">!</span>}
          </button>;
        })}
      </div>)}
    </div>
  </div>;
}
