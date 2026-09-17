// Stamps app/sw.js VERSION with a hash of all app files, so every deploy/build invalidates the old cache
// and installed PWAs get the "new version" prompt. Run before deploying or building the APK.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app');
const hash = crypto.createHash('sha1');
function walk(d) { for (const n of fs.readdirSync(d).sort()) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) walk(p); else if (!p.endsWith('sw.js')) hash.update(n).update(fs.readFileSync(p)); } }
walk(root);
const v = 'aahar-' + hash.digest('hex').slice(0, 10);
const sw = path.join(root, 'sw.js');
const src = fs.readFileSync(sw, 'utf8');
const out = src.replace(/const VERSION = '[^']+';/, `const VERSION = '${v}';`);
if (out !== src) { fs.writeFileSync(sw, out); console.log('sw version →', v); } else console.log('sw version unchanged', v);
