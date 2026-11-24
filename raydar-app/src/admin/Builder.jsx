/* RAYDAR 2.8 study admin: the question builder. Drag blocks in from the left, drag cards to reorder or into another
   section, drop onto a section tab to move a question there. Edits are made to the eSource JSON itself. */
import { useEffect, useRef, useState } from 'react';
import { W, edit, notify, say, saveSetting } from './ws.js';
import { TextBox } from './TextBox.jsx';
import { SETTINGS } from '../esource/studies.js';
import { sanitize } from '../esource/html.js';
import { plain } from '../esource/convert.js';
import {
  clone, isNotesPage, pageName, listAt, elAt, removeAt, insertAt, move, newElement, renameBlock, PALETTE, OUTCOMES, outcomeKey, bareText,
  withOutcome, choicesOf, setChoices, newValue, CHOICE_TYPES, parseWhen, buildWhen, whenWords, whenError, short, ageRange, setAgeRange, walk,
} from './ops.js';

const Ic = ({ n }) => <i className={'ti ' + n} aria-hidden="true" />;
const MIME = 'application/x-raydar';
const OC = { c: 'ok', d: 'warn', delay: 'delay', x: 'bad', i: 'info' };
const sameC = (a, b) => a && b && a.length === b.length && a.every((x, i) => x === b[i]);

function payload(e) { try { return JSON.parse(e.dataTransfer.getData(MIME) || 'null'); } catch (err) { return null; } }
function dropInto(p, cpath, index) {
  if (!p) return;
  edit((b) => {
    const j = b.esource;
    if (p.kind === 'new') {
      const el = newElement(p.type, j);
      if (!el) return;
      insertAt(j, cpath, index, el);
      W.sel = cpath.concat(Math.min(index, listAt(j, cpath).length - 1));
    } else if (p.kind === 'block') {
      const els = renameBlock(j, ((SETTINGS.blocks || {})[p.name] || []));
      els.forEach((el, k) => insertAt(j, cpath, index + k, el));
      W.sel = null;
    } else if (p.kind === 'move') {
      W.sel = move(j, p.path, cpath, index);
    }
  }, 'esource');
}

/** One builder: the questions (notes=false) or the study notes pages (notes=true) */
export function Builder({ notes }) {
  const b = W.drafts[W.file];
  const pages = (b.esource.pages || []).map((p, i) => ({ p, i })).filter((x) => isNotesPage(x.p) === !!notes);
  if (!pages.find((x) => x.i === W.page)) W.page = pages.length ? pages[0].i : 0;
  const page = b.esource.pages[W.page];
  const sel = W.sel && W.sel[0] === W.page ? W.sel : null;
  return (
    <div className="ad-builder">
      <Palette notes={notes} />
      <section className="ad-canvas" aria-label="Questions">
        <SectionTabs pages={pages} notes={notes} />
        {page ? <Cards json={b.esource} cpath={[W.page]} list={page.elements || []} sel={sel} notesPage={!!notes} /> : <p className="ad-mut">No sections yet. Drag "New section" in, or use "+ Section".</p>}
        <p className="ad-mut ad-small">Drag a block from the left to add it, drag a card's handle to reorder, or drop it on a section tab to move it there. Ctrl+Z undoes.</p>
      </section>
      <Inspector json={b.esource} sel={sel} />
    </div>
  );
}

