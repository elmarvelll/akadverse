// Content-derived titles require no new provider call or invented microservice endpoint.
export function temporaryConversationTitle(question: string): string {
  return question.trim().split(/\s+/).slice(0, 8).join(" ").slice(0, 96) || "Study conversation";
}
export function conversationTitle(question: string, answer: string): string {
  const clean = (text: string) => text.replace(/[*_`#\[\]]/g, "").replace(/\$[^$]+\$/g, "").replace(/\s+/g, " ").trim();
  const heading = answer.split("\n").find((line) => /^#{1,4}\s+/.test(line) && !/^#+\s*(example(?:\s+\d+)?|worked example(?:\s+\d+)?|concept|key takeaways|conclusion|introduction|definition|overview|summary|worked problem|simple explanation|analogy)\s*[:.!]?$/i.test(line));
  const subject = clean(heading ?? question.replace(/^(?:(?:hi|hello|hey)[,!]?\s+)?(?:(?:please|pls)\s+)?(?:(?:can|could|would)\s+you\s+)?(?:explain|describe|summarise|summarize|tell me about|help me understand|what (?:is|are))\s+/i, "")).replace(/[?.!]+$/, "");
  if (!subject) return temporaryConversationTitle(question);
  const title = subject.split(/\s+/).slice(0, 8).join(" ").slice(0, 96);
  return title[0].toUpperCase() + title.slice(1);
}
