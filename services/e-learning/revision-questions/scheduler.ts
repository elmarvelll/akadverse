import { DefaultScheduler } from "ts-fsrs";
import { SCHEDULER_VERSION } from "./policy";
let scheduler: ReturnType<typeof DefaultScheduler<"FSRS-7">> | undefined;
export const revisionScheduler = () => scheduler ||= DefaultScheduler({ version: "FSRS-7" });
export async function initialRevisionCard(id: string, now = new Date()) { return (await revisionScheduler()).newCard({ cardId: id, now }); }
export async function scheduleRevisionReview(state: unknown, rating: number, now = new Date()) {
  if (![1, 2, 3, 4].includes(rating)) throw new Error("Invalid review rating");
  const card = state as Awaited<ReturnType<typeof initialRevisionCard>>;
  return (await revisionScheduler()).review({ card: { ...card, dueAt: new Date(card.dueAt), lastReviewAt: card.lastReviewAt ? new Date(card.lastReviewAt) : null }, grade: rating as 1 | 2 | 3 | 4, now });
}
export { SCHEDULER_VERSION };
