import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import dotenv from "dotenv";

const root = resolve(import.meta.dirname, "..");
const configured = {};
for (const file of [".env", ".env.local"]) {
  const path = resolve(root, file);
  if (existsSync(path)) Object.assign(configured, dotenv.parse(readFileSync(path)));
}
const url = new URL(process.env.PRODUCTIVITY_AI_SERVICE_URL || configured.PRODUCTIVITY_AI_SERVICE_URL || "http://127.0.0.1:8001");
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
  throw new Error("dev:ai requires PRODUCTIVITY_AI_SERVICE_URL to be an HTTP localhost origin.");
}
const directory = resolve(root, "akadverse-productivity-ai");
const python = resolve(directory, process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
if (!existsSync(python)) throw new Error("Create akadverse-productivity-ai/.venv and install its requirements first.");
console.log(`Productivity AI: ${url.origin}`);
if (!process.argv.includes("--check")) {
  const child = spawn(python, ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", url.port || "80", "--no-access-log"], { cwd: directory, stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  child.on("error", () => { console.error("Could not start the Python assistant. Check the virtual environment."); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 0; });
}
