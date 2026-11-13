// Restore only into a new disposable, network-isolated PostgreSQL 17 container.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
const manifestPath = process.argv[2];
if (!manifestPath) throw new Error('Provide backup manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const dump = readFileSync(manifest.dumpPath);
if (createHash('sha256').update(dump).digest('hex') !== manifest.dumpSha256) throw new Error('Dump checksum mismatch');
for (const object of manifest.objects) {
  const bytes = readFileSync(object.file);
  if (bytes.length !== object.size || createHash('sha256').update(bytes).digest('hex') !== object.sha256) throw new Error('Object backup checksum mismatch');
}
const inventory = JSON.parse(readFileSync(manifest.inventoryPath, 'utf8'));
const name = `akadverse-restore-${randomUUID().slice(0, 8)}`;
const docker = (args, input) => {
  const result = spawnSync('docker', args, { input, maxBuffer: 16 * 1024 * 1024, encoding: input ? undefined : 'utf8' });
  if (result.status !== 0) throw new Error(`Local restore command failed: ${String(result.stderr).slice(0, 1500)}`);
  return String(result.stdout);
};
let started = false;
try {
  docker(['run', '--rm', '--network=none', '-d', '--name', name, '-e', 'POSTGRES_PASSWORD=restore_local_only', '-e', 'POSTGRES_DB=elearning_restore', 'postgres:17']);
  started = true;
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    if (spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres', '-d', 'elearning_restore']).status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error('Isolated restore database did not become ready');
  docker(['exec', '-i', name, 'pg_restore', '-U', 'postgres', '-d', 'elearning_restore', '--clean', '--if-exists', '--no-owner', '--no-privileges', '--exit-on-error'], dump);
  const counts = [];
  for (const model of inventory.models.filter(m => !m.missing)) {
    const table = model.table.replaceAll('"', '""');
    const count = Number(docker(['exec', name, 'psql', '-U', 'postgres', '-d', 'elearning_restore', '-Atc', `SELECT count(*) FROM public."${table}"`]));
    if (count !== model.count) throw new Error(`Inventory drift: ${model.model} snapshot=${model.count} backup=${count}; refresh inventory before final review`);
    counts.push({ model: model.model, count });
  }
  writeFileSync(manifestPath, JSON.stringify({ ...manifest, restoreVerified: true, verifiedAt: new Date().toISOString(), restoredCounts: counts, verification: 'Disposable PostgreSQL 17, network=none; no live restore attempted' }, null, 2), { mode: 0o600 });
  console.log(`Verified restore and ${counts.length} model counts; verified ${manifest.objects.length} source-file checksum(s).`);
} finally {
  if (started) docker(['stop', name]);
}
