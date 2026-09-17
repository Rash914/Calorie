import * as store from './store.js';
const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
export function applyTheme() {
  const t = store.get().settings.theme;
  const dark = t === 'dark' || (t === 'auto' && mq?.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#0a1220' : '#5ec8e8';
}
mq?.addEventListener?.('change', applyTheme);
