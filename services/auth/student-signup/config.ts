// services/auth/student-signup/config.ts
//
// Tunables for the student sign-up OTP. One place so the API, the emails and the tests agree.

export const SIGNUP_OTP_TTL_MS = 5 * 60 * 1000; // a code is valid for 5 minutes
export const SIGNUP_OTP_MAX_ATTEMPTS = 5; // wrong guesses allowed per issued code
export const SIGNUP_OTP_RESEND_COOLDOWN_MS = 60 * 1000; // minimum gap between codes for one email
export const PENDING_SIGNUP_RETENTION_MS = 24 * 60 * 60 * 1000; // stale pending rows are discarded after a day
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72; // bcrypt ignores anything beyond 72 bytes
export const STUDENT_ROLE = "student" as const;

// Circuit breaker for the public "start sign-up" endpoint. Every new sign-up sends one e-mail, and the endpoint is unauthenticated,
// so a script could otherwise mail arbitrary @stu.cu.edu.ng addresses (Resend cost + sender reputation). This caps how many NEW
// pending sign-ups can be created in a window across the whole site — high enough for a real busy day, low enough to bound abuse.
// (A per-IP limit would need shared state; put a WAF / rate-limit rule on /api/signup in front of this for that.)
export const MAX_NEW_SIGNUPS_PER_WINDOW = 500;
export const NEW_SIGNUP_WINDOW_MS = 15 * 60 * 1000;
