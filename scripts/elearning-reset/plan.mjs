// Pure offline dry run. Never opens a database, Storage or AI connection.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const inventoryPath = process.argv[2];
if (!inventoryPath || process.argv.includes('--execute')) throw new Error('Usage: node scripts/elearning-reset/plan.mjs INVENTORY.json [--dry-run]. Execution is disabled pending final review.');
const raw = readFileSync(inventoryPath, 'utf8');
const inventory = JSON.parse(raw);
const storage = JSON.parse(readFileSync(`${inventoryPath}.storage.json`, 'utf8'));
const models = new Map(inventory.models.map(m => [m.model, m]));
const rows = name => models.get(name)?.rows ?? [];
const resetOrder = ['ChatMessage', 'ChatConversation', 'StewartAttachment', 'ClassroomPollResponse', 'ClassroomQuestionVote', 'ClassroomQuestion', 'ClassroomPoll', 'ClassroomSession', 'CourseRegistrationItem', 'CourseRegistration', 'StudentCourseRegistration', 'Result', 'CourseOfferingLecturer', 'CourseOfferingDay', 'CourseAssignment', 'TimetableEntry'];
const materialReview = rows('CourseMaterial').map(m => {
  const offering = rows('CourseOffering').find(o => o.id === m.courseOfferingId);
  const placement = rows('CurriculumCourse').find(c => c.id === offering?.curriculumCourseId);
  const course = rows('Course').find(c => c.id === placement?.courseId);
  return { materialId: m.id, title: m.title, filename: m.fileName, uploadedByFacultyUserId: m.uploadedByFacultyUserId, courseCode: course?.code ?? null, courseTitle: course?.title ?? null, bucket: m.storageBucket, path: m.storagePath, aiDocumentId: m.id, aiTask: rows('AiIngestTask').find(t => t.documentId === m.id), requestedDecision: 'delete-after-final-review', objectFound: storage.objects.some(o => o.bucket === m.storageBucket && o.path === m.storagePath) };
});
const corePath = process.argv.includes('--core-inventory') ? process.argv[process.argv.indexOf('--core-inventory') + 1] : null;
const coreRaw = corePath ? readFileSync(corePath, 'utf8') : null;
const core = coreRaw ? JSON.parse(coreRaw) : null;
const source = JSON.parse(readFileSync('src/lib/resources/ccmas/Engineering-CCMAS-2023.json', 'utf8'));
const sourceProgrammes = source.disciplines.flatMap(d => d.programmes);
const plan = {
  mode: 'dry-run-only', inventorySha256: createHash('sha256').update(raw).digest('hex'),
  sourceSha256: source.source.sha256, referenceCounts: { programmes: sourceProgrammes.length, courses: new Set(sourceProgrammes.flatMap(p => p.courses.map(c => c.code))).size, placements: sourceProgrammes.reduce((n, p) => n + p.courses.length, 0) },
  resetOrder: resetOrder.map(model => ({ model, missingTable: models.get(model)?.missing ?? true, count: rows(model).length, records: rows(model) })),
  materials: materialReview,
  archiveCurricula: rows('Curriculum').map(c => ({ id: c.id, fromStatus: c.status, toStatus: 'ARCHIVED' })),
  preserveModels: inventory.models.filter(m => m.disposition.startsWith('preserve')).map(m => ({ model: m.model, count: m.count })),
  preservePendingAiCleanup: true, coreInventory: core ? { path: corePath, sha256: createHash('sha256').update(coreRaw).digest('hex'), notificationIds: core.notifications.map(n => n.id), preservedIdentityCount: core.identities.length } : null,
  blockers: ['Final inventory review required', 'Course-table precedence approved; retain source warnings for DAPU review', 'Tested PostgreSQL and object backups required; inventory is not a backup', ...inventory.models.filter(m => m.missing).map(m => `Schema mismatch: missing ${m.model}`), 'Operational curriculum activation must retain DAPU semester allocation and HOD approval', 'Storage and AI deletion must be retriable and verified before metadata/offerings removal'],
};
const output = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : `${inventoryPath}.plan.json`;
writeFileSync(output, JSON.stringify(plan, null, 2), { flag: 'wx', mode: 0o600 });
console.log(`Dry-run plan written: ${output}`);
console.table(plan.resetOrder.map(({ model, count, missingTable }) => ({ model, count, missingTable })));
console.log(`Source files awaiting final review: ${materialReview.length}; curricula proposed for archive: ${plan.archiveCurricula.length}. No changes executed.`);
