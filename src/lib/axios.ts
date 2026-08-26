// src/lib/axios.ts
//
// A shared axios instance for calling our own Next.js API routes
// (everything under /api/...) from client components.
//
// Using a pre-configured instance (instead of calling axios.get/post
// directly everywhere) means:
//   - every request automatically targets "/api" as its base, so callers
//     just write api.post("/register", data) instead of the full path.
//   - every request gets the same default headers (JSON) without repeating
//     them at every call site.
//   - if we ever need to add shared behavior (auth headers, error toasts,
//     retry logic, etc.) we do it once here and every caller benefits.

import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