function Palette({ notes }) {
  const blocks = Object.keys(SETTINGS.blocks || {});
  const items = notes ? PALETTE.filter((p) => ['note', 'section'].includes(p[0])).map((p) => (p[0] === 'note' ? ['note', 'Text', 'Study notes or call script'] : p)) : PALETTE;
  return (
    <aside className="ad-pal" aria-label="Blocks">
      <div className="ad-cap">DRAG ONTO THE PAGE</div>
      {items.map(([k, l, d]) => (
        <div key={k} className={'ad-blk' + (k === 'note' ? ' note' : k === 'section' ? ' sec' : '')} draggable
          onDragStart={(e) => { e.dataTransfer.setData(MIME, JSON.stringify(k === 'section' ? { kind: 'section' } : { kind: 'new', type: k })); e.dataTransfer.effectAllowed = 'copy'; }}
          tabIndex={0} role="button" aria-label={'Add ' + l} onKeyDown={(e) => { if (e.key === 'Enter') addToEnd(k); }} onDoubleClick={() => addToEnd(k)}>
          <b>{l}</b>{d ? <span>{d}</span> : null}
        </div>
      ))}
      <div className="ad-cap" style={{ marginTop: 8 }}>SAVED BLOCKS</div>
      {blocks.length ? blocks.map((n) => (
        <div key={n} className="ad-blk saved" draggable onDragStart={(e) => { e.dataTransfer.setData(MIME, JSON.stringify({ kind: 'block', name: n })); }} tabIndex={0} role="button" onKeyDown={(e) => { if (e.key === 'Enter') dropInto({ kind: 'block', name: n }, [W.page], listAt(W.drafts[W.file].esource, [W.page]).length); }}>
          <b>{n}</b><span>{(SETTINGS.blocks[n] || []).length} item(s)</span>
        </div>
      )) : <p className="ad-mut ad-small">Select a question (or a group) and use "Save as a block" to reuse it in other studies.</p>}
      <p className="ad-mut ad-small">Double-click or press Enter on a block to add it at the end.</p>
    </aside>
  );
}
function addToEnd(k) {
  if (k === 'section') return addSection();
  dropInto({ kind: 'new', type: k }, [W.page], listAt(W.drafts[W.file].esource, [W.page]).length);
}
function addSection(at) {
  edit((b) => {
    const pages = b.esource.pages;
    const i = at == null ? pages.length : at;
    pages.splice(i, 0, { name: 'New section ' + (pages.length + 1), title: 'New section', elements: [] });
    W.page = i; W.sel = null;
  }, 'esource');
}

function SectionTabs({ pages, notes }) {
  const [over, setOver] = useState(null), [ren, setRen] = useState(null);
  const b = W.drafts[W.file];
  const counts = (p) => { let n = 0; const go = (l) => (l || []).forEach((el) => { if (el.type === 'panel') go(el.elements); else if (el.type !== 'html' && el.type !== 'image') n++; }); go(p.elements); return n; };
  return (
    <div className="ad-tabs" role="tablist" aria-label="Sections">
      {pages.map(({ p, i }) => (
        <span key={i} className={'ad-tab' + (i === W.page ? ' on' : '') + (over === i ? ' over' : '')}
          onDragOver={(e) => { e.preventDefault(); setOver(i); }} onDragLeave={() => setOver(null)}
          onDrop={(e) => { e.preventDefault(); setOver(null); const pl = payload(e); if (pl && pl.kind === 'section') return addSection(i + 1); dropInto(pl, [i], (p.elements || []).length); W.page = i; notify(); }}>
          {ren === i ? (
            <input autoFocus defaultValue={pageName(p, i)} aria-label="Section name" onBlur={(e) => { const v = e.target.value.trim(); setRen(null); if (v) edit((bb) => { bb.esource.pages[i].title = v; if (!bb.esource.pages[i].name || /^New section/.test(bb.esource.pages[i].name)) bb.esource.pages[i].name = v; }, 'esource'); }} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setRen(null); }} />
          ) : (
            <button role="tab" aria-selected={i === W.page} onClick={() => { W.page = i; W.sel = null; notify(); }} onDoubleClick={() => setRen(i)} title="Double-click to rename">{pageName(p, i)} <span className="ad-mut">{counts(p)}</span></button>
          )}
        </span>
      ))}
      <button className="ad-tab add" onClick={() => addSection()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if ((payload(e) || {}).kind === 'section') addSection(); }}>+ Section</button>
      {pages.length && !(b.esource.pages[W.page].elements || []).length ? <button className="ad-link" onClick={() => edit((bb) => { bb.esource.pages.splice(W.page, 1); W.page = 0; }, 'esource')}>Remove this empty section</button> : null}
      {notes ? null : <span className="ad-mut ad-small" style={{ marginLeft: 'auto' }}>Double-click a section to rename it</span>}
    </div>
  );
}

