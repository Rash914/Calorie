// Voice input: Web Speech API in browsers, Capacitor community plugin inside the Android app.
let rec = null;          // active browser recognizer
let nativeSub = null;    // native listener handle
let active = false;

function nativePlugin() {
  const C = typeof window !== 'undefined' ? window.Capacitor : null;
  if (!C || !C.isNativePlatform?.()) return null;
  try { return C.registerPlugin ? C.registerPlugin('SpeechRecognition') : C.Plugins?.SpeechRecognition || null; } catch { return null; }
}
function browserCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isSupported() { return !!(nativePlugin() || browserCtor()); }
export function isNative() { return !!nativePlugin(); }
export function isListening() { return active; }

/**
 * Start listening. Callbacks: onInterim(text), onResult(text), onError(code), onEnd().
 * Resolves once listening has started.
 */
export async function start({ lang = 'en-IN', onInterim, onResult, onError, onEnd }) {
  if (active) stop();
  const plugin = nativePlugin();
  if (plugin) return startNative(plugin, { lang, onInterim, onResult, onError, onEnd });
  const Ctor = browserCtor();
  if (!Ctor) throw new Error('unsupported');
  rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let finalText = '';
  rec.onresult = (ev) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) finalText += r[0].transcript + ' ';
      else interim += r[0].transcript;
    }
    onInterim?.((finalText + interim).trim());
  };
  rec.onerror = (ev) => { onError?.(ev.error || 'error'); };
  rec.onend = () => {
    active = false;
    const t = finalText.trim();
    if (t) onResult?.(t);
    onEnd?.();
    rec = null;
  };
  active = true;
  try { rec.start(); } catch (e) { active = false; rec = null; throw e; }
}

async function startNative(plugin, { lang, onInterim, onResult, onError, onEnd }) {
  const avail = await plugin.available().catch(() => ({ available: false }));
  if (!avail.available) throw new Error('unsupported');
  const perm = await plugin.requestPermissions().catch(() => ({ speechRecognition: 'denied' }));
  if (perm.speechRecognition !== 'granted') { onError?.('not-allowed'); throw new Error('not-allowed'); }
  try { nativeSub?.remove?.(); } catch { /* ignore */ }
  nativeSub = await plugin.addListener('partialResults', (data) => {
    const m = data?.matches?.[0];
    if (m) onInterim?.(m);
  });
  active = true;
  try {
    const res = await plugin.start({ language: lang, maxResults: 1, partialResults: true, popup: false });
    const text = (res?.matches?.[0] || '').trim();
    if (text) onResult?.(text);
  } catch (e) {
    onError?.(normalizeNativeError(e));
  } finally {
    active = false;
    try { nativeSub?.remove?.(); } catch { /* ignore */ }
    nativeSub = null;
    onEnd?.();
  }
}

function normalizeNativeError(e) {
  const m = String(e?.message || e?.errorMessage || e || '').toLowerCase();
  if (/no match|no speech|didn.t hear|timeout/.test(m)) return 'no-speech';
  if (/permission|denied|not allowed/.test(m)) return 'not-allowed';
  if (/network/.test(m)) return 'network';
  if (/audio|recording|microphone/.test(m)) return 'audio-capture';
  if (/not available|unavailable|recognizer busy|busy/.test(m)) return 'service-not-allowed';
  return m || 'error';
}

export function stop() {
  const plugin = nativePlugin();
  if (plugin && active) { plugin.stop().catch(() => {}); return; }
  if (rec) { try { rec.stop(); } catch { /* ignore */ } }
}
export function abort() {
  const plugin = nativePlugin();
  if (plugin && active) { plugin.stop().catch(() => {}); active = false; return; }
  if (rec) { try { rec.abort(); } catch { /* ignore */ } rec = null; }
  active = false;
}

export const ERROR_TEXT = {
  'not-allowed': 'Microphone access was blocked. Allow the mic permission for this site/app and try again.',
  'service-not-allowed': 'Speech service unavailable in this browser. Try Chrome or Edge.',
  'no-speech': 'Didn’t catch anything. Tap the mic and speak clearly, e.g. “2 roti and a katori of dal”.',
  'audio-capture': 'No microphone found.',
  network: 'Speech recognition needs an internet connection on this device.',
  aborted: 'Cancelled.'
};
