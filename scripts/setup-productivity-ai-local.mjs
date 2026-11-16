// Generate dedicated ignored local configuration. Never prints keys or rewrites unrelated settings.
import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { generateKeyPairSync, randomBytes, createPublicKey } from 'node:crypto';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
const root = resolve(import.meta.dirname, '..');
const appOrigin = process.argv[2] || 'http://localhost:3000';
const parsedOrigin = new URL(appOrigin);
if (!['localhost','127.0.0.1'].includes(parsedOrigin.hostname) || parsedOrigin.protocol !== 'http:' || parsedOrigin.pathname !== '/' || parsedOrigin.username || parsedOrigin.password || parsedOrigin.search || parsedOrigin.hash) throw new Error('This helper configures loopback development only.');
const rootPath = resolve(root, '.env.local'), pythonPath = resolve(root, 'akadverse-productivity-ai/.env');
const existing = existsSync(rootPath) ? readFileSync(rootPath, 'utf8') : '';
const local = dotenv.parse(existing);
const priorPython = existsSync(pythonPath) ? dotenv.parse(readFileSync(pythonPath, 'utf8')) : {};
const privateKey = local.PRODUCTIVITY_AI_JWT_PRIVATE_KEY || generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey;
const publicKey = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString();
const secret = local.PRODUCTIVITY_AI_SERVICE_TOKEN || randomBytes(48).toString('base64url');
const settings = { PRODUCTIVITY_AI_SERVICE_URL: local.PRODUCTIVITY_AI_SERVICE_URL || 'http://127.0.0.1:8001', PRODUCTIVITY_AI_SERVICE_TOKEN: secret, PRODUCTIVITY_AI_JWT_PRIVATE_KEY: privateKey, PRODUCTIVITY_AI_JWT_PUBLIC_KEY: publicKey, PRODUCTIVITY_AI_JWT_KEY_ID: 'productivity-v1' };
let updated = existing;
for (const [name,value] of Object.entries(settings)) {
  const line = `${name}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  updated = pattern.test(updated) ? updated.replace(pattern, () => line) : `${updated.trimEnd()}\n${line}\n`;
}
writeFileSync(rootPath, updated.trimStart(), { mode: 0o600 }); chmodSync(rootPath, 0o600);
const pythonSettings = { ...priorPython, GEMINI_API_KEY: priorPython.GEMINI_API_KEY || '', GEMINI_MODEL: priorPython.GEMINI_MODEL || 'gemini-3.5-flash-lite', AKADVERSE_API_BASE_URL: parsedOrigin.origin, PRODUCTIVITY_AI_SERVICE_TOKEN: secret, PRODUCTIVITY_AI_JWT_PUBLIC_KEY: publicKey, PRODUCTIVITY_AI_JWT_KEY_ID: 'productivity-v1' };
writeFileSync(pythonPath, Object.entries(pythonSettings).map(([name,value]) => `${name}=${JSON.stringify(value)}`).join('\n')+'\n', { mode: 0o600 }); chmodSync(pythonPath, 0o600);
console.log('Local assistant configuration generated. No secrets printed. Set GEMINI_API_KEY in the ignored Python .env, then restart both services.');
