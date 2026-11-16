import { createRoot } from 'react-dom/client';
import { StrictMode, useEffect, useState } from 'react';
import RevisionsWorkspace from '../../src/app/e-learning/student/revisions/RevisionsWorkspace';
const requests: Record<string, unknown>[] = [];
let index = 0, evaluated = false, savedAnswer = '', savedReasoning = '';
const questions = [
  { type: 'mcq', stem: 'Which discriminant gives no real roots?', options: [{ key: 'A', text: 'Negative' }, { key: 'B', text: 'Positive' }], conceptTitle: 'Quadratics' },
  { type: 'true_false', stem: 'A negative discriminant has no real roots.', options: [], conceptTitle: 'Quadratics' },
  { type: 'short_answer', stem: 'Explain the discriminant rule.', options: [], conceptTitle: 'Quadratics' },
];
const view = () => ({ id: 'fixture-session', mode: 'RANDOM', status: index === 3 ? 'COMPLETED' : 'ACTIVE', total: 3, completed: index, current: index === 3 ? null : { id: `item-${index}`, position: index, status: evaluated ? 'EVALUATED' : 'PENDING', introduction: index === 0, course: { code: index === 1 ? 'PHY101' : 'MTH101', title: 'Test course' }, question: questions[index], answer: savedAnswer, reasoning: savedReasoning, evaluation: evaluated ? { answer_correct: true, answer_feedback: 'Correct independent answer.', reasoning_feedback: 'Clear reasoning.', needs_review: false } : null, ...(evaluated ? { correctAnswer: index === 0 ? 'A' : 'true', explanation: 'PRIVATE EXPLANATION' } : {}) } });
let remount = () => {};
Object.assign(window, { revisionWorkspaceTest: { requests, remount: () => remount() } });
window.fetch = async (_url, init) => {
  const data = init?.body ? JSON.parse(String(init.body)) : {}; requests.push(data);
  let result: unknown;
  if (data.action === 'start_session') result = view();
  else if (data.action === 'answer_item') { savedAnswer = data.answer; savedReasoning = data.reasoning; evaluated = true; result = view(); }
  else if (data.action === 'rate_item') { index++; evaluated = false; savedAnswer = ''; savedReasoning = ''; result = { ...view(), nextReviewAt: '2026-11-17T10:00:00Z' }; }
  else if (String(_url).includes('?session=')) result = view();
  else result = { courses: [{ id: 'course1', offeringId: 'offering1', code: 'MTH101', title: 'Maths' }, { id: 'course2', offeringId: 'offering2', code: 'PHY101', title: 'Physics' }], sessions: [{ id: 'fixture-session', mode: 'RANDOM', status: index === 3 ? 'COMPLETED' : 'ACTIVE', updatedAt: '2026-11-16T12:00:00Z' }], history: [] };
  return Response.json({ result });
};
function Harness() { const [key, setKey] = useState(0); useEffect(() => { remount = () => setKey(k => k + 1); }, []); return <RevisionsWorkspace key={key} />; }
createRoot(document.getElementById('root')!).render(<StrictMode><Harness /></StrictMode>);
