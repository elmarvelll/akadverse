// src/types/auth.ts
//
// Shared TypeScript types for the authentication forms (signup/login) and
// the /api/register request body. Keeping this in one place means the form
// state, the fetch/axios call, and the API route all agree on the same
// shape of data.

// Fields collected on the signup form. Mirrors the required (non-optional)
// columns on the Prisma `User` model that a user fills in themselves
// (id/role/timestamps are set by the database or server, not the form).
export interface SignupFormValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  // Optional — maps directly to the optional `location` column on the
  // Prisma `User` model.
  location?: string;
}

// Fields collected on the login form. Only email + password are needed;
// NextAuth's CredentialsProvider takes it from here.
export interface LoginFormValues {
  email: string;
  password: string;
}
