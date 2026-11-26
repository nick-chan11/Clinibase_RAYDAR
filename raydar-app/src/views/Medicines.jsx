/* The medicines dictionary on the call screens:
   - NameField: suggestions while typing a medication name in the med log (brands, ingredients, close spellings)
   - MedLine: under a logged medication, what RAYDAR recognised it as (or "not recognised, did you mean…")
   - MedLookup: the left panel's prohibited-list search, for a medicine name (brand, ingredient or misspelling) */
import { useState, useId, useEffect } from 'react';
import { S, upd, EF } from '../engine/store.js';
import { resolve, suggest, close, describe, cap, norm, lookupList, classOf, sameAs, ingName } from '../medicines/dict.js';
import { checkMed, windowWords } from '../medicines/items.js';
import { Ic, B } from './ui.jsx';

const ROUTE_FIELD = { o: 'Oral', h: 'Inhaled', n: 'Nasal', t: 'Topical', s: 'Transdermal patch', e: 'Eye drops' };

/** The medication name box, with suggestions underneath */
export function NameField({ F, inputProps }) {
  const [open, setOpen] = useState(false), [hi, setHi] = useState(0), [moved, setMoved] = useState(false);
  const id = useId();
  const q = F.n || '';
  const list = open && q.trim().length >= 2 ? suggest(q, 6) : [];
  // 2.9: the list stays open once the whole name is typed ("Metformin" still shows Metformin and the names like it)
  const typed = norm(q);
  const same = (x) => !!x && x.name === typed;
  const pick = (x) => {
    upd(() => {
      F.n = x.label;
      if (!F.route && x.routes && x.routes.length === 1 && ROUTE_FIELD[x.routes]) F.route = ROUTE_FIELD[x.routes];
    });
    setOpen(false);
  };
  const onKey = (e) => {
    if (!list.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setMoved(true); setHi((h) => (h + 1) % list.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setMoved(true); setHi((h) => (h - 1 + list.length) % list.length); }
    // Enter fills the highlighted name; on the name already typed it goes on to add the row, as before
    else if (e.key === 'Enter' && !same(list[hi] || list[0])) { e.preventDefault(); pick(list[hi] || list[0]); }
    // 2.9: Tab fills the highlighted name and stays in the box; once the name is filled, Tab moves on as usual.
    // A close spelling ("Not listed? Type it as heard") is only filled when it was chosen with the arrow keys,
    // so a name RAYDAR doesn't know is never swapped for another medicine by tabbing past it.
    else if (e.key === 'Tab' && !e.shiftKey) {
      const x = list[hi] || list[0];
      if (same(x)) pick(x);
      else if (moved || x.name.startsWith(typed)) { e.preventDefault(); pick(x); }
    }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
  };
  return (
    <div className="msug-wrap">
      <input
        {...inputProps}
        role="combobox" aria-expanded={list.length > 0} aria-controls={id} aria-autocomplete="list"
        onChange={(e) => { setOpen(true); setHi(0); setMoved(false); inputProps.onChange(e); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKey}
      />
      {list.length ? (
        <div className="msug" role="listbox" id={id}>
          {list.map((x, i) => (
            <div key={x.name} role="option" aria-selected={i === hi} className={'msug-o' + (i === hi ? ' on' : '')}
              onMouseDown={(e) => { e.preventDefault(); pick(x); }} onMouseEnter={() => { setHi(i); setMoved(true); }}>
              <span><B>{x.label}</B> <span className="mut">{x.type === 'b' || x.type === 'a' ? x.ings.join(' + ') : x.groups[0] || ''}</span></span>
              <span className="mut msug-t">{x.type === 'b' ? 'brand' : x.type === 'a' ? 'also called' : 'ingredient'}</span>
            </div>
          ))}
          {!list.some((x) => x.name.startsWith(q.trim().toLowerCase().slice(0, 3))) ? <div className="msug-n mut">Close spellings. Not listed? Type it as heard.</div> : null}
        </div>
      ) : null}
    </div>
  );
}

/** 2.10: how often a medicine is taken. Common choices as you type; anything can be typed as heard. */
export const FREQS = ['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'Every morning', 'At night', 'Every second day', 'Weekly', 'Fortnightly', 'Monthly', 'As needed'];

/** A box with suggestions from a fixed list (Frequency). Same keys as the name box: arrows, Enter, Tab, Esc. */
export function ListField({ options, inputProps }) {
  const [open, setOpen] = useState(false), [hi, setHi] = useState(0);
  const id = useId();
  const q = String(inputProps.value || '').trim().toLowerCase();
  const all = q ? [...options.filter((o) => o.toLowerCase().startsWith(q)), ...options.filter((o) => !o.toLowerCase().startsWith(q) && o.toLowerCase().includes(q))] : options;
  const list = open ? all : [];
  const same = (x) => !!x && x.toLowerCase() === q;
  const pick = (x) => { inputProps.onChange({ target: { value: x } }); setOpen(false); };
  const onKey = (e) => {
    if (!list.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => (h + 1) % list.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => (h - 1 + list.length) % list.length); }
    else if (e.key === 'Enter' && q && !same(list[hi])) { e.preventDefault(); pick(list[hi] || list[0]); }
    else if (e.key === 'Tab' && !e.shiftKey && q) { const x = list[hi] || list[0]; if (!same(x)) e.preventDefault(); pick(x); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
  };
  return (
    <div className="msug-wrap">
      <input
        {...inputProps}
        role="combobox" aria-expanded={list.length > 0} aria-controls={id} aria-autocomplete="list"
        onChange={(e) => { setOpen(true); setHi(0); inputProps.onChange(e); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKey}
      />
      {list.length ? (
        <div className="msug" role="listbox" id={id}>
          {list.map((x, i) => (
            <div key={x} role="option" aria-selected={i === hi} className={'msug-o' + (i === hi ? ' on' : '')}
              onMouseDown={(e) => { e.preventDefault(); pick(x); }} onMouseEnter={() => setHi(i)}>
              <span>{x}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Under a logged medicine: what it is, or that RAYDAR doesn't recognise it */
export function MedLine({ e }) {
  if (e.t === 'hx' || e.auto) return null;
  const r = resolve(e.n);
  if (r) return <div className="mut" style={{ fontSize: 11 }}>→ {describe(r)}</div>;
  const c = close(e.n, 2);
  return (
    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
      <span className="pill bdg" style={{ background: 'var(--surface-1)' }}>Not recognised</span>{' '}
      {c.length ? <>Did you mean {c.map((x, i) => <span key={x.name}>{i ? ' or ' : ''}<button className="lnk" style={{ fontSize: 11 }} onClick={() => upd(() => { e.n = x.label; })}>{x.label}</button></span>)}? </> : null}
      Check the spelling, or raise an enquiry.
    </div>
  );
}

const BADGE = { x: ['bad', 'Excluded'], d: ['warn', 'Doctor check'], ok: ['ok', 'OK'] };

/* ---- 2.10: the left panel's search suggests as you type ----
   From the third letter: medicines whose name starts with what's typed (brands and ingredients), each with its
   result for the chosen study, then close spellings under their own heading. The highlighted one opens up with
   labelled tags (drug class; active ingredients and other brands of the same medicine for a brand) and the list
   item it falls under. "Doesn't recognise" is kept for names with no match and no close spelling. */
let LAST = { q: null, L: null };
export function lookupFor(q) {
  if (LAST.q !== q) LAST = { q, L: lookupList(q, 40) };
  return LAST.L;
}
const rowsOf = (L) => [...L.pre, ...L.close];

/** Keys in the search box: arrows move, Enter or Tab picks the highlighted name, Esc clears */
export function lookupKeyDown(e) {
  const t = (S.rq || '').trim();
  if (t.length < 3 || (S.proTab === 'hx')) return;
  const R = rowsOf(lookupFor(t));
  if (!R.length) return;
  const hi = Math.min(S.rqHi || 0, R.length - 1), same = (x) => !!x && x.name === norm(t);
  if (e.key === 'ArrowDown') { e.preventDefault(); upd(() => { S.rqHi = (hi + 1) % R.length; }); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); upd(() => { S.rqHi = (hi - 1 + R.length) % R.length; }); }
  else if ((e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) && !same(R[hi])) { e.preventDefault(); upd(() => { S.rq = R[hi].label; S.rqHi = 0; }); }
  else if (e.key === 'Escape') { e.preventDefault(); upd(() => { S.rq = ''; S.rqHi = 0; }); }
}

const RES_PILL = (m) => (m ? <span className={'pill bdg ' + BADGE[m.o][0]}>{BADGE[m.o][1]}</span> : <span className="pill bdg" style={{ background: 'var(--surface-1)' }}>Not on the list</span>);

function Tag({ k, children }) {
  return <span className="ltag"><i>{k}</i>{children}</span>;
}

/** One suggestion. The highlighted one shows its tags and why it's on the list (or isn't). */
function LookRow({ x, on, study, onPick, id }) {
  const m = checkMed({ t: 'med', n: x.label }, study);
  const ings = x.ii || [];
  const cls = ings.map((i) => classOf(i));
  const sub = x.type === 'i' ? cls[0] : ings.map(ingName).join(' + ') + (ings.length === 1 && cls[0] ? ' · ' + cls[0] : '');
  const logged = S.log.some((e) => norm(e.n) === x.name);
  const others = x.type !== 'i' ? sameAs(ings, x.name) : [];
  return (
    <div id={id} role="option" aria-selected={on} className={'lrow' + (on ? ' on' : '')} onMouseDown={(e) => { e.preventDefault(); onPick(); }}>
      <div className="lrow-h">
        <span style={{ minWidth: 0 }}><B>{cap(x.label)}</B> <span className="mut" style={{ fontSize: 11 }}>{x.type === 'b' ? 'brand' : x.type === 'a' ? 'also called' : 'ingredient'}</span></span>
        {RES_PILL(m)}
      </div>
      {!on ? (sub ? <div className="mut lrow-s">{sub}</div> : null) : (
        <div className="lrow-d">
          <div className="ltags">
            {x.type !== 'i' && ings.length ? <Tag k={ings.length > 1 ? 'Active ingredients' : 'Active ingredient'}>{ings.map(ingName).join(' + ')}</Tag> : null}
            {cls.some(Boolean) ? <Tag k="Drug class">{ings.length > 1 ? ings.map((i, j) => ingName(i) + ': ' + (cls[j] || 'not classed')).join(' · ') : cls[0]}</Tag> : null}
            {others.length ? <Tag k="Same as">{others.length <= 3 ? others.map(cap).join(', ') : others.length + ' other ' + ings.map(ingName).join(' + ') + ' brands'}</Tag> : null}
          </div>
          {m ? (
            <div className={'lhit ' + (m.o === 'd' ? 'd' : '')}>
              {m.via === 'words' ? 'Matches the words of ' : ''}<B>{m.n}</B>{m.it && m.it.win ? <span className="mut"> · {windowWords(m.it.win)}</span> : null}
              {m.why ? <div style={{ fontSize: 11 }}>{m.why}.</div> : null}
              <div className="mut" style={{ fontSize: 11, fontStyle: 'italic' }}>eSource: {m.w}{m.conf ? '' : ' · RAYDAR\'s reading, not yet confirmed by TST'}</div>
            </div>
          ) : <div className="lhit none">Not on {study.c}'s list. Not listed doesn't mean allowed: check the questions and raise an enquiry if unsure.</div>}
          <div>
            {logged ? <span className="mut" style={{ fontSize: 11 }}><Ic n="ti-check" /> In the med log</span> : (
              <button className="lnk" style={{ fontSize: 12 }} onMouseDown={(e) => e.stopPropagation()} onClick={() => upd(() => { S.log.push(Object.assign(EF(), { t: 'med', n: cap(x.label), src: 'Prohibited list search', f: false })); })}><Ic n="ti-plus" /> Add to med log</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** The left panel's search, for a medicine name: suggestions, which list item each falls under, and why */
export function MedLookup({ q, study }) {
  const t = q.trim();
  // keep the highlighted suggestion in view as the arrow keys move through a long list
  useEffect(() => { const el = document.getElementById('lrow' + (S.rqHi || 0)); if (el) el.scrollIntoView({ block: 'nearest' }); }, [S.rqHi, t]);
  if (t.length < 3 || !study) return null;
  const L = lookupFor(t), R = rowsOf(L), hi = Math.min(S.rqHi || 0, Math.max(0, R.length - 1));
  if (!R.length) {
    return (
      <div className="mlook">
        <div style={{ fontSize: 12 }}><B>RAYDAR doesn't recognise "{t}".</B></div>
        <div className="mut" style={{ fontSize: 11, marginTop: 3 }}>No medicine starts with it and nothing is spelt close to it. Check the spelling with the participant, or raise an enquiry. The list's own words are searched below.</div>
      </div>
    );
  }
  const pick = (x) => upd(() => { S.rq = x.label; S.rqHi = 0; });
  const row = (x, j) => <LookRow key={x.name} id={'lrow' + j} x={x} on={j === hi} study={study} onPick={() => (j === hi ? pick(x) : upd(() => { S.rqHi = j; }))} />;
  const n = L.pre.length;
  return (
    <div className="mlook lbox" role="listbox" aria-label="Medicines">
      <div className="lbox-h">
        <span>{n ? (n >= 40 ? '40+ medicines start' : n + ' medicine' + (n > 1 ? 's start' : ' starts')) + ' with "' + t + '"' : 'No medicine starts with that. Closest spellings:'}</span>
        <span>↑↓ choose · Enter picks</span>
      </div>
      <div className="lbox-l">
        {L.pre.map((x, j) => row(x, j))}
        {L.close.length && n ? <div className="lbox-div">Close spellings</div> : null}
        {L.close.map((x, j) => row(x, n + j))}
      </div>
    </div>
  );
}
