import { BrowserHabitRepository } from "./storage.ts";
import { HabitService } from "./service.ts";
import { TaskService } from "../tasks/service.ts";
import { BrowserTaskRepository } from "../tasks/storage.ts";
import { BrowserScheduleRepository } from "../schedule/storage.ts";
import { developmentIdentity, sampleAcademics } from "../schedule/adapters.ts";
export const browserHabits = new HabitService(new BrowserHabitRepository(), new TaskService(new BrowserTaskRepository(), developmentIdentity), new BrowserScheduleRepository(), developmentIdentity, sampleAcademics);
