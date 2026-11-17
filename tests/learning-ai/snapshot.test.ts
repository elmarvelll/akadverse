import "../helpers/env";
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
let reads = 0;
let row: Record<string, unknown> | null = null;
mock.module("@/lib/db/elearning", { namedExports: { elearningDb: { learningSnapshot: { findUnique: async (query: unknown) => { reads++; assert.deepEqual(query, { where: { studentId_offeringId: { studentId: "student", offeringId: "offering" } } }); return row; } } } } });
let snapshot: typeof import("../../services/e-learning/learning-ai/snapshot");
before(async () => { snapshot = await import("../../services/e-learning/learning-ai/snapshot"); });
test("chat snapshot retrieval is exactly one indexed read, even when missing", async () => {
  reads = 0; row = null;
  assert.equal((await snapshot.preparedLearningSnapshot("student", "offering")).stale, true); assert.equal(reads, 1);
  row = { snapshot: { concepts: [{ id: "canonical", mastery: "DEVELOPING" }] }, dirty: false, version: 3, preparedVersion: 3, preparedAt: new Date() };
  reads = 0; assert.equal((await snapshot.preparedLearningSnapshot("student", "offering")).stale, false); assert.equal(reads, 1);
});
test("dirty/version-mismatched or aged snapshots are never advertised fresh", async () => {
  for (const patch of [{ dirty: true }, { preparedVersion: 2 }, { preparedAt: new Date(0) }]) {
    row = { snapshot: {}, dirty: false, version: 3, preparedVersion: 3, preparedAt: new Date(), ...patch };
    assert.equal((await snapshot.preparedLearningSnapshot("student", "offering")).stale, true);
  }
});
