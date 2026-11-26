// npm run test:medicines: the medicines dictionary and prohibited-item matching, without a browser.
import path from 'node:path';
import { convert } from '../../src/esource/convert.js';
import { resolve, suggest, close, describe, ingName, dictVersion } from '../../src/medicines/dict.js';
import { prefill, checkMed, checkHx, readWindow, readDate, readMg, itemKey } from '../../src/medicines/items.js';
import { readJson, esourceFiles, ESOURCE_DIR } from '../tools/lib/common.mjs';

let fails = 0, n = 0;
const ok = (cond, msg, got) => { n++; if (!cond) { fails++; console.log('FAIL ' + msg + (got !== undefined ? '  (got ' + JSON.stringify(got) + ')' : '')); } };
const ings = (q) => { const r = resolve(q); return r ? r.ings.map(ingName) : null; };

console.log('Dictionary', JSON.stringify(dictVersion()));
/* names */
ok(String(ings('Lipitor 40mg')) === 'atorvastatin', 'Lipitor → atorvastatin', ings('Lipitor 40mg'));
ok(String(ings('Panamax Co').sort()) === 'codeine,paracetamol', 'Panamax Co → paracetamol + codeine', ings('Panamax Co'));
ok(String(ings('Ozempic')) === 'semaglutide', 'Ozempic → semaglutide');
ok(String(ings('epinephrine')) === 'adrenaline (epinephrine)', 'epinephrine → adrenaline', ings('epinephrine'));
ok(String(ings('cyclosporine')) === 'ciclosporin', 'US name cyclosporine → ciclosporin', ings('cyclosporine'));
ok(/live vaccine/.test(String(ings('Priorix'))), 'Priorix stays one vaccine ingredient', ings('Priorix'));
ok(resolve('atorvastaten') === null && close('atorvastaten')[0].name === 'atorvastatin', 'misspelling suggests atorvastatin', close('atorvastaten').map((x) => x.name));
ok(suggest('lipi').some((x) => x.name === 'lipitor'), 'typing lipi suggests Lipitor', suggest('lipi').map((x) => x.name));
ok(suggest('tegratol').some((x) => x.name === 'tegretol'), 'typing tegratol suggests Tegretol');
ok(/HMG CoA reductase/.test(describe(resolve('Lipitor'))), 'Lipitor is a statin', describe(resolve('Lipitor')));
ok(/contains THC/.test(describe(resolve('Curaleaf Sunburst'))), 'Curaleaf Sunburst is THC cannabis', describe(resolve('Curaleaf Sunburst')));
ok(resolve('the weather today') === null, 'ordinary words are not medicines', resolve('the weather today'));

/* reading the eSource wording */
ok(JSON.stringify(readWindow('Receipt of antibiotics within the past 6 weeks')) === '{"k":"in","n":6,"u":"w"}', 'window: past 6 weeks', readWindow('Receipt of antibiotics within the past 6 weeks'));
ok(readWindow('in the past month').n === 1, 'window: past month');
ok(readWindow('Previous use of PRA-216').k === 'ever', 'window: previous use = ever');
const today = new Date(2026, 10, 25);
ok(readDate('Mar 2026', today).getDate() === 31, 'Mar 2026 = 31 March');
ok(readDate('2 weeks ago', today) < today, '2 weeks ago is a date');
ok(readMg('40mg daily') === 40, 'reads 40 mg');

/* every real prohibited item pre-fills without error */
const studies = esourceFiles().map((f) => convert(f, readJson(path.join(ESOURCE_DIR, f)), null));
let items = 0, readable = 0;
for (const s of studies) for (const p of (s.pro && s.pro.med) || []) { items++; const it = prefill(p); if (!it.ask) readable++; }
ok(items > 0 && readable / items > 0.7, 'most medication items are matched to medicines or groups (' + readable + ' of ' + items + ')');
const embold = studies.find((s) => /EMBOLD/.test(s.file));
const ccb = embold.pro.med.find((p) => /Diltiazem/.test(p.n));
const pf = prefill(ccb);
ok(pf.cov.i.includes('diltiazem') && !pf.cov.g.length && pf.sug.length, 'named drugs with a group in brackets: drugs only, group suggested', pf);

// 2.10: "Incretins (GLP-1 or GIP drugs)" covers tirzepatide (Mounjaro, PBS A10BX16) as well as the GLP-1 drugs
const incr = checkMed({ t: 'med', n: 'Mounjaro' }, embold);
ok(incr && incr.o === 'x' && /Incretins/.test(incr.n), 'EMBOLD: Mounjaro is excluded under Incretins (GLP-1 or GIP drugs)', incr && incr.n);
const oz = checkMed({ t: 'med', n: 'Ozempic' }, embold);
ok(oz && /Incretins/.test(oz.n), 'EMBOLD: Ozempic is excluded under Incretins', oz && oz.n);

