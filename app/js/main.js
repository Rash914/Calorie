// App bootstrap: shell, navigation, service worker.
import { h, clear, $ } from './util.js';
import * as store from './store.js';
import * as foods from './foods.js';
import * as router from './router.js';
import { applyTheme } from './theme.js';
import { icon, toast } from './ui/components.js';
import * as home from './ui/home.js';
import * as log from './ui/log.js';
import * as calendar from './ui/calendar.js';
import * as plan from './ui/plan.js';
import * as me from './ui/me.js';
import { openOnboarding } from './ui/onboarding.js';
import { openVoiceSheet } from './ui/add.js';

const VIEWS = { home, log, calendar, plan, me };
const TABS = [['home', 'Home', 'home'], ['log', 'Log', 'search'], ['calendar', 'Calendar', 'calendar'], ['plan', 'Plan', 'target'], ['me', 'Me', 'user']];

function logoSvg() {
  const s = icon('leaf', 20); s.setAttribute('stroke-width', '2.2'); return s;
}

function shell() {
  const app = $('#app');
  clear(app);
  const brand = () => h('div', { class: 'brand' }, h('div', { class: 'logo' }, logoSvg()), h('div', null, 'Aahar', h('span', { class: 'tag' }, 'Indian calorie tracker')));
  const top = h('header', { class: 'topbar' }, brand(), h('div', { class: 'grow' }), h('span', { id: 'streak-pill', class: 'badge green' }));
  const nav = h('nav', { class: 'tabbar', 'aria-label': 'Main' }, h('div', { class: 'side-brand' }, brand()),
    ...TABS.map(([id, label, ic]) => h('button', { dataset: { view: id }, 'aria-label': label, onclick: () => router.navigate(id) }, icon(ic, 24), h('span', null, label))));
  const view = h('main', { id: 'view' });
  const fab = h('button', { class: 'fab', 'aria-label': 'Log by voice', title: 'Speak what you ate', onclick: () => openVoiceSheet({ date: home.state.date, onAdded: () => render() }) }, icon('mic', 28));
  app.append(top, nav, view, fab);
}

function render() {
  const view = router.current();
  const params = router.getParams();
  document.querySelectorAll('.tabbar button[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  const root = $('#view');
  try { VIEWS[view].render(root, params); } catch (e) { console.error(e); clear(root); root.append(h('div', { class: 'card' }, h('h3', null, 'Something went wrong'), h('p', { class: 'muted small mt' }, String(e?.message || e)))); }
  $('.fab').hidden = view === 'me' || view === 'plan';
  window.scrollTo({ top: 0 });
  updateStreak();
}
async function updateStreak() {
  const { streak } = await import('./calc.js');
  const st = streak(store.get().logs);
  const pill = $('#streak-pill');
  if (pill) { clear(pill); pill.append(icon('flame', 12), ` ${st.current}`); pill.title = `${st.current}-day logging streak`; }
}

async function boot() {
  applyTheme();
  loadWebFont();
  shell();
  const root = $('#view');
  root.append(h('div', { class: 'col' }, h('div', { class: 'skeleton', style: { height: '300px' } }), h('div', { class: 'skeleton', style: { height: '120px' } })));
  try {
    await foods.load();
  } catch (e) {
    console.error(e);
    clear(root);
    root.append(h('div', { class: 'card' }, h('h3', null, 'Could not load the food database'), h('p', { class: 'muted small mt' }, 'Check your connection and reload. If you opened this file directly, serve it over http(s) — see README.'), h('button', { class: 'btn primary mt', onclick: () => location.reload() }, icon('refresh', 16), 'Reload')));
    return;
  }
  router.bus.on('route', render);
  store.bus.on('error', (m) => toast(m, 'error', 5000));
  store.bus.on('change', updateStreak);
  render();
  if (!store.get().settings.onboarded) openOnboarding({ onDone: render });
  else if (/voice=1/.test(location.hash)) { history.replaceState(null, '', '#home'); openVoiceSheet({ date: home.state.date, onAdded: () => render() }); }
  registerSW();
}

// Web font is loaded after first paint so an offline device never waits on it (system font is the fallback).
function loadWebFont() {
  if (!navigator.onLine) return;
  const l = h('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap' });
  document.head.append(l);
}

function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Update ready — reopen the app to get the latest version.', '', 5000); });
    });
  }).catch((e) => console.warn('sw', e));
}

// PWA install prompt (Android/desktop Chrome)
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; showInstallHint(); });
function showInstallHint() {
  if (sessionStorage.getItem('installHintShown')) return;
  sessionStorage.setItem('installHintShown', '1');
  const wrap = h('div', { class: 'toast-wrap' });
  const t = h('div', { class: 'toast', style: { display: 'flex', gap: '10px', alignItems: 'center' } }, 'Install Aahar as an app?', h('button', { class: 'btn sm primary', onclick: async () => { wrap.remove(); if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; } }, 'Install'), h('button', { class: 'btn sm', style: { color: '#fff' }, onclick: () => wrap.remove() }, 'Later'));
  wrap.append(t); document.body.append(wrap);
  setTimeout(() => wrap.remove(), 12000);
}

boot();
