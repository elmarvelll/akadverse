// NextAuth returns bounded error codes, not provider/server details. Keep the
// custom login/signup pages informative without exposing raw error parameters.
const messages: Record<string, string> = {
  DevLoginDisabled: "Development login is disabled. Enable it only on your local development server.",
  DevLoginDatabase: "Development login requires DATABASE_URL and DIRECT_URL to point to local PostgreSQL. See docs/development-login.md for setup.",
  DevLoginSecret: "Set NEXTAUTH_SECRET in .env.local and restart the development server before using the test login.",
  DevLoginRestart: "The database configuration changed. Stop and restart the development server before using the test login.",
  DevLoginDatabaseUnavailable: "The local database is unavailable or its schema is not ready. Start the development database and apply the existing migrations.",
  DevLoginStudentInvalid: "The dedicated test account has unexpected identity or permissions. Development login was refused; no account permissions were changed.",
  OAuthSignin: "Google sign-in could not start. Please try again or use email and password.",
  OAuthCallback: "Google sign-in could not be completed. Please try again.",
  OAuthAccountNotLinked: "Please sign in using the method you originally used for this account.",
  OAuthCreateAccount: "Your Google account could not be connected. Please try again.",
  AccessDenied: "This account could not sign in. Please use an eligible account.",
  Configuration: "Sign-in is temporarily unavailable. Please try again later.",
  CredentialsSignin: "That email and password don't match.",
  SessionRequired: "Please sign in to continue.",
  Callback: "Sign-in could not be completed. Please try again.",
  Default: "Sign-in could not be completed. Please try again.",
};

export function authErrorMessage(code: string | null) {
  return code ? Object.hasOwn(messages, code) ? messages[code] : messages.Default : "";
}