function Zone({ cpath, index }) {
  const [on, setOn] = useState(false);
  return (
    <div className={'ad-zone' + (on ? ' on' : '')} onDragOver={(e) => { e.preventDefault(); setOn(true); }} onDragLeave={() => setOn(false)}
      onDrop={(e) => { e.preventDefault(); setOn(false); const p = payload(e); if (p && p.kind === 'section') return addSection(W.page + 1); dropInto(p, cpath, index); }}>
      {on ? <span>Drop here</span> : null}
    </div>
  );
}

function Cards({ json, cpath, list, sel, notesPage }) {
  return (
    <div className="ad-cards">
      <Zone cpath={cpath} index={0} />
      {list.map((el, i) => {
        const path = cpath.concat(i);
        return (
          <div key={(el.name || el.type) + i}>
            <Card json={json} el={el} path={path} on={sameC(sel, path)} sel={sel} notesPage={notesPage} />
            <Zone cpath={cpath} index={i + 1} />
          </div>
        );
      })}
      {!list.length ? <p className="ad-mut ad-small" style={{ padding: '6px 10px' }}>Empty. Drag a block here.</p> : null}
    </div>
  );
}

function Card({ json, el, path, on, sel, notesPage }) {
  const pick = () => { W.sel = path; notify(); };
  const when = whenWords(json, el.visibleIf);
  const handle = (
    <span className="ad-handle" draggable title="Drag to move" onDragStart={(e) => { e.dataTransfer.setData(MIME, JSON.stringify({ kind: 'move', path })); e.dataTransfer.effectAllowed = 'move'; e.stopPropagation(); }} aria-hidden="true">⋮⋮</span>
  );
  let body;
  if (el.type === 'panel') {
    body = (
      <div className="ad-grp">
        <div className="ad-grph">Group{el.title ? ': ' + plain(el.title) : ''} <span className="ad-mut">{el.name}</span></div>
        <Cards json={json} cpath={path} list={el.elements || []} sel={sel} notesPage={notesPage} />
      </div>
    );
  } else if (el.type === 'html' || el.type === 'image' || el.type === 'expression') {
    body = el.type === 'html'
      ? <div className={'ad-note' + (notesPage ? ' plain' : '')} dangerouslySetInnerHTML={{ __html: sanitize(el.html || '') }} />
      : <div className="ad-note plain"><em>{el.type === 'image' ? 'Picture (edit it in the eSource tool)' : plain(el.title || el.name)}</em></div>;
  } else {
    const ch = CHOICE_TYPES.has(el.type) ? choicesOf(el) : [];
    const kind = el.type === 'dobandage' ? 'Date of birth and age' : el.type === 'bmi' ? 'Height, weight and BMI' : el.type === 'paneldynamic' ? 'Log of ' + ((el.templateElements || []).map((t) => plain(t.title || t.name)).join(' ').match(/condition|history|diagnos/i) ? 'conditions' : 'medications') : el.type === 'text' || el.type === 'comment' ? 'Typed answer' : el.type === 'checkbox' || el.type === 'tagbox' ? 'Tick all that apply' : '';
    body = (
      <>
        <div className="ad-qt">{plain(el.title || el.name) || <span className="ad-mut">No wording yet</span>}</div>
        {kind ? <div className="ad-kind">{kind}{el.type === 'bmi' && (el.bmiRangeMin != null || el.bmiRangeMax != null) ? ' · BMI ' + (el.bmiRangeMin ?? '?') + ' to ' + (el.bmiRangeMax ?? '?') : ''}</div> : null}
        {ch.length ? <div className="ad-chips">{ch.map((c, k) => { const o = outcomeKey(c.text), t = bareText(plain(c.text)), w = OUTCOMES.find((x) => x[0] === o)[1].replace(' (no marker)', ''); return <span key={k} className={'ad-chip ' + OC[o]} title={'Outcome: ' + w}>{t}{new RegExp(w.split(' ')[0], 'i').test(t) ? '' : ' · ' + w}</span>; })}</div> : null}
      </>
    );
  }
  return (
    <div className={'ad-card2' + (on ? ' on' : '') + (el.type === 'panel' ? ' panel' : '')} onClick={(e) => { e.stopPropagation(); pick(); }}>
      {handle}
      <div className="ad-cbody">
        {when ? <div className="ad-when"><Ic n="ti-corner-down-right" /> {when}</div> : null}
        {body}
      </div>
      <button className="ad-sel" aria-label={'Edit ' + (plain(el.title || '') || el.name)} onClick={(e) => { e.stopPropagation(); pick(); }}><Ic n="ti-pencil" /></button>
    </div>
  );
}

