// Shared helpers for the RAYDAR study tools.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const REPO = path.resolve(APP, '..');
export const ESOURCE_DIR = path.join(REPO, 'Pre-screening eSource JSONs');
export const DATES_FILE = path.join(REPO, 'RAYDAR cohort dates.json');
export const SCHEDULES_FILE = path.join(REPO, 'RAYDAR visit schedules.json');
export const QC_FILE = path.join(REPO, 'RAYDAR quick check.json');
export const NAME_RE = /^(Emeritus Melbourne|Emeritus Sydney|Veritus) - .+ - pre-screening\.json$/;

export const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
export const esourceFiles = () => readdirSync(ESOURCE_DIR).filter((f) => f.endsWith('.json')).sort();
/** A path given on the command line, or a bare file name inside the eSource folder */
export function resolveEsource(arg) {
  if (existsSync(arg)) return path.resolve(arg);
  const inDir = path.join(ESOURCE_DIR, arg);
  if (existsSync(inDir)) return inDir;
  const hit = esourceFiles().filter((f) => f.toLowerCase().includes(String(arg).toLowerCase()));
  if (hit.length > 1) { const exact = hit.filter((f) => f.toLowerCase() === String(arg).toLowerCase()); if (exact.length === 1) return path.join(ESOURCE_DIR, exact[0]); }
  if (hit.length === 1) return path.join(ESOURCE_DIR, hit[0]);
  throw new Error(hit.length ? 'Several eSource files match "' + arg + '": ' + hit.join(', ') : 'No eSource file found for "' + arg + '"');
}
/** Plain text from eSource HTML, one line per paragraph or list item */
export function text(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n').replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}
/** Sentences that mention dates or study days: what the cohort-dates skill reads */
export const DATE_RE = /\b(\d{1,2}(st|nd|rd|th)?\s+(of\s+)?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(st|nd|rd|th)?|Day\s*-?\d+|in-clinic stay|overnight|nights?\b|FILLED|week\s*\d+)/i;
export const outcomeWord = { c: 'continue', d: 'doctor/delay', x: 'exclude', n: 'opens follow-up', i: 'NO MARKER' };
