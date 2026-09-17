// Copies app/ → android-www/ for Capacitor. Capacitor injects its native bridge as an inline <script>,
// so the Android copy's CSP allows inline scripts (content is bundled locally in the APK, never fetched).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'app'), dst = path.join(root, 'android-www');
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true });
const idx = path.join(dst, 'index.html');
let html = fs.readFileSync(idx, 'utf8');
html = html.replace("script-src 'self';", "script-src 'self' 'unsafe-inline';").replace("connect-src 'self'", "connect-src 'self' https://localhost");
fs.writeFileSync(idx, html);
// the WebView supports DecompressionStream, so only the gzip database is shipped in the APK
fs.rmSync(path.join(dst, 'data', 'foods.json'), { force: true });
console.log('android-www ready');
