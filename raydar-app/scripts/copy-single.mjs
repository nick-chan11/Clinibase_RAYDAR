// Copies the single-file build next to the other RAYDAR versions as RAYDAR_2.4.html
import { copyFileSync, statSync } from 'node:fs';
const from = new URL('../dist-single/index.html', import.meta.url);
const to = new URL('../../RAYDAR_2.4.html', import.meta.url);
copyFileSync(from, to);
console.log('Wrote RAYDAR_2.4.html (' + Math.round(statSync(to).size / 1024) + ' KB)');
