/** Fixed delay after settlement, so a slow read never overlaps the next poll.
 * Stop prevents future work; callers must also ignore an in-flight result after unmount.
 */
export function sequentialPoll(read: () => Promise<unknown>, delayMs: number) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const tick = async () => {
    try { await read(); } catch { /* Recovery reads retry at the next interval. */ }
    finally { if (!stopped) timer = setTimeout(() => { void tick(); }, delayMs); }
  };
  timer = setTimeout(() => { void tick(); }, delayMs);
  return () => { stopped = true; clearTimeout(timer); };
}
