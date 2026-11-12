// for_Developers/seed/ids.ts
//
// Stable ids for seeded rows, so every upsert targets the same row on every run (no duplicates) and a fresh database
// gets exactly the same ids. A name like "business:plug" always maps to the same UUID-shaped string.

import { createHash } from "node:crypto";

export function devId(name: string): string {
  const h = createHash("sha256").update(`akadverse-dev-seed:${name}`).digest("hex");
  // Shaped as a v4-style UUID (the Core schema's ids are UUIDs; E-Learning's cuid() columns accept any string).
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
