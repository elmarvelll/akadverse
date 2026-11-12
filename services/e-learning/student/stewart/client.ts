// services/e-learning/student/stewart/client.ts
//
// The one place Stewart talks to its model provider (the Claude API, through the official SDK). Server-only: the API
// key never leaves the server, and nothing here is imported by a client component.
//
// Stewart had no AI backend before this (it was a canned mock), so this is the app's first model integration.
// Configuration (see docs/AKADVERSE_IMPLEMENTATION_CHANGELOG.md, section I):
//   ANTHROPIC_API_KEY           required — without it Stewart reports that it isn't set up, it never fakes an answer
//   STEWART_MODEL               optional — model id (default below)
//   STEWART_EFFORT              optional — low | medium | high (default low: fast, inexpensive tutoring answers)
//   STEWART_REFUSAL_FALLBACK    optional — "off" disables the server-side refusal fallback

import Anthropic from "@anthropic-ai/sdk";

export const STEWART_DEFAULT_MODEL = "claude-opus-5-5";

export function isStewartConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function stewartModel(): string {
  return process.env.STEWART_MODEL?.trim() || STEWART_DEFAULT_MODEL;
}

export function stewartEffort(): "low" | "medium" | "high" {
  const value = process.env.STEWART_EFFORT?.trim().toLowerCase();
  return value === "medium" || value === "high" ? value : "low";
}

export function refusalFallbackEnabled(): boolean {
  return process.env.STEWART_REFUSAL_FALLBACK?.trim().toLowerCase() !== "off";
}

let client: Anthropic | null = null;

// 50s request timeout and a single retry keep a chat turn inside the route's 60s budget.
export function stewartClient(): Anthropic {
  if (!client) client = new Anthropic({ timeout: 50_000, maxRetries: 1 });
  return client;
}

// Test seam: lets automated tests substitute a fake client. Never called by application code.
export function setStewartClientForTests(fake: Anthropic | null) {
  client = fake;
}
