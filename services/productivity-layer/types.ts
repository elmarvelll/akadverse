import type { TaskDataset } from "@/features/productivity/tasks/domain";
import type { HabitData } from "@/features/productivity/habits/domain";
import type { Dataset, Student } from "@/features/productivity/schedule/domain";

export interface ProductivityData { tasks: TaskDataset; habits: HabitData; schedule: Dataset }
export interface ProductivityContext { student: Student; data: ProductivityData }
export interface ProductivityCommand { operation: string; args: unknown[]; requestId?: string }
