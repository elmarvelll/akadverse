import { it } from "node:test";
import assert from "node:assert/strict";
import { workspaceChanged } from "@/features/productivity/assistant/workspace-changed";
it("invalidates the workspace only for newly confirmed saved mutations", () => {
  const read = { id: "read-1", status: "completed", result: { rows: [] } };
  const saved = { id: "write-1", status: "completed", result: { saved: true } };
  assert.equal(workspaceChanged([], [read]), false);
  assert.equal(workspaceChanged([], [{ ...saved, status: "awaiting_confirmation" }]), false);
  assert.equal(workspaceChanged([], [{ ...saved, status: "unknown" }]), false);
  assert.equal(workspaceChanged([], [saved]), true);
  assert.equal(workspaceChanged([saved], [saved, read]), false);
  assert.equal(workspaceChanged([{ ...saved, status: "unknown" }], [saved]), true);
});
