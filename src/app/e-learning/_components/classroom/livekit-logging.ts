// livekit-client logs its own transient network events at ERROR level, e.g. "error reading from signal stream" when a
// connection drops while it's already being torn down on a weak network, or "data channel closed unexpectedly". It
// recovers from these by itself (reconnecting, or finishing the disconnect), but in dev every console.error opens the
// Next.js error overlay, so a flaky connection looked like a crash.
//
// This keeps them visible in DevTools, downgraded to warnings, and stops LiveKit's chatty info/debug output (per-track
// stats on every disconnect). Real failures our code must handle (can't join, kicked as a duplicate) still reach us as
// errors and disconnect reasons from LiveKitRoom, not through these logs.

import { getLogger, LoggerNames, LogLevel, setLogLevel } from "livekit-client";

let configured = false;

export function configureLiveKitLogging() {
  if (configured || typeof window === "undefined") return;
  configured = true;
  setLogLevel(LogLevel.warn);
  for (const name of Object.values(LoggerNames)) {
    const logger = getLogger(name);
    const original = logger.methodFactory;
    logger.methodFactory = (methodName, level, loggerName) => original(methodName === "error" ? "warn" : methodName, level, loggerName);
    // loglevel only rebuilds its methods on setLevel, so re-apply the current level to pick up the new factory.
    logger.setLevel(logger.getLevel());
  }
}
