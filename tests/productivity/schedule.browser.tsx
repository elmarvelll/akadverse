import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { TaskForm } from "../../src/features/productivity/tasks/TaskForm";
import { TaskService } from "../../src/features/productivity/tasks/service";
import { emptyTasks, type Task, type TaskDataset } from "../../src/features/productivity/tasks/domain";
import { Timetable } from "../../src/features/productivity/schedule/ScheduleTimetable";
import { taskTimetableEntries } from "../../src/features/productivity/schedule/timetable";
const student = { id: "local-fixture", name: "Fixture", timezone: "Africa/Lagos", development: true };
function fixtureService(notify: (value: TaskDataset) => void) {
  let stored = emptyTasks();
  return new TaskService({ load: async () => structuredClone(stored), save: async value => { stored = structuredClone(value); notify(structuredClone(value)); } }, { getCurrentStudent: async () => student });
}
function Harness() {
  const [snapshot, setSnapshot] = useState(emptyTasks);
  const [editor, setEditor] = useState<{ task?: Task }>();
  const [date, setDate] = useState("2030-01-15");
  const [detail, setDetail] = useState("");
  const [service] = useState(() => fixtureService(setSnapshot));
  const task = snapshot.tasks[0];
  const entries = [...taskTimetableEntries(snapshot.tasks, student.id, student.timezone, [date]), ...(date === "2030-01-15" ? [{ id: "meeting", title: "Project Team Meeting", slot: { date, start: "09:30", end: "10:30", timezone: student.timezone }, kind: "personal" as const, category: "Event" }] : [])];
  return <div className="productivity-host"><div className="productivity-workspace" style={{ padding: 24 }}>
    <h1>Schedule component acceptance fixture</h1><p>Local in-memory source records; no database or provider requests.</p>
    <button id="create-task" onClick={() => setEditor({})}>New task</button>
    <button id="edit-task" disabled={!task} onClick={() => setEditor({ task })}>Edit task</button>
    <button id="complete-task" disabled={!task} onClick={() => void service.completeTask(task!.id)}>Complete task</button>
    <button id="delete-task" disabled={!task} onClick={() => void service.deleteTask(task!.id)}>Delete task</button>
    <button id="next-day" onClick={() => setDate("2030-01-16")}>Next day</button>
    <p id="details">{detail}</p>
    <Timetable entries={entries} dates={[date]} today="2030-01-15" currentTime="08:00" selectedDate={date} conflicts={new Map()} onDate={setDate} onOpen={entry => setDetail(entry.id)}/>
    {editor && <TaskForm task={editor.task} timezone={student.timezone} onClose={() => setEditor(undefined)} onSave={async input => { if (editor.task) await service.updateTask(editor.task.id, input); else await service.createTask(input); }}/>} 
  </div></div>;
}
createRoot(document.getElementById("root")!).render(<Harness/>);