/* ---------------- the settings panel for the selected card ---------------- */
function Inspector({ json, sel }) {
  const el = sel ? (() => { try { return elAt(json, sel); } catch (e) { return null; } })() : null;
  if (!el) return <aside className="ad-insp"><div className="ad-cap">QUESTION SETTINGS</div><p className="ad-mut">Click a card to edit it.</p></aside>;
  const up = (fn) => edit((b) => fn(elAt(b.esource, W.sel)), 'esource');
  const upT = (fn) => edit((b) => fn(elAt(b.esource, W.sel)), 'typing');
  const isQ = !['html', 'image', 'expression', 'panel'].includes(el.type);
  return (
    <aside className="ad-insp" aria-label="Question settings" key={W.file + ':' + W.sel.join('.')}>
      <div className="ad-cap">{el.type === 'html' ? 'NOTE' : el.type === 'panel' ? 'GROUP' : 'QUESTION'} SETTINGS <span className="ad-mut mono">{el.name}</span></div>
      {isQ || el.type === 'panel' ? (
        <label className="ad-field">{el.type === 'panel' ? 'Group title' : 'Say (read aloud)'}
          <TextBox multiline className={el.type === 'panel' ? '' : 'say'} rows={3} value={plain(el.title || '')} onChange={(v) => upT((x) => { x.title = v; })} />
        </label>
      ) : null}
      {isQ ? (
        <label className="ad-field">Recruiter hint (under the question)
          <TextBox multiline rows={2} value={plain(el.description || '')} onChange={(v) => upT((x) => { if (v) x.description = v; else delete x.description; })} />
        </label>
      ) : null}
      {el.type === 'html' ? <RichText key={W.file + el.name} html={el.html || ''} onChange={(h) => edit((b) => { elAt(b.esource, W.sel).html = h; })} onFirst={() => edit(() => {}, 'esource')} /> : null}
      {CHOICE_TYPES.has(el.type) && el.type !== 'boolean' ? <Answers el={el} up={up} upT={upT} /> : null}
      {el.type === 'text' || el.type === 'comment' ? <label className="ad-check"><input type="checkbox" checked={el.type === 'comment'} onChange={(e) => up((x) => { x.type = e.target.checked ? 'comment' : 'text'; })} /> Long answer (several lines)</label> : null}
      {el.type === 'dobandage' ? <AgeRange json={json} el={el} /> : null}
      {el.type === 'bmi' ? (
        <div className="ad-row">
          <label className="ad-field sm">BMI from <input type="number" step="0.1" value={el.bmiRangeMin ?? ''} onChange={(e) => up((x) => { x.bmiRangeMin = e.target.value === '' ? undefined : +e.target.value; })} /></label>
          <label className="ad-field sm">to <input type="number" step="0.1" value={el.bmiRangeMax ?? ''} onChange={(e) => up((x) => { x.bmiRangeMax = e.target.value === '' ? undefined : +e.target.value; })} /></label>
        </div>
      ) : null}
      {el.type === 'paneldynamic' ? (
        <label className="ad-field">Logs
          <select value={(el.templateElements || []).map((t) => plain(t.title || t.name)).join(' ').match(/condition|history|diagnos/i) ? 'hx' : 'med'} onChange={(e) => up((x) => { const fresh = newElement(e.target.value === 'hx' ? 'hxlog' : 'medlog', json); x.templateElements = fresh.templateElements.map((t) => ({ ...t, name: x.name + t.name.slice(fresh.name.length) })); })}>
            <option value="med">Medications, supplements and OTC</option><option value="hx">Medical conditions and history</option>
          </select>
        </label>
      ) : null}
      {el.type !== 'panel' ? <WhenEditor json={json} el={el} up={up} /> : null}
      <div className="ad-insp-acts">
        <button className="ad-btn sm" onClick={() => moveBy(-1)} aria-label="Move up"><Ic n="ti-arrow-up" /></button>
        <button className="ad-btn sm" onClick={() => moveBy(1)} aria-label="Move down"><Ic n="ti-arrow-down" /></button>
        <button className="ad-btn sm" onClick={() => edit((b) => { const j = b.esource, c = clone(elAt(j, W.sel)); const [copy] = renameBlock(j, [c]); insertAt(j, W.sel.slice(0, -1), W.sel[W.sel.length - 1] + 1, copy); W.sel = W.sel.slice(0, -1).concat(W.sel[W.sel.length - 1] + 1); }, 'esource')}><Ic n="ti-copy" /> Duplicate</button>
        <button className="ad-btn sm" onClick={async () => { const n = window.prompt('Name for this saved block (others can drag it into any study):', plain(el.title || el.name || '').slice(0, 40)); if (!n) return; const blocks = { ...(SETTINGS.blocks || {}), [n]: [clone(el)] }; try { await saveSetting('blocks', blocks); say('Saved "' + n + '" as a block.'); } catch (e) { say('Couldn\'t save the block: ' + e.message, 'warn'); } }}><Ic n="ti-bookmark" /> Save as a block</button>
        <button className="ad-btn sm danger" onClick={() => { if (window.confirm('Delete this ' + (isQ ? 'question' : 'item') + '?')) edit((b) => { removeAt(b.esource, W.sel); W.sel = null; }, 'esource'); }}><Ic n="ti-trash" /> Delete</button>
      </div>
      <p className="ad-mut ad-small">Saved in the eSource format TST's tool uses, so the study opens there too.</p>
    </aside>
  );
}
function moveBy(d) {
  edit((b) => {
    const p = W.sel, list = listAt(b.esource, p.slice(0, -1)), i = p[p.length - 1], j = i + d;
    if (j < 0 || j >= list.length) return;
    const [x] = list.splice(i, 1); list.splice(j, 0, x);
    W.sel = p.slice(0, -1).concat(j);
  }, 'esource');
}

