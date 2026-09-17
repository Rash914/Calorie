// Me: profile, preferences, data (export/import/reset), about & sources.
import { h, clear, fmt, todayKey } from '../util.js';
import * as store from '../store.js';
import * as calc from '../calc.js';
import * as foods from '../foods.js';
import { icon, toast, confirm, field, segmented, sheet } from './components.js';
import { applyTheme } from '../theme.js';
import { navigate } from '../router.js';
import { creditText, CREDIT_LABEL } from '../credit.js';

export const APP_VERSION = '1.3.0';
export function render(root) {
  clear(root);
  const s = store.get();
  root.append(profileCard(root), prefsCard(root), dataCard(root), aboutCard());
}

export function profileForm(p, { compact = false } = {}) {
  const f = {};
  f.name = h('input', { class: 'input', value: p.name || '', placeholder: 'Your name (optional)', maxlength: 40 });
  f.age = h('input', { class: 'input', type: 'number', inputmode: 'numeric', value: String(p.age), min: 10, max: 100 });
  f.heightCm = h('input', { class: 'input', type: 'number', inputmode: 'decimal', value: String(p.heightCm), min: 100, max: 250 });
  f.weightKg = h('input', { class: 'input', type: 'number', inputmode: 'decimal', step: '0.1', value: String(p.weightKg), min: 20, max: 400 });
  let sex = p.sex, activity = p.activity, condition = p.condition, ethnicity = p.ethnicity || 'asian';
  const actList = h('div', { class: 'col', style: { gap: '6px' } });
  const renderAct = () => { clear(actList); for (const [k, v] of Object.entries(calc.ACTIVITY)) actList.append(h('button', { type: 'button', class: `option ${activity === k ? 'active' : ''}`, onclick: () => { activity = k; renderAct(); } }, h('div', null, h('div', { class: 't' }, v.label), h('div', { class: 'd' }, v.desc)))); };
  renderAct();
  const condSel = h('select', { class: 'input', onchange: (e) => { condition = e.target.value; } }, ...Object.entries(calc.CONDITIONS).map(([k, v]) => h('option', { value: k, selected: k === condition }, v)));
  const el = h('div', { class: 'col' },
    compact ? null : field('Name', f.name),
    field('Sex (for BMR)', segmented([{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }], sex, (v) => { sex = v; condWrap.hidden = v !== 'female'; })),
    h('div', { class: 'grid-3' }, field('Age', f.age), field('Height (cm)', f.heightCm), field('Weight (kg)', f.weightKg)),
    field('Ethnicity (sets the BMI scale)', h('div', { class: 'col', style: { gap: '6px' } }, ...Object.entries(calc.ETHNICITY).map(([k, v]) => {
      const b = h('button', { type: 'button', class: `option ${ethnicity === k ? 'active' : ''}`, onclick: () => { ethnicity = k; b.parentElement.querySelectorAll('.option').forEach((o) => o.classList.toggle('active', o === b)); } }, h('div', null, h('div', { class: 't' }, v.label), h('div', { class: 'd' }, v.desc)));
      return b;
    }))),
    field('Activity level', actList)
  );
  const condWrap = h('div', { hidden: sex !== 'female' }, field('Pregnancy / lactation (ICMR 2020 adds energy)', condSel));
  el.append(condWrap);
  return {
    el,
    read() {
      const age = parseInt(f.age.value, 10), hc = parseFloat(f.heightCm.value), wk = parseFloat(f.weightKg.value);
      if (!(age >= 10 && age <= 100)) return { error: 'Age must be 10–100' };
      if (!(hc >= 100 && hc <= 250)) return { error: 'Height must be 100–250 cm' };
      if (!(wk >= 20 && wk <= 400)) return { error: 'Weight must be 20–400 kg' };
      return { value: { name: f.name.value.trim(), sex, age, heightCm: hc, weightKg: wk, activity, ethnicity, condition: sex === 'female' ? condition : 'none' } };
    }
  };
}

function profileCard(root) {
  const s = store.get();
  const form = profileForm(s.profile);
  return h('div', { class: 'card' },
    h('div', { class: 'row between mb' }, h('h3', null, 'Profile'), h('span', { class: 'muted small' }, `TDEE ${fmt(Math.round(calc.tdee(s.profile)))} kcal`)),
    form.el,
    h('button', { class: 'btn primary block mt', onclick: () => {
      const r = form.read();
      if (r.error) { toast(r.error, 'error'); return; }
      const prev = s.profile.weightKg;
      store.setProfile(r.value);
      if (r.value.weightKg !== prev) store.logWeight(r.value.weightKg);
      toast('Profile saved', 'success');
      render(root);
    } }, icon('check', 18), 'Save profile')
  );
}

function prefsCard(root) {
  const s = store.get();
  return h('div', { class: 'card mt' },
    h('h3', { class: 'mb' }, 'Preferences'),
    h('div', { class: 'col' },
      field('Diet filter for search', segmented([{ value: 'all', label: 'Everything' }, { value: 'egg', label: 'Veg + egg' }, { value: 'veg', label: 'Veg only' }], s.settings.diet, (v) => store.setSettings({ diet: v }))),
      field('Voice language', segmented([{ value: 'en-IN', label: 'English (India)' }, { value: 'hi-IN', label: 'हिन्दी' }], s.settings.lang, (v) => store.setSettings({ lang: v }))),
      field('Theme', segmented([{ value: 'auto', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }], s.settings.theme, (v) => { store.setSettings({ theme: v }); applyTheme(); }))
    )
  );
}

