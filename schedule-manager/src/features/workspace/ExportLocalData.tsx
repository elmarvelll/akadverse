"use client";
import { useState } from "react";

export function ExportLocalData() {
  const [error, setError] = useState("");
  return <><button type="button" onClick={() => {
    try {
      const data = {
        tasks: JSON.parse(localStorage.getItem("productivity-layer.tasks.v1") || '{"version":2,"tasks":[]}'),
        habits: JSON.parse(localStorage.getItem("productivity-layer.habits.v1") || '{"version":1,"habits":[]}'),
        schedule: JSON.parse(localStorage.getItem("productivity-layer.schedule.v1") || '{"version":1,"events":[],"schedules":[]}'),
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "productivity-export.json"; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000); setError("");
    } catch { setError("Export failed. Your local records remain unchanged."); }
  }}>Export for AkadVerse</button>{error && <span role="alert">{error}</span>}</>;
}