function Answers({ el, up, upT }) {
  const ch = choicesOf(el);
  const set = (fn) => up((x) => { const l = choicesOf(x); fn(l); setChoices(x, l); });
  const setT = (fn) => upT((x) => { const l = choicesOf(x); fn(l); setChoices(x, l); });
  return (
    <div className="ad-field">
      <span>Answers and outcomes</span>
      {ch.map((c, k) => (
        <div key={k} className="ad-ans">
          <TextBox aria-label={'Answer ' + (k + 1)} value={bareText(plain(c.text))} onChange={(v) => setT((l) => { l[k].text = withOutcome(v, outcomeKey(l[k].text)); })} />
          <select aria-label={'Outcome for answer ' + (k + 1)} className={'oc ' + OC[outcomeKey(c.text)]} value={outcomeKey(c.text)} onChange={(e) => set((l) => { l[k].text = withOutcome(swapWord(bareText(l[k].text), e.target.value), e.target.value); })}>
            {OUTCOMES.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
          </select>
          <button className="ad-x" aria-label={'Move answer ' + (k + 1) + ' up'} disabled={!k} onClick={() => set((l) => { const [x] = l.splice(k, 1); l.splice(k - 1, 0, x); })}><Ic n="ti-arrow-up" /></button>
          <button className="ad-x" aria-label={'Remove answer ' + (k + 1)} disabled={ch.length < 2} onClick={() => set((l) => l.splice(k, 1))}><Ic n="ti-x" /></button>
        </div>
      ))}
      <button className="ad-link" onClick={() => up((x) => { const l = choicesOf(x); l.push({ value: newValue(x), text: 'New answer ✅' }); setChoices(x, l); })}>+ Add an answer</button>
      <span className="ad-mut ad-small">Saved as the eSource's ✅ ⚠️ 🛑 markers, so nobody types them by hand. "Delay" is a ⚠️ answer that says delay.</span>
    </div>
  );
}

/** "Yes - continue" → "Yes - delay screening" when the outcome changes; text without an outcome word is left alone */
const WORDS = { c: 'continue', d: 'check with doctor', delay: 'delay screening', x: 'exclude' };
function swapWord(t, k) {
  const re = /\s*-\s*(please\s+)?(continue( to( the)? next question| to screen| screening)?|delay( screening)?|exclude|check with (the )?doctors?|raise a medical query|dr enquiry)\b.*$/i;
  if (re.test(t)) return k === 'i' ? t.replace(re, '') : t.replace(re, ' - ' + WORDS[k]);
  return k === 'delay' ? t + ' - delay screening' : t;
}

function AgeRange({ json, el }) {
  const r = ageRange(json, el.name) || [];
  const [lo, setLo] = useState(r[0] || ''), [hi, setHi] = useState(r[1] || '');
  const apply = (a, b2) => edit((b) => setAgeRange(b.esource, W.sel, +a, +b2), 'esource');
  return (
    <div className="ad-field">
      <span>Age range</span>
      <div className="ad-row">
        <label className="ad-field sm">From <input type="number" value={lo} onChange={(e) => setLo(e.target.value)} onBlur={() => apply(lo, hi)} /></label>
        <label className="ad-field sm">to <input type="number" value={hi} onChange={(e) => setHi(e.target.value)} onBlur={() => apply(lo, hi)} /></label>
      </div>
      <span className="ad-mut ad-small">Adds a red "Outside the age range. Please exclude" note under the question, shown only when the age is outside it; RAYDAR reads the range from it for Quick check.{!r.length ? ' If the eSource already sets the range another way, leave this empty.' : ''}</span>
    </div>
  );
}

function WhenEditor({ json, el, up }) {
  const src = el.visibleIf || '';
  const w = parseWhen(src);
  const qs = [];
  walk(json, (x) => { if (x !== el && x.name && CHOICE_TYPES.has(x.type)) qs.push(x); });
  const save = (nw) => up((x) => { const s = buildWhen(nw); if (s) x.visibleIf = s; else delete x.visibleIf; });
  if (!w) {
    const err = whenError(src);
    return (
      <div className="ad-field"><span>Only when</span>
        <textarea rows={2} className="mono" value={src} onChange={(e) => up((x) => { x.visibleIf = e.target.value; })} />
        <span className={err ? 'ad-err' : 'ad-mut ad-small'}>{err ? 'RAYDAR can\'t read this condition: ' + err : 'This condition is more complex than the picker shows, so it\'s shown as written.'}</span>
        <button className="ad-link" onClick={() => up((x) => { delete x.visibleIf; })}>Clear it and show always</button>
      </div>
    );
  }
  return (
    <div className="ad-field"><span>Show this question</span>
      <span className="ad-seg"><button className={!w.rows.length ? 'on' : ''} onClick={() => save({ join: 'or', rows: [] })}>Always</button><button className={w.rows.length ? 'on' : ''} onClick={() => { if (!w.rows.length && qs[0]) save({ join: 'or', rows: [{ q: qs[0].name, vals: [choicesOf(qs[0])[0].value] }] }); }}>Only when…</button></span>
      {w.rows.map((r, k) => {
        const q = qs.find((x) => x.name === r.q);
        return (
          <div key={k} className="ad-whenrow">
            {k ? <select aria-label="And or or" value={w.join} onChange={(e) => save({ ...w, join: e.target.value })}><option value="or">or</option><option value="and">and</option></select> : null}
            <select aria-label="Question" value={r.q} onChange={(e) => { const nq = qs.find((x) => x.name === e.target.value); const rows = w.rows.slice(); rows[k] = { q: e.target.value, vals: nq ? [choicesOf(nq)[0].value] : [] }; save({ ...w, rows }); }}>
              {!q ? <option value={r.q}>{r.q} (not in this study)</option> : null}
              {qs.map((x) => <option key={x.name} value={x.name}>{short(plain(x.title || x.name), 60)}</option>)}
            </select>
            <span className="ad-mut ad-small">is any of</span>
            <div className="ad-whenvals">
              {(q ? choicesOf(q) : []).map((c) => (
                <label key={String(c.value)} className="ad-check"><input type="checkbox" checked={r.vals.map(String).includes(String(c.value))} onChange={(e) => { const rows = w.rows.slice(); const vals = e.target.checked ? r.vals.concat(c.value) : r.vals.filter((v) => String(v) !== String(c.value)); rows[k] = { ...r, vals }; save({ ...w, rows }); }} /> {short(bareText(plain(c.text)), 50)}</label>
              ))}
            </div>
            <button className="ad-x" aria-label="Remove this condition" onClick={() => save({ ...w, rows: w.rows.filter((_, i) => i !== k) })}><Ic n="ti-x" /></button>
          </div>
        );
      })}
      {w.rows.length ? <button className="ad-link" onClick={() => qs[0] && save({ ...w, rows: w.rows.concat({ q: qs[0].name, vals: [choicesOf(qs[0])[0].value] }) })}>+ Another condition</button> : null}
      <span className="ad-mut ad-small">Picked from lists, so it can't point at a question that isn't there.</span>
    </div>
  );
}

/** Notes: formatted text (bold, red, bullets), saved as the eSource's HTML */
function RichText({ html, onChange, onFirst }) {
  const ref = useRef(null), first = useRef(true);
  useEffect(() => { if (ref.current) ref.current.innerHTML = sanitize(html); }, []); // the editor owns its text after the first render
  const cmd = (c, v) => { document.execCommand('styleWithCSS', false, true); document.execCommand(c, false, v); ref.current.focus(); changed(); };
  const changed = () => { if (first.current) { first.current = false; onFirst(); } onChange(sanitize(ref.current.innerHTML)); };
  return (
    <div className="ad-field"><span>Text</span>
      <div className="ad-rtbar" role="toolbar" aria-label="Formatting">
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('bold')} aria-label="Bold"><b>B</b></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('foreColor', '#ff0000')} aria-label="Red (exclusions)"><span style={{ color: '#e05a59', fontWeight: 700 }}>A</span></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('insertUnorderedList')} aria-label="Bullet list"><Ic n="ti-list" /></button>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('removeFormat')} aria-label="Plain text"><Ic n="ti-clear-formatting" /></button>
      </div>
      <div ref={ref} className="ad-rt" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Note text" onInput={changed} />
      <span className="ad-mut ad-small">Red text reads as an exclusion. Bulleted notes under a "please exclude" line become RAYDAR's prohibited lists.</span>
    </div>
  );
}