function dataCard(root) {
  const s = store.get();
  const days = Object.keys(s.logs).length;
  const entries = Object.values(s.logs).reduce((a, l) => a + l.length, 0);
  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  fileIn.addEventListener('change', async () => {
    const file = fileIn.files?.[0]; if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast('File too large', 'error'); return; }
    let text; try { text = await file.text(); } catch { toast('Could not read file', 'error'); return; }
    let mode = 'merge';
    await new Promise((res) => sheet({ title: 'Import backup', body: (el) => el.append(h('p', { class: 'muted small' }, 'Merge keeps what you have and adds missing days. Replace overwrites everything with the backup.'),
      h('div', { class: 'mt' }, segmented([{ value: 'merge', label: 'Merge' }, { value: 'replace', label: 'Replace all' }], mode, (v) => { mode = v; }))),
      actions: [{ label: 'Cancel', onClick: ({ close }) => { mode = null; close(); } }, { label: 'Import', kind: 'primary', onClick: ({ close }) => close() }], onClose: res }));
    if (!mode) { fileIn.value = ''; return; }
    try { const r = store.importJSON(text, mode); toast(`Imported ${r.entries} entries across ${r.days} days`, 'success'); applyTheme(); render(root); }
    catch (e) { toast(e.message || 'Import failed', 'error'); }
    fileIn.value = '';
  });
  return h('div', { class: 'card mt' },
    h('h3', null, 'Your data'),
    h('p', { class: 'muted small' }, `${entries} entries over ${days} day${days === 1 ? '' : 's'}, ${s.weights.length} weigh-ins, ${s.custom.length} custom foods. Everything is stored only on this device — export a backup to keep it safe or move phones.`),
    h('div', { class: 'row mt wrap', style: { gap: '8px' } },
      h('button', { class: 'btn secondary grow', onclick: exportBackup }, icon('download', 18), 'Export backup'),
      h('button', { class: 'btn secondary grow', onclick: () => fileIn.click() }, icon('upload', 18), 'Import backup'), fileIn),
    h('button', { class: 'btn danger block mt', onclick: async () => { if (await confirm({ title: 'Delete everything?', message: 'This wipes your logs, weights, plan and profile from this device. Export a backup first if unsure.', okLabel: 'Delete all data', danger: true })) { store.resetAll(); applyTheme(); toast('All data deleted'); navigate('home'); } } }, icon('trash', 18), 'Reset app')
  );
}

export function exportBackup() {
  const json = store.exportJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: `caloriemate-backup-${todayKey()}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  if (navigator.share && /Android|iPhone/i.test(navigator.userAgent)) {
    try { const file = new File([blob], a.download, { type: 'application/json' }); if (navigator.canShare?.({ files: [file] })) navigator.share({ files: [file], title: 'CalorieMate backup' }).catch(() => {}); } catch { /* ignore */ }
  }
  toast('Backup exported');
}

function aboutCard() {
  const n = foods.count();
  return h('div', { class: 'card mt about' },
    h('h3', null, 'About CalorieMate'),
    h('p', { class: 'muted small mt' }, `Indian calorie tracker with voice logging. ${fmt(n)} foods on device; nothing leaves your phone.`),
    h('table', { class: 'mt' },
      h('tr', null, h('td', null, 'Raw foods'), h('td', null, 'ICMR-NIN Indian Food Composition Tables 2017 (IFCT), per 100 g')),
      h('tr', null, h('td', null, 'Recipes'), h('td', null, 'Indian Nutrient Databank (INDB), Jaacks et al. — 1,000+ recipes computed from IFCT ingredients')),
      h('tr', null, h('td', null, 'Portions'), h('td', null, 'Curated household portions (katori/roti/plate) cross-checked with NIN dietary guidelines and Nutrition & Health Annexure-5')),
      h('tr', null, h('td', null, 'Energy needs'), h('td', null, 'Mifflin-St Jeor BMR × activity; ICMR-NIN 2020 RDA shown for reference; +350 pregnancy, +600/+520 lactation')),
      h('tr', null, h('td', null, 'BMI'), h('td', null, 'Asian-Indian cut-offs: <18.5 under, 18.5–22.9 healthy, 23–24.9 overweight, ≥25 obese')),
      h('tr', null, h('td', null, 'Voice'), h('td', null, 'On-device/browser speech recognition (Web Speech API / Android). Audio is not stored by the app.'))),
    h('p', { class: 'faint tiny mt' }, 'Values are estimates; restaurant and home portions vary a lot. This app does not provide medical advice.'),
    h('p', { class: 'small mt', style: { fontWeight: 700, color: 'var(--blue)' } }, `${CREDIT_LABEL} ${creditText()}`, h('span', { class: 'faint', style: { fontWeight: 500 } }, ` · v${APP_VERSION}`))
  );
}
