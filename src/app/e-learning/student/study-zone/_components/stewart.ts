// Stewart, the Study Zone's AI study assistant — MOCK CLIENT.
//
// Stewart is NOT connected to any AI service yet: nothing here makes a network request. This file is the only place
// the chat panel gets content from, so connecting the real assistant means replacing `askStewart` (and, if the
// backend keeps history, `startThread`) with API calls that take the same StewartContext — the panel itself
// doesn't change.

export interface StewartContext {
  courseCode: string;
  weekNumber: number;
  // The document open in the viewer; null when the week has no material.
  documentTitle: string | null;
}

export interface StewartMessage {
  id: string;
  role: "stewart" | "student";
  text: string;
}

export const STEWART_SUGGESTIONS = ["Summarise this week's material", "Explain the key terms", "Quiz me on this topic"];

// The opening of a conversation about one week's material: a greeting plus a short example exchange (mock).
export function startThread(ctx: StewartContext, threadKey: string): StewartMessage[] {
  if (!ctx.documentTitle) {
    return [
      {
        id: `${threadKey}-0`,
        role: "stewart",
        text: `Hi! I'm Stewart. There's no material for Week ${ctx.weekNumber} of ${ctx.courseCode} yet — pick another week, or ask me a general question about the course.`,
      },
    ];
  }
  return [
    {
      id: `${threadKey}-0`,
      role: "stewart",
      text: `Hi! I'm Stewart. I'm here to help you understand this week's study material for ${ctx.courseCode}. Ask me anything about what you're reading.`,
    },
    { id: `${threadKey}-1`, role: "student", text: `Can you explain "${ctx.documentTitle}"?` },
    {
      id: `${threadKey}-2`,
      role: "stewart",
      text: `Absolutely. Let's go through it step by step: start with the key definitions on the first pages, then follow how each idea builds on the last. Tell me which section you're on and I'll focus there.`,
    },
  ];
}

// Mock reply after a short "typing" delay. Says plainly that it can't read the document yet.
export async function askStewart(question: string, ctx: StewartContext): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 900));
  const material = ctx.documentTitle ? `"${ctx.documentTitle}"` : `Week ${ctx.weekNumber}'s material`;
  return `Good question. I'm still in preview, so I can't read ${material} yet — once I'm connected, I'll answer questions like this one using the document you have open.`;
}
