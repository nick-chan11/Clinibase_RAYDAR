/* The medicines dictionary on the call screens:
   - NameField: suggestions while typing a medication name in the med log (brands, ingredients, close spellings)
   - MedLine: under a logged medication, what RAYDAR recognised it as (or "not recognised, did you mean…")
   - MedLookup: the left panel's prohibited-list search, for a medicine name (brand, ingredient or misspelling) */
import { useState, useId } from 'react';
import { S, upd, EF } from '../engine/store.js';
import { resolve, suggest, close, describe, cap, norm } from '../medicines/dict.js';
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

/** The left panel's search, for a medicine name: which list item it falls under for this study, and why */
export function MedLookup({ q, study }) {
  const t = q.trim();
  if (t.length < 3 || !study) return null;
  const r = resolve(t);
  if (!r) {
    const c = close(t, 3);
    return (
      <div className="mlook">
        <div style={{ fontSize: 12 }}><B>{t}</B> <span className="mut">isn't a medicine RAYDAR knows.</span></div>
        {c.length ? <div style={{ fontSize: 12, marginTop: 4 }}>Did you mean {c.map((x, i) => <span key={x.name}>{i ? ', ' : ''}<button className="lnk" onClick={() => upd(() => (S.rq = x.label))}>{x.label}</button></span>)}?</div> : null}
        <div className="mut" style={{ fontSize: 11, marginTop: 4 }}>The list's own words are searched below.</div>
      </div>
    );
  }
  const m = checkMed({ t: 'med', n: t }, study);
  const [cls, label] = m ? BADGE[m.o] : ['', 'Not on the list'];
  const logged = S.log.some((e) => e.n.toLowerCase() === cap(r.name).toLowerCase());
  return (
    <div className="mlook">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <B style={{ fontSize: 13 }}>{cap(r.name)}</B> <span className="mut" style={{ fontSize: 11 }}>{r.type === 'b' ? 'brand' : r.type === 'a' ? 'also called' : 'ingredient'}</span>
          <div className="mut" style={{ fontSize: 11 }}>{describe(r)}</div>
          {r.forms && r.forms.length ? <div className="mut" style={{ fontSize: 11 }}>{r.forms.slice(0, 4).join(' · ')}</div> : null}
        </div>
        <span className={'pill bdg ' + cls} style={m ? null : { background: 'var(--surface-1)' }}>{label}</span>
      </div>
      {m ? (
        <div style={{ fontSize: 12, marginTop: 6 }}>
          {m.via === 'words' ? 'Matches the words of ' : 'Matches '}<B>{m.n}</B>{m.it && m.it.win ? <span className="mut">, {windowWords(m.it.win)}</span> : null}
          {m.why ? <div style={{ fontSize: 11, marginTop: 2 }}>{m.why}.</div> : null}
          <div className="mut" style={{ fontSize: 11, fontStyle: 'italic', marginTop: 2 }}>eSource: {m.w}{m.conf ? '' : ' · RAYDAR\'s reading, not yet confirmed by TST'}</div>
        </div>
      ) : <div className="mut" style={{ fontSize: 11, marginTop: 6 }}>Not on {study.c}'s list. Not listed doesn't mean allowed: check the questions and raise an enquiry if unsure.</div>}
      <div style={{ marginTop: 6 }}>
        {logged ? <span className="mut" style={{ fontSize: 11 }}><Ic n="ti-check" /> In the med log</span> : (
          <button className="lnk" style={{ fontSize: 12 }} onClick={() => upd(() => { S.log.push(Object.assign(EF(), { t: 'med', n: cap(r.name), src: 'Prohibited list search', f: false })); })}><Ic n="ti-plus" /> Add to med log</button>
        )}
      </div>
    </div>
  );
}
