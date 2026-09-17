// Generates Android launcher icons (legacy + adaptive foreground) from the same artwork as the PWA icons.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, png } from './make-icons.mjs';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const res = path.join(root, 'android', 'app', 'src', 'main', 'res');
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, m] of Object.entries(DENS)) {
  const dir = path.join(res, `mipmap-${d}`);
  fs.mkdirSync(dir, { recursive: true });
  const legacy = Math.round(48 * m), fg = Math.round(108 * m);
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), png(legacy, render(legacy, false)));
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), png(legacy, render(legacy, true, { scale: 0.75 })));
  // adaptive foreground: transparent canvas, artwork inside the 66dp safe circle
  fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), png(fg, render(fg, true, { noBg: true, scale: 0.5 })));
  console.log('wrote', d);
}
fs.writeFileSync(path.join(res, 'values', 'ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#12B5A5</color>\n</resources>\n`);
const bg = path.join(res, 'drawable', 'ic_launcher_background.xml');
if (fs.existsSync(bg)) fs.rmSync(bg);
