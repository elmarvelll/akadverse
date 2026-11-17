import { localNow, type Dataset, type OfficialClass, type Student } from "../schedule/domain";
import { taskTimetableEntries } from "../schedule/timetable";
import { taskViewStatus, type Task } from "../tasks/domain";
import { todoTasks } from "../tasks/todo";
import { outcome, type Habit, type Occurrence } from "../habits/domain";
export function selectToday({ tasks, data, habits, occurrences, classes, student, instant }: { tasks: Task[]; data: Dataset; habits: Habit[]; occurrences: Occurrence[]; classes: OfficialClass[]; student: Student; instant: Date }) {
  const date = localNow(student.timezone, instant).date;
  const scoped = todoTasks(tasks.filter(task => task.ownerId === student.id), habits, student.timezone, instant).filter(task => !task.deletedAt && !task.habitWithdrawn);
  const onDate = (at?: string) => !!at && localNow(student.timezone, new Date(at)).date === date;
  const relevant = scoped.filter(task => task.status === "pending" ? !task.dueDate || task.dueDate <= date : task.dueDate === date || onDate(task.completedAt) || onDate(task.missedAt));
  const openTasks = relevant.filter(task => task.status === "pending").map(task => ({ ...task, viewStatus: taskViewStatus(task, student.timezone, instant) }));
  const sourceTasks = new Map(tasks.filter(task => task.ownerId === student.id).map(task => [task.id, task]));
  const activeEvents = data.events.filter(event => {
    if (event.ownerId !== student.id || event.archivedAt || event.slot.date !== date) return false;
    if (event.source.kind !== "task") return true;
    const task = sourceTasks.get(event.source.taskId);
    return !!task && !task.deletedAt && !task.habitWithdrawn && !task.scheduledSlot;
  }).map(event => {
    const task = event.source.kind === "task" ? sourceTasks.get(event.source.taskId) : undefined;
    return task ? { ...event, title: task.title, priority: task.priority } : event;
  });
  const events = [...new Map(activeEvents.map(event => [event.source.kind === "habit" ? `${event.source.habitId}:${event.originalSlot.date}` : event.id, event])).values()].sort((a, b) => a.slot.start.localeCompare(b.slot.start));
  const official = [...new Map(classes.filter(item => item.slot.date === date && item.state === "scheduled" && item.registrationState === "registered").map(item => [item.sourceId, item])).values()];
  const todayHabits = [...new Map(occurrences.filter(item => item.date === date && habits.some(habit => habit.id === item.habitId && habit.ownerId === student.id)).map(item => [item.id, item])).values()];
  return { date, openTasks, events, scheduledTasks: taskTimetableEntries(tasks, student.id, student.timezone, [date]), official, focus: events.filter(event => event.mustComplete && event.focusDate === date), habits: todayHabits, completedHabits: todayHabits.filter(item => outcome(item) === "completed").length, completedTasks: scoped.filter(task => task.status === "completed" && onDate(task.completedAt)).length };
}
export type TodayModel = ReturnType<typeof selectToday>;
