/* RAYDAR 2.11: "Check a list" in the Prohibited list panel (logic in src/medicines/list.js). One medicine per line,
   names first; spelling fixed; choices with "None of these" when unsure; each checked against the chosen study; all
   added to the med log in one go, with any dosage and frequency typed after the name. */
import { S, upd, EF } from '../engine/store.js';
import { readList, chosen, showName, logEntry } from '../medicines/list.js';
import { classOf, ingName, cap } from '../medicines/dict.js';
import { checkMed, windowWords } from '../medicines/items.js';
import { Ic, B } from './ui.jsx';

const BADGE = { x: ['bad', 'Excluded'], d: ['warn', 'Doctor check'], ok: ['ok', 'OK'] };
const Pill = ({ m }) => (m ? <span className={'pill bdg ' + BADGE[m.o][0]}>{BADGE[m.o][1]}</span> : <span className="pill bdg" style={{ background: 'var(--surface-1)' }}>Not on the list</span>);
const sub = (e) => {
  const ii = e.ii || [];
  if (e.type === 'i') return classOf(ii[0]) || '';
  return ii.map(ingName).join(' + ') + (ii.length === 1 && classOf(ii[0]) ? ' · ' + classOf(ii[0]) : '');
};
const lines = (t) => String(t || '').split(/\r?\n/).filter((x) => x.trim()).length;

function Hit({ m }) {
  if (!m) return null;
  return <div className={'lhit ' + (m.o === 'd' ? 'd' : '')}><B>{m.n}</B>{m.it && m.it.win ? <span className="mut"> · {windowWords(m.it.win)}</span> : null}</div>;
}

function Line({ l, i, study }) {
  const pick = S.rlPick[i];
  const e = chosen(l, pick);
  const details = [l.dose, l.fr].filter(Boolean).join(' ');
  if (l.kind === 'choose' && pick == null) {
    return (
      <div className="lc-line">
        <span className="lc-typed">{l.typed}</span>
        <span className="mut" style={{ fontSize: 11.5 }}>{l.ask}</span>
        <div className="lc-chips">
          {l.opts.map((o, j) => {
            const m = checkMed({ t: 'med', n: o.label }, study);
            return (
              <button key={o.name} type="button" className="lc-chip" onClick={() => upd(() => { S.rlPick[i] = j; S.rlAdded = 0; })}>
                <B>{cap(o.label)}</B> <span className="mut">{sub(o)}</span> {m ? <Pill m={m} /> : null}
              </button>
            );
          })}
          <button type="button" className="lc-chip none" onClick={() => upd(() => { S.rlPick[i] = 'none'; S.rlAdded = 0; })}>None of these</button>
        </div>
      </div>
    );
  }
  const n = logEntry(l, pick).n;
  const m = e ? checkMed({ t: 'med', n }, study) : null;
  return (
    <div className="lc-line">
      <div className="lc-top">
        <span style={{ minWidth: 0 }}>
          <B>{e ? showName(l, e) : cap(l.name)}</B> {e ? <span className="mut" style={{ fontSize: 11.5 }}>{sub(e)}{details ? ' · ' + details : ''}</span> : null}
        </span>
        {e ? <Pill m={m} /> : <span className="pill bdg" style={{ background: 'var(--bg-accent)', color: 'var(--text-accent)' }}>Not recognised</span>}
      </div>
      {e && l.fixed ? <span className="lc-fix">Spelling fixed from "{l.name}"</span> : null}
      {l.kind === 'choose' ? <span className="lc-fix">You chose this for "{l.name}". <button type="button" className="lnk" style={{ fontSize: 11 }} onClick={() => upd(() => { delete S.rlPick[i]; })}>Change</button></span> : null}
      {e ? <Hit m={m} /> : <span className="mut" style={{ fontSize: 11.5 }}>Kept as typed. Ask for the name on the box, or raise an enquiry.</span>}
    </div>
  );
}

export function ListCheck({ study }) {
  const R = S.rlRes;
  const n = lines(S.rlist);
  const run = () => upd(() => { S.rlRes = readList(S.rlist); S.rlPick = {}; S.rlAdded = 0; });
  const pending = R ? R.filter((l, i) => l.kind === 'choose' && S.rlPick[i] == null).length : 0;
  const counts = { x: 0, d: 0, ok: 0, no: 0 };
  if (R) R.forEach((l, i) => { const e = chosen(l, S.rlPick[i]); if (!e) return; const m = checkMed({ t: 'med', n: logEntry(l, S.rlPick[i]).n }, study); counts[m ? m.o : 'no']++; });
  const addAll = () => upd(() => {
    let k = 0;
    R.forEach((l, i) => {
      const x = logEntry(l, S.rlPick[i]);
      if (S.log.some((e) => e.t !== 'hx' && e.n.toLowerCase() === x.n.toLowerCase())) return;
      S.log.push(Object.assign(EF(), { t: 'med', n: x.n, dose: x.dose, fr: x.fr, src: 'Prohibited list check', f: false })); k++;
    });
    S.rlAdded = k || -1;
  });
  return (
    <div className="lc">
      <p className="lc-hint"><B>Write the medicine names first, one per line.</B> Dosage, frequency and route can be added later in the med log. Spelling is checked for you.</p>
      <textarea data-f="rlist" aria-label="Medicines, one per line" rows={5} value={S.rlist} placeholder={'e.g.\nmetformin\nForxiga'}
        onChange={(e) => upd(() => { S.rlist = e.target.value; })}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (n) run(); } }} />
      <div className="lc-go">
        <button type="button" className="pill pri" disabled={!n} onClick={run}>Check {n || ''} medicine{n === 1 ? '' : 's'}</button>
        <span className="mut" style={{ fontSize: 11.5 }}>or press Ctrl + Enter</span>
      </div>
      {R && study ? (
        <div className="lc-res">
          <div className="lbox-h">
            <span>{R.length} checked for {study.c}</span>
            <span>{[counts.x && counts.x + ' excluded', counts.d && counts.d + ' doctor check', counts.no && counts.no + ' not on the list', pending && pending + ' to choose'].filter(Boolean).join(' · ')}</span>
          </div>
          {R.map((l, i) => <Line key={i + l.typed} l={l} i={i} study={study} />)}
          <div className="lc-sum">
            <span className="mut" style={{ fontSize: 11.5 }}>Not listed doesn't mean allowed: check the questions and raise an enquiry if unsure.</span>
            {S.rlAdded > 0 ? <span style={{ fontSize: 12 }}><Ic n="ti-check" /> Added {S.rlAdded} to the med log</span>
              : S.rlAdded < 0 ? <span className="mut" style={{ fontSize: 12 }}>Already in the med log</span>
              : pending ? <span className="mut" style={{ fontSize: 12 }}>Choose for {pending} line{pending > 1 ? 's' : ''} first</span>
              : <button type="button" className="pill pri" onClick={addAll}>Add all {R.length} to the med log</button>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
