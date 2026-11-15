// Read-only live Storage reconciliation for exact buckets referenced by CourseMaterial.
import { readFileSync, writeFileSync } from 'node:fs';
const reportPath = process.argv[2];
if (!reportPath || process.argv.includes('--execute')) throw new Error('Provide an inventory JSON; this command is read-only.');
const inventory = JSON.parse(readFileSync(reportPath, 'utf8'));
const materials = inventory.models.find(m => m.model === 'CourseMaterial').rows;
const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Storage configuration missing');
const headers = { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' };
const objects = [];
for (const bucket of new Set(materials.map(m => m.storageBucket))) {
  const prefixes = [''];
  while (prefixes.length) {
    const prefix = prefixes.shift();
    for (let offset = 0; ; offset += 100) {
      const response = await fetch(`${url}/storage/v1/object/list/${encodeURIComponent(bucket)}`, { method: 'POST', headers, body: JSON.stringify({ prefix, limit: 100, offset, sortBy: { column: 'name', order: 'asc' } }), signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`Storage listing failed: HTTP ${response.status}`);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Unexpected Storage listing');
      for (const row of rows) {
        const path = prefix ? `${prefix}/${row.name}` : row.name;
        if (!row.id) { prefixes.push(path); continue; }
        const references = materials.filter(m => m.storageBucket === bucket && m.storagePath === path);
        objects.push({ bucket, path, object: row, references, decision: references.length ? 'review-lecturer-source' : 'unreferenced-manual-review-do-not-delete' });
      }
      if (rows.length < 100) break;
    }
  }
}
const missing = materials.filter(m => !objects.some(o => o.bucket === m.storageBucket && o.path === m.storagePath));
writeFileSync(`${reportPath}.storage.json`, JSON.stringify({ createdAt: new Date().toISOString(), objects, missing, scope: 'Only buckets referenced by CourseMaterial; unrelated buckets untouched' }, null, 2), { mode: 0o600, flag: 'wx' });
console.log(`Live objects: ${objects.length}; referenced materials: ${materials.length}; missing objects: ${missing.length}. Private report: ${reportPath}.storage.json`);
