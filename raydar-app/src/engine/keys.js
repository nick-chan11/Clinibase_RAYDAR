/* Keyboard bindings (RAYDAR 2.4). Recruiters can rebind any of these from Tools → Keyboard shortcuts.
   Bindings are a per-browser convenience, kept in localStorage; every read and write is guarded so
   private windows and blocked storage fall back to the defaults. */

/** [id, label, default key] in the order the shortcuts panel lists them */
export const KEY_ACTIONS = [
  ['ans1', 'Suggested answer, or the one that moves on', '1'],
  ['ans2', 'Second answer', '2'],
  ['ans3', 'Third answer', '3'],
  ['ans4', 'Fourth answer', '4'],
  ['cont', 'Continue to the next step', 'Enter'],
  ['prev', 'Previous question', 'ArrowLeft'],
  ['next', 'Next question, without answering', 'ArrowRight'],
  ['back', 'Back to where you jumped from', 'Backspace'],
  ['park', 'Park the question for later', 'p'],
  ['undo', 'Undo the last answer', 'u'],
  ['search', 'Search questions', '/'],
];
export const DEFAULT_KEYS = Object.fromEntries(KEY_ACTIONS.map((a) => [a[0], a[2]]));
const STORE = 'raydar.keys.v1';

function load() {
  try {
    const raw = window.localStorage.getItem(STORE);
    if (!raw) return { ...DEFAULT_KEYS };
    const saved = JSON.parse(raw);
    const out = { ...DEFAULT_KEYS };
    for (const k of Object.keys(out)) if (typeof saved[k] === 'string' && saved[k]) out[k] = saved[k];
    return out;
  } catch {
    return { ...DEFAULT_KEYS };
  }
}
function save() {
  try { window.localStorage.setItem(STORE, JSON.stringify(KEYS)); } catch { /* storage blocked: bindings last for this tab */ }
}

export let KEYS = load();

/** Letters are matched without case, so Caps Lock never breaks a shortcut. */
export const norm = (k) => (k && k.length === 1 ? k.toLowerCase() : k);

export const keyFor = (id) => KEYS[id];
export const actionFor = (key) => {
  const k = norm(key);
  return Object.keys(KEYS).find((id) => norm(KEYS[id]) === k) || null;
};

/** Keys that can't be bound: they belong to the browser or to typing. */
export const UNBINDABLE = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape', 'Dead', 'Unidentified', 'Process', 'OS', 'ContextMenu']);

/** Bind a key. If another action had it, the two swap so nothing is left without a key. */
export function bind(id, key) {
  const k = norm(key);
  const other = Object.keys(KEYS).find((x) => x !== id && norm(KEYS[x]) === k);
  const prev = KEYS[id];
  KEYS = { ...KEYS, [id]: k };
  if (other) KEYS[other] = prev;
  save();
  return other;
}
export function resetKeys() {
  KEYS = { ...DEFAULT_KEYS };
  save();
}
export const isDefault = () => Object.keys(DEFAULT_KEYS).every((k) => norm(KEYS[k]) === norm(DEFAULT_KEYS[k]));

const NAMES = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', ' ': 'Space', Enter: 'Enter', Backspace: 'Backspace', Delete: 'Del', PageUp: 'PgUp', PageDown: 'PgDn' };
/** How a key is shown on badges: arrows as arrows, letters in capitals. */
export const keyLabel = (k) => (k == null ? '' : NAMES[k] || (k.length === 1 ? k.toUpperCase() : k));
export const keyName = (id) => keyLabel(KEYS[id]);
