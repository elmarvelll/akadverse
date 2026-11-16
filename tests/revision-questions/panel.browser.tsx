import { createRoot } from 'react-dom/client';
import RevisionPracticePanel from '../../src/app/e-learning/student/study-zone/_components/RevisionPracticePanel';
const requests: Record<string, unknown>[] = []; let reviewed = false;
Object.assign(window, { revisionTest: { requests } });
window.fetch = async (input, init) => {
  const data = init?.body ? JSON.parse(String(init.body)) : {}; requests.push(data);
  let result: unknown;
  if (String(input).includes('?event=')) result = { generation: { status: 'PENDING' } };
  else if (!init?.body) result = reviewed ? [] : [{ id: 'card', version: 0, question: { stem: 'Recall the discriminant rule.', options: [], conceptTitle: 'Quadratics' } }];
  else if (data.action === 'prepare_concepts') result = { status: 'COMPLETED', concepts: [{ id: 'concept', title: 'Quadratics', description: 'Real roots' }] };
  else if (data.action === 'practice') result = { attemptId: 'attempt', question: { question_text: 'Explain a negative discriminant.', question_type: 'short_answer', options: [] } };
  else if (data.action === 'evaluate') result = { evaluation: { answer_correct: true, answer_feedback: 'Correct.', reasoning_feedback: 'Independent reasoning.' }, passed: true, teachingEventId: 'event' };
  else if (data.action === 'reveal') result = { correctAnswer: 'PRIVATE EXPECTED ANSWER', explanation: 'No real roots.' };
  else if (data.action === 'review') { reviewed = true; result = {}; }
  return Response.json({ result });
};
createRoot(document.getElementById('root')!).render(<RevisionPracticePanel context={{ courseId: 'course', courseCode: 'MTH101', weekNumber: 1, documentId: 'material', documentTitle: 'Quadratics' }} />);
