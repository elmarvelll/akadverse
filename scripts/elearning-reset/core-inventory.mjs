// Read-only identity fingerprints and ELEARNING notifications. Never exports credentials.
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
const db = new PrismaClient();
try {
  const snapshot = await db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const users = await tx.user.findMany({ select: { id: true, firstName: true, lastName: true, email: true, password: true, role: true, isAdmin: true }, orderBy: { id: 'asc' } });
    const identities = users.map(({ id, role, ...identity }) => ({ id, role, fingerprint: createHash('sha256').update(JSON.stringify({ id, role, ...identity })).digest('hex') }));
    const notifications = await tx.notification.findMany({ where: { scope: 'ELEARNING' }, orderBy: { id: 'asc' } });
    return { createdAt: new Date().toISOString(), identities, notifications, scope: 'User fingerprints only; Notification.scope=ELEARNING only; no writes' };
  }, { isolationLevel: 'RepeatableRead', timeout: 60000 });
  mkdirSync('.elearning-reset', { recursive: true, mode: 0o700 });
  const file = `.elearning-reset/core-inventory-${Date.now()}.json`;
  writeFileSync(file, JSON.stringify(snapshot, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(`Preserved identity fingerprints: ${snapshot.identities.length}; E-Learning notifications for review: ${snapshot.notifications.length}. Private report: ${file}`);
} finally { await db.$disconnect(); }