/* lists read from questions and from notes without a "prohibited" title */
const st = (re) => studies.find((s) => re.test(s.file));
const sb = st(/Melbourne - SB3567/), kt = st(/KT502/), vbe = st(/VBE/), sun = st(/SUN/);
const med = (s, n, extra) => checkMed({ t: 'med', n, ...extra }, s, today);
ok(sb.pro.med.length >= 3, 'SB3567 now has medication items (' + sb.pro.med.length + ')');
ok(med(sb, 'Roaccutane') && med(sb, 'Roaccutane').o === 'x', 'SB3567: Roaccutane → excluded', med(sb, 'Roaccutane'));
ok(med(sb, 'Aldactone') && med(sb, 'Aldactone').o === 'x', 'SB3567: Aldactone (spironolactone) → excluded');
ok(!kt.pro.med.some((p) => /^methotrexate$|leflunomide|hydroxychloroquine/i.test(p.n)), 'KT502: required RA drugs are not read as prohibited');
ok(!kt.pro.med.some((p) => /HPV|influenza|COVID/i.test(p.n)), 'KT502: permitted non-live vaccines are not read as prohibited');
ok(kt.pro.med.some((p) => /rituximab/i.test(p.n)), 'KT502: the "NOT allowed" drugs are read');
ok(med(kt, 'Humira') && med(kt, 'Humira').o === 'x', 'KT502: Humira (adalimumab, an anti-TNF) → excluded', med(kt, 'Humira'));
ok(med(kt, 'Plaquenil') === null || med(kt, 'Plaquenil').via === 'words', 'KT502: Plaquenil (required) is not matched as prohibited', med(kt, 'Plaquenil'));
ok(med(vbe, 'Comirnaty') && med(vbe, 'Comirnaty').o === 'x', 'VBE: Comirnaty is an mRNA vaccine → excluded', med(vbe, 'Comirnaty'));
const flu = med(vbe, 'Fluad Quad');
ok(!flu || flu.o !== 'x', 'VBE: a flu vaccine is not an mRNA vaccine (doctor check at most)', flu);
ok(med(sun, "St John's wort") !== null, "SUN: St John's wort is matched", med(sun, "St John's wort"));
ok(!studies.some((s) => s.pro.med.some((p) => /send the participant|await confirmation/i.test(p.n))), 'booking steps are never read as medicines');

/* matching a logged medicine */
const study = (med, proItems) => ({ pro: { med: med.map((p) => ({ k: [], no: [], src: 'test', ...p })) }, proItems: proItems || {} });
const statins = { n: 'Use of statins within 30 days prior to screening', w: 'Exclusionary medication', o: 'x' };
const S1 = study([statins]);
let m = checkMed({ t: 'med', n: 'Lipitor', dose: '40 mg' }, S1, today);
ok(m && m.o === 'x', 'Lipitor, current → excluded', m);
m = checkMed({ t: 'med', n: 'Lipitor', en: 'Mar 2026' }, S1, today);
ok(m && m.o === 'ok', 'Lipitor stopped March → outside 30 days, OK', m);
m = checkMed({ t: 'med', n: 'Lipitor', en: '2 weeks ago' }, S1, today);
ok(m && m.o === 'x', 'Lipitor stopped 2 weeks ago → inside the window, excluded', m);
m = checkMed({ t: 'med', n: 'Panadol' }, S1, today);
ok(m === null, 'Panadol is not a statin', m);
const S2 = study([statins], { [itemKey({ ...statins, src: 'test' })]: { ex: [{ i: 'atorvastatin', mg: 20 }], conf: true } });
ok(checkMed({ t: 'med', n: 'Lipitor', dose: '10 mg' }, S2, today).o === 'ok', 'atorvastatin 10 mg within the allowed 20 mg');
ok(checkMed({ t: 'med', n: 'Lipitor' }, S2, today).o === 'd', 'allowed dose, no dose given → doctor check');
const keto = { n: 'Ketoconazole (oral/systemic)', w: 'Medication List', o: 'x' };
const S3 = study([keto]);
ok(checkMed({ t: 'med', n: 'Nizoral', route: 'shampoo' }, S3, today).o === 'd', 'Nizoral shampoo vs systemic ketoconazole → doctor check');
ok(checkMed({ t: 'med', n: 'ketoconazole 200mg tablet', route: 'Oral' }, S3, today).o === 'x', 'oral ketoconazole → excluded');
const live = { n: 'MMR (measles, mumps, rubella)', w: 'Receipt of any live attenuated vaccines in the past 30 days', o: 'x' };
ok(checkMed({ t: 'med', n: 'Priorix' }, study([live]), today).o === 'x', 'Priorix vs live vaccines → excluded');
ok(checkMed({ t: 'med', n: 'Comirnaty' }, study([live]), today) === null, 'Comirnaty is not a live vaccine');
const words = { n: 'Previous use of PRA-216', w: '', o: 'x', k: ['pra-216'] };
ok(checkMed({ t: 'med', n: 'PRA-216 in a trial' }, study([words]), today).o === 'x', 'items with no medicine still match their own words');
ok(checkMed({ t: 'med', n: 'Lipitor', nm: [statins.n] }, S1, today) === null, '"Not a match" is respected');

/* conditions: possible match only */
const hx = { pro: { hx: [{ n: 'Thyroid disease (hyperthyroidism, hypothyroidism)', w: '', o: 'x', k: [], src: 't' }] } };
m = checkHx({ t: 'hx', n: 'Hypothyroidism' }, hx);
ok(m && m.pm && m.o === 'd', 'hypothyroidism → possible match, check', m);
ok(checkHx({ t: 'hx', n: 'Asthma' }, hx) === null, 'asthma is not thyroid disease');

console.log((fails ? fails + ' of ' : 'All ') + n + ' checks ' + (fails ? 'failed' : 'passed'));
process.exit(fails ? 1 : 0);
