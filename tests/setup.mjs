// Minimal browser-ish globals so app modules can run under node:test.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear()
};
globalThis.window = globalThis;
globalThis.document = { addEventListener() {}, visibilityState: 'visible' };
globalThis.addEventListener = () => {};
const dbPath = path.join(__dirname, '..', 'app', 'data', 'foods.json');
globalThis.fetch = async () => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(dbPath, 'utf8')) });
