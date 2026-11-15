// Used only by server authentication and the server proxy. Never expose these
// environment values through NEXT_PUBLIC variables or browser authentication.
export const DEV_LOGIN_PROVIDER_ID = "dev-student";
export const DEV_STUDENT_EMAIL = "productivity-test-student@example.local";
export const DEV_STUDENT_FIRST_NAME = "Development Test";
export const DEV_STUDENT_LAST_NAME = "Student";

export function isDevLoginEnabled() {
  return process.env.NODE_ENV === "development" && process.env.ENABLE_DEV_LOGIN === "true";
}

export function hasLocalDevDatabase() {
  return [process.env.DATABASE_URL, process.env.DIRECT_URL].every(value => {
    if (!value) return false;
    try {
      const url = new URL(value);
      const loopback = (host: string) => ["localhost", "127.0.0.1", "[::1]", "::1"].includes(host.toLowerCase());
      return ["postgres:", "postgresql:"].includes(url.protocol) && loopback(url.hostname)
        && ["host", "hostaddr"].every(key => !url.searchParams.has(key) || loopback(url.searchParams.get(key)!));
    } catch { return false; }
  });
}

export function canUseDevSession() {
  return isDevLoginEnabled() && hasLocalDevDatabase() && !!process.env.NEXTAUTH_SECRET?.trim();
}

export function requireDevLoginSetup() {
  if (!isDevLoginEnabled()) throw new Error("DevLoginDisabled");
  if (!hasLocalDevDatabase()) throw new Error("DevLoginDatabase");
  if (!process.env.NEXTAUTH_SECRET?.trim()) throw new Error("DevLoginSecret");
}

export function isDedicatedTestStudent(user: { email: string; firstName: string; lastName: string; role: string; isAdmin: boolean; password?: string } | null) {
  return !!user && user.email === DEV_STUDENT_EMAIL && user.firstName === DEV_STUDENT_FIRST_NAME
    && user.lastName === DEV_STUDENT_LAST_NAME && user.role === "student" && user.isAdmin === false
    && user.password === "";
}

export function hasGoogleCredentials() {
  return !!process.env.GOOGLE_CLIENT_ID?.trim() && !!process.env.GOOGLE_CLIENT_SECRET?.trim();
}
