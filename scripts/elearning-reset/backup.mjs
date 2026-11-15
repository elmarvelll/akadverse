// Read-only remote backup; no Core database connection. PostgreSQL 17 tools required.
import { spawn } from 'node:child_process';
import { mkdirSync, openSync, closeSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const inventoryPath = process.argv[2];
if (!inventoryPath) throw new Error('Provide reviewed inventory JSON path');
const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
const target = new URL(process.env.ELEARNING_DIRECT_URL ?? '');
const taskDir = `.elearning-reset/backup-${Date.now()}`;
mkdirSync(taskDir, { recursive: true, mode: 0o700 });
const dumpPath = `${taskDir}/elearning-public.dump`;
const fd = openSync(dumpPath, 'wx', 0o600);
const env = { ...process.env, PGHOST: target.hostname, PGPORT: target.port || '5432', PGUSER: decodeURIComponent(target.username), PGPASSWORD: decodeURIComponent(target.password), PGDATABASE: target.pathname.slice(1), PGSSLMODE: 'require' };
try {
  const child = spawn('docker', ['run', '--rm', '-i', ...['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGSSLMODE'].flatMap(k => ['--env', k]), 'postgres:17', 'pg_dump', '--format=custom', '--schema=public'], { env, stdio: ['ignore', fd, 'pipe'] });
  let detail = '';
  child.stderr.on('data', b => { detail += b.toString(); });
  const status = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
  if (status !== 0) { console.error(detail.replaceAll(decodeURIComponent(target.password), '[redacted]')); throw new Error(`pg_dump failed (${status}); backup is incomplete`); }
} finally { closeSync(fd); }
const materials = inventory.models.find(m => m.model === 'CourseMaterial').rows;
const objects = [];
for (const material of materials) {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Storage configuration missing');
  const path = material.storagePath.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${url}/storage/v1/object/authenticated/${encodeURIComponent(material.storageBucket)}/${path}`, { headers: { Authorization: `Bearer ${key}`, apikey: key }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Object backup failed: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== material.fileSize) throw new Error('Object backup size differs from material metadata');
  const file = `${taskDir}/${material.id}.bin`;
  writeFileSync(file, bytes, { flag: 'wx', mode: 0o600 });
  objects.push({ materialId: material.id, bucket: material.storageBucket, path: material.storagePath, file, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
writeFileSync(`${taskDir}/manifest.json`, JSON.stringify({ createdAt: new Date().toISOString(), inventoryPath, dumpPath, dumpSha256: createHash('sha256').update(readFileSync(dumpPath)).digest('hex'), objects, restoreVerified: false }, null, 2), { flag: 'wx', mode: 0o600 });
console.log(`Private database/object backup: ${taskDir}. Restore rehearsal still required.`);
