/* eslint-disable @typescript-eslint/no-require-imports */
// Focused local fixture setup. Never reads a production database URL.
require('../tests/helpers/env.ts');
const { spawnSync } = require('node:child_process');
const { elearningDb } = require('../src/lib/db/elearning.ts');
async function exists(table) {
  const rows = await elearningDb.$queryRawUnsafe('SELECT to_regclass($1)::text AS name', `public."${table}"`);
  return !!rows[0].name;
}
function apply(file) {
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'execute', '--schema=prisma/elearning/schema.prisma', `--file=prisma/elearning/patches/${file}`], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) throw new Error(`Local fixture patch failed: ${file}`);
}
(async () => {
  if (!(await exists('CourseMaterial'))) throw new Error('Run the base local database setup first.');
  if (!(await exists('RevisionWebhookIdempotency'))) apply('20261115_revision_webhook_idempotency.sql');
  if (!(await exists('RevisionConcept'))) apply('20261115_revision_learning.sql');
  if (!(await exists('RevisionQuestionGovernance'))) apply('20261116_standalone_revisions.sql');
  apply('20261115_revision_delivery_recovery.sql');
  apply('20261116_revision_row_security.sql');
  if (!(await exists('AiCallLog'))) apply('20261117_learning_ai_foundations.sql');
  apply('20261117_learning_job_ownership.sql');
  if (!(await exists('LearningMaterialVersion'))) apply('20261117_personalized_learning.sql');
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => elearningDb.$disconnect());
