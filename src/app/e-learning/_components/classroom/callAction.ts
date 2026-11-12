// Calls a classroom Server Action and turns a transport failure into the same { ok: false, error } shape the actions
// already return for expected errors. A Server Action call THROWS (rather than returning) when the reply isn't an action
// response: signed out or switched account in this browser (the request is redirected to a page), the page outlived a
// redeploy/dev reload, or the network dropped. Without this, those surfaced as a crash ("An unexpected response was
// received from the server") instead of a message.

export async function callAction<T extends { ok: boolean }>(fn: () => Promise<T>): Promise<T | { ok: false; error: string }> {
  try {
    return await fn();
  } catch (e) {
    console.error("[classroom] action failed", e);
    return { ok: false, error: "Couldn't reach the server. Check you're still signed in to this account, then reload the page." };
  }
}
