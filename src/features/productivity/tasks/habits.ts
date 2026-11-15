import { ProductivityError } from "../errors";
import type { TaskService } from "./service";
// Shared task-occurrence gateway. The tracker recurrence service uses the same
// TaskService operations, rather than maintaining a second completion field.
export class HabitTaskGateway {
  constructor(private tasks: TaskService) {}
  receive: TaskService["receiveHabitOccurrence"] = (input, dates) => this.tasks.receiveHabitOccurrence(input, dates);
  async getOccurrence(habitId: string, occurrenceId: string) {
    const occurrence = (await this.tasks.listTasks()).find(task => task.source.kind === "habit" && task.source.habitId === habitId && task.source.occurrenceId === occurrenceId);
    if (!occurrence) throw new ProductivityError("Habit occurrence not found for this student.");
    return occurrence;
  }
  async completeOccurrence(habitId: string, occurrenceId: string) {
    return this.tasks.completeTask((await this.getOccurrence(habitId, occurrenceId)).id);
  }
  async recordMiss(habitId: string, occurrenceId: string) {
    return this.tasks.recordHabitMiss((await this.getOccurrence(habitId, occurrenceId)).id);
  }
  async totals(date: string) {
    const occurrences = (await this.tasks.listTasks()).filter(task => !task.habitWithdrawn && task.source.kind === "habit" && task.source.scheduledDate === date);
    return { scheduled: occurrences.length, completed: occurrences.filter(task => task.status === "completed").length, missed: occurrences.filter(task => task.status === "missed").length, pending: occurrences.filter(task => task.status === "pending").length };
  }
}
