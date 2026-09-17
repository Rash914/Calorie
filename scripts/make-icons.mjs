// Generates app/icons/icon.svg and PNG icons (192, 512, maskable 512) with no dependencies.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'app', 'icons');
fs.mkdirSync(OUT, { recursive: true });

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1d6fe8"/><stop offset=".55" stop-color="#12b5a5"/><stop offset="1" stop-color="#22c55e"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <circle cx="256" cy="256" r="150" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="34"/>
  <path d="M256 106 a150 150 0 1 1 -106 44" fill="none" stroke="#fff" stroke-width="34" stroke-linecap="round"/>
  <path d="M212 318 C 212 246 262 206 334 198 C 336 270 296 318 212 318 Z" fill="#fff"/>
  <path d="M222 310 C 250 270 280 246 320 214" stroke="#12b5a5" stroke-width="10" fill="none" stroke-linecap="round"/>
</svg>`;
fs.writeFileSync(path.join(OUT, 'icon.svg'), SVG);

// ---- tiny rasterizer -------------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t;
const grad = (t) => { // blue → teal → green
  const c1 = [0x1d, 0x6f, 0xe8], c2 = [0x12, 0xb5, 0xa5], c3 = [0x22, 0xc5, 0x5e];
  if (t < 0.55) { const u = t / 0.55; return c1.map((v, i) => lerp(v, c2[i], u)); }
  const u = (t - 0.55) / 0.45; return c2.map((v, i) => lerp(v, c3[i], u));
};
function inRoundRect(x, y, s, r) {
  const cx = Math.min(Math.max(x, r), s - r), cy = Math.min(Math.max(y, r), s - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
// scene in 512-space; returns [r,g,b,a]
function shade(x, y, maskable, opts = {}) {
  const s = 512, r = maskable ? 0 : 112;
  if (!maskable && !opts.noBg && !inRoundRect(x, y, s, r)) return [0, 0, 0, 0];
  let [R, G, B] = grad((x + y) / (2 * s));
  const k = opts.scale ?? (maskable ? 0.8 : 1); // shrink artwork into the safe zone for maskable
  const cx = 256, cy = 256;
  const px = (x - cx) / k + cx, py = (y - cy) / k + cy;
  const d = Math.hypot(px - cx, py - cy);
  const ang = Math.atan2(py - cy, px - cx); // -π..π, 0 = right
  const inRing = Math.abs(d - 150) <= 17;
  let white = 0;
  if (inRing) {
    // arc from top (-90°) clockwise around to ~-150° (leaving a gap at top-left)
    let a = (ang + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI); // 0 at top, clockwise
    const gapStart = 2 * Math.PI - 1.05; // gap of ~60°
    white = a < gapStart ? 1 : 0.28;
    // round caps
    const capA = [0, gapStart].map((t) => t - Math.PI / 2);
    for (const t of capA) { const ex = cx + 150 * Math.cos(t), ey = cy + 150 * Math.sin(t); if (Math.hypot(px - ex, py - ey) <= 17) white = 1; }
  }
  // leaf: intersection of two circles
  const leafA = Math.hypot(px - 290, py - 300) <= 78, leafB = Math.hypot(px - 258, py - 216) <= 78;
  if (leafA && leafB) {
    white = 1;
    // vein
    const vx0 = 222, vy0 = 310, vx1 = 320, vy1 = 214;
    const t = Math.max(0, Math.min(1, ((px - vx0) * (vx1 - vx0) + (py - vy0) * (vy1 - vy0)) / ((vx1 - vx0) ** 2 + (vy1 - vy0) ** 2)));
    const dv = Math.hypot(px - (vx0 + t * (vx1 - vx0)), py - (vy0 + t * (vy1 - vy0)));
    if (dv <= 5) return [0x12, 0xb5, 0xa5, 255];
  }
  if (opts.noBg) return white ? [255, 255, 255, Math.round(255 * white)] : [0, 0, 0, 0];
  if (white) { R = lerp(R, 255, white); G = lerp(G, 255, white); B = lerp(B, 255, white); }
  return [R, G, B, 255];
}
export function render(size, maskable, opts = {}) {
  const ss = 3; // supersampling
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const px = ((x + (sx + 0.5) / ss) / size) * 512, py = ((y + (sy + 0.5) / ss) / size) * 512;
      const [R, G, B, A] = shade(px, py, maskable, opts);
      r += R * A; g += G * A; b += B * A; a += A;
    }
    const n = ss * ss; const i = (y * size + x) * 4;
    if (a > 0) { buf[i] = r / a; buf[i + 1] = g / a; buf[i + 2] = b / a; } buf[i + 3] = a / n;
  }
  return buf;
}
export function png(size, rgba, width = size) {
  size = width; // square only
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
let TABLE;
function crc32(buf) {
  if (!TABLE) { TABLE = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; TABLE[n] = c; } }
  let c = -1; for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  for (const [name, size, maskable] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true]]) {
    fs.writeFileSync(path.join(OUT, name), png(size, render(size, maskable)));
    console.log('wrote', name);
  }
}
