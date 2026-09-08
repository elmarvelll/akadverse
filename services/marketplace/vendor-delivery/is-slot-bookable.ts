// services/marketplace/vendor-delivery/is-slot-bookable.ts
//
// THE single reusable function for "can this VendorDeliverySlot still be
// booked right now" — both the frontend slot picker (via the checkout
// summary response) and the backend booking transaction call this; the
// rule must never be re-implemented ad hoc anywhere else (spec §21).
//
// Timezone: nothing else in this codebase establishes a school/local
// timezone convention (confirmed — no existing TZ handling to match), and
// Vercel's serverless runtime runs in UTC regardless of where a request
// originates, so `new Date()` wall-clock math would silently use the
// wrong offset. SCHOOL_TIMEZONE is the one explicit choice made here
// (Africa/Lagos, WAT/UTC+1 — matches the @stu.cu.edu.ng student email
// domain's institution) and every slot-cutoff calculation goes through
// `nowInSchoolTimezone`/`slotWindowStartToday` below, never raw `Date`
// arithmetic against server-local time.

export const SCHOOL_TIMEZONE = "Africa/Lagos";

export interface BookableSlot {
  windowStart: string; // "HH:MM"
  bookingCutoffMins: number;
}

// "Now," expressed as the wall-clock date/time it actually is in
// SCHOOL_TIMEZONE — computed via Intl rather than assuming the server's
// own local time equals school time.
export function nowInSchoolTimezone(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  // Constructed as a UTC instant carrying the school-timezone wall-clock
  // values — never re-interpreted as server-local, so subtracting minutes
  // from it stays correct regardless of where this code runs.
  return new Date(
    Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")), Number(get("hour")), Number(get("minute")), Number(get("second")))
  );
}

// The slot's windowStart ("HH:MM"), as a Date on today's date in
// SCHOOL_TIMEZONE — comparable directly against nowInSchoolTimezone()'s
// output since both are UTC instants carrying school wall-clock values.
export function slotWindowStartToday(windowStart: string, referenceNow: Date = new Date()): Date {
  const school = nowInSchoolTimezone(referenceNow);
  const [hour, minute] = windowStart.split(":").map(Number);
  const start = new Date(school);
  start.setUTCHours(hour, minute, 0, 0);
  return start;
}

// True if a booking made right now would still leave at least
// slot.bookingCutoffMins before the slot's window opens today. A slot
// whose window has already passed today is never bookable (negative
// margin), independent of the cutoff. Boundary: exactly bookingCutoffMins
// remaining is bookable — the spec's rule text is "cannot book if less
// than 1h30 before," so exactly 1h30 before is the last bookable instant
// (>=, not >).
export function isSlotBookable(slot: BookableSlot, now: Date = new Date()): boolean {
  const windowStartToday = slotWindowStartToday(slot.windowStart, now);
  const schoolNow = nowInSchoolTimezone(now);
  const minutesUntilWindow = (windowStartToday.getTime() - schoolNow.getTime()) / 60000;
  return minutesUntilWindow >= slot.bookingCutoffMins;
}
