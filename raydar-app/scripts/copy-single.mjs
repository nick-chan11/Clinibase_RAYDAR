// Copies a single-file build next to the other RAYDAR versions (2.8: three builds from the same code).
//   node scripts/copy-single.mjs single    → ../RAYDAR_2.8.html            (recruiters; no study admin inside)
//   node scripts/copy-single.mjs admin     → ../RAYDAR_2.8_Admin.html      (the study admin)
//   node scripts/copy-single.mjs combined  → ../RAYDAR_2.8_All-in-one.html (both in one file)
import { copyFileSync, statSync, readFileSync } from 'node:fs';
const mode = process.argv[2] || 'single';
const ver = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version.split('.').slice(0, 2).join('.');
const name = 'RAYDAR_' + ver + ({ single: '', admin: '_Admin', combined: '_All-in-one' }[mode] ?? '') + '.html';
const from = new URL('../dist-' + mode + '/index.html', import.meta.url);
const to = new URL('../../' + name, import.meta.url);
copyFileSync(from, to);
console.log('Wrote ' + name + ' (' + Math.round(statSync(to).size / 1024) + ' KB)');
