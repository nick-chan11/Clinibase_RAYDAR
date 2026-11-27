import { forwardRef } from 'react';
import { AnimatePresence } from 'motion/react';
import { S, FLD, TL, isMedT, matchP, eParts, proS, proFor, upd, listTodo } from '../engine/store.js';
import { A, Ic, B, Badge, PanelHead, Resizable } from './ui.jsx';
import { Err, Expander, Row } from '../motion/components.jsx';
import { NameField, MedLine, ListField, FREQS } from './Medicines.jsx';

/* Stable identities for rows and logged items, kept outside the objects so the engine's
   "is this row filled in?" checks never see them. */
const KEYS = new WeakMap();
let seq = 0;
export const keyOf = (o) => { if (!KEYS.has(o)) KEYS.set(o, 'k' + ++seq); return KEYS.get(o); };

export const ROUTES = ['Oral', 'Topical', 'Inhaled', 'Nasal', 'Eye drops', 'Subcutaneous injection', 'Intramuscular injection', 'Intravenous', 'Sublingual', 'Transdermal patch', 'Vaginal', 'Rectal'];
export const RoutesList = () => (
  <datalist id="routes">{ROUTES.map((r) => <option key={r} value={r} />)}</datalist>
);

/** Rows from a study's prohibited list, optionally filtered by a search. */
export function ProRows({ Pl, types, q, limit, quiet }) {
  let L = [];
  types.forEach((t) => (Pl[t] || []).forEach((p) => L.push({ t, ...p })));
  // 2.12: match the item's own name and words, from the start of a word; never the eSource heading above it
  // ("Some examples include:" made "me" bring up every Minoxidil item)
  if (q) { const re = new RegExp('(^|[^a-z0-9])' + q.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); L = L.filter((p) => re.test((p.n + ' ' + p.k.join(' ')).toLowerCase())); }
  const tot = L.length;
  if (limit && !q) L = L.slice(0, limit);
  if (!L.length) return quiet ? null : <p className="mut" style={{ fontSize: 12, margin: '6px 0 0' }}>Nothing on the list matches. Not listed doesn't mean allowed: raise an enquiry if unsure.</p>;
  return (
    <>
      {L.map((p) => {
        const hit = S.log.some((e) => (p.t === 'hx' ? e.t === 'hx' : isMedT(e.t)) && matchP(e) && matchP(e).n === p.n);
        const c = p.o === 'x' ? 'bad' : p.o === 'd' ? 'warn' : 'ok', l = p.o === 'x' ? 'Excluded' : p.o === 'd' ? 'Doctor' : 'Allowed';
        return (
          <div className="row" key={p.t + p.n} style={{ padding: '5px 0', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12 }}>{p.n}{hit ? <> <span className="pill tag" style={{ padding: '0 5px' }}>Logged</span></> : null}</div>
              <div className="mut" style={{ fontSize: 11 }}>{p.w}</div>
            </div>
            <span className={'pill bdg ' + c}>{l}</span>
          </div>
        );
      })}
      {limit && !q && tot > limit ? <p className="mut" style={{ fontSize: 11, margin: '4px 0 0' }}>{tot - limit} more. Search to filter.</p> : null}
    </>
  );
}

/** Multi-row entry form for medications, supplements or history. */
export function Form({ pre, rows, t, wide }) {
  const flds = FLD[t];
  const cols = wide ? (t === 'hx' ? 'minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr)' : 'repeat(3,minmax(0,1fr))') : 'repeat(2,minmax(0,1fr))';
  return (
    <>
      <AnimatePresence initial={false} mode="popLayout">
        {rows.map((F, ri) => (
          <Row key={keyOf(F)} i={0} style={ri ? { borderTop: '.5px dashed var(--border-strong)', paddingTop: 6, marginTop: 6 } : null}>
            {rows.length > 1 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{TL[t]} {ri + 1}</span>
                <button className="pill ib" {...A('rowdel:' + pre + ':' + ri)} aria-label={'Remove row ' + (ri + 1)} style={{ padding: '0 4px' }}><Ic n="ti-x" /></button>
              </div>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 6 }}>
              {flds.map((f) => (
                <label key={f[0]} style={{ display: 'block', ...(!wide && (f[0] === 'n' || f[0] === 'ind') ? { gridColumn: 'span 2' } : null) }}>
                  <span className="fl">{f[1]}{f[0] === 'n' ? <> <span style={{ color: 'var(--text-danger)' }}>*</span></> : null}</span>
                  {(() => {
                    const ip = {
                      type: 'text',
                      id: f[0] === 'n' ? pre + 'Name' + ri : undefined,
                      list: f[0] === 'route' ? 'routes' : undefined,
                      'data-f': pre + '.' + ri + '.' + f[0],
                      placeholder: ri ? '' : f[2],
                      autoComplete: 'off',
                      value: F[f[0]] || '',
                      onChange: (e) => upd(() => (F[f[0]] = e.target.value)),
                    };
                    // medication and supplement names suggest brands and ingredients from the medicines dictionary
                    if (f[0] === 'fr') return <ListField options={FREQS} inputProps={ip} />;
                    return f[0] === 'n' && t !== 'hx' ? <NameField F={F} inputProps={ip} /> : <input {...ip} />;
                  })()}
                </label>
              ))}
            </div>
          </Row>
        ))}
      </AnimatePresence>
      <button className="lnk" {...A('rowadd:' + pre)} style={{ fontSize: 12, marginTop: 6 }}>
        <Ic n="ti-plus" /> Add another {t === 'otc' ? 'supplement or OTC' : TL[t].toLowerCase()} row
      </button>
    </>
  );
}

/** One logged item. */
export const ERow = forwardRef(function ERow({ e, pre, showBadge, i }, ref) {
  const idx = S.log.indexOf(e), p = matchP(e), parts = eParts(e);
  return (
    <Row ref={ref} i={i} className="row" style={{ padding: '6px 0', alignItems: 'flex-start' }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{e.n}{e.f ? <> <span className="pill bdg warn">Flagged</span></> : null}</div>
        {parts.length ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{parts.join(' · ')}</div>
        ) : (
          <button className="lnk" {...A(pre + 'edit:' + idx)} style={{ fontSize: 11, color: 'var(--text-warning)' }}>Add details</button>
        )}
        <MedLine e={e} />
        <div>
          {showBadge ? <Badge p={p} /> : p ? <><span className={'pill bdg ' + (p.o === 'x' ? 'bad' : p.o === 'd' ? 'warn' : 'ok')}>{p.pm ? 'Possible match, check' : p.o === 'x' ? 'Excluded' : p.o === 'd' ? 'Doctor check' : 'OK'}</span> </> : null}
          {p && p.why && !showBadge ? <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.why}. <span className="mut">{p.n}</span></div> : null}
          {p ? <button className="lnk" {...A('notmatch:' + idx + ':' + encodeURIComponent(p.n))} style={{ fontSize: 11, marginLeft: 6 }} title="RAYDAR matched this by name; say so if it's wrong">Not a match</button> : null}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6, fontStyle: 'italic' }}>{e.src}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexShrink: 0 }}>
        <button className="pill ib" {...A('flag:' + idx)} aria-label="Flag for doctor" aria-pressed={!!e.f} style={e.f ? { color: 'var(--text-warning)' } : null}><Ic n="ti-flag" /></button>
        <button className="pill ib" {...A(pre + 'edit:' + idx)} aria-label="Edit"><Ic n="ti-edit" /></button>
        <button className="pill ib" {...A('del:' + idx)} aria-label="Remove"><Ic n="ti-x" /></button>
      </div>
    </Row>
  );
});

/** Stable identity for a logged item, so add/remove animate the right row. */
export const eKey = (e) => keyOf(e);

const groupName = (t) => (t === 'med' ? 'Medications' : t === 'otc' ? 'Supplements and OTC' : 'Medical history');

/** Medication / history log shown inside a question that carries it. */
export function MedLog({ c }) {
  const hx = c === 'hx', code = proS(), types = hx ? ['hx'] : ['med', 'otc'], t = hx ? 'hx' : S.mt;
  // 2.4: history and medications keep separate forms, so both can be open in the section list
  const pre = hx ? 'h' : 'm', rows = hx ? S.hf : S.mf, err = hx ? S.hErr : S.mErr, ed = hx ? S.hed : S.med;
  const panel = hx ? 'hlog' : 'mlog', proOpen = hx ? S.hOpen : S.mOpen, pq = hx ? S.hq : S.mq;
  const n = S.log.filter((e) => types.includes(e.t)).length;
  const P = proFor(code), hasList = ((P.med || []).length + (P.hx || []).length) > 0; // 2.5: most eSources have no list yet
  return (
    <div style={{ marginTop: 10, background: 'var(--surface-1)', borderRadius: 'var(--radius)', padding: '8px 10px' }}>
      <PanelHead id={panel} title={(c === 'hx' ? 'Medical history' : 'Medications, supplements and OTC') + ' logged'} sub={n + (hasList ? ' · checked against ' + code : '')} />
      <Expander open={!S.col[panel]}>
        <Resizable id={panel}>
          {types.map((tt) => {
            const L = S.log.filter((e) => e.t === tt);
            return (
              <div key={tt}>
                <div style={{ fontSize: 12, fontWeight: 500, marginTop: 8, color: 'var(--text-primary)' }}>
                  {groupName(tt)} <span className="mut" style={{ fontWeight: 400 }}>({L.length})</span>
                </div>
                <AnimatePresence initial={false} mode="popLayout">
                  {L.map((e, i) => <ERow key={eKey(e)} e={e} pre="m" showBadge={hasList} i={i} />)}
                </AnimatePresence>
                {!L.length ? <p className="mut" style={{ fontSize: 12, margin: '2px 0 0', fontStyle: 'italic' }}>None logged.</p> : null}
              </div>
            );
          })}
          <div style={{ marginTop: 10, borderTop: '.5px solid var(--border-strong)', paddingTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Add {c === 'hx' ? 'conditions or events' : 'items'}</span>
              {c === 'hx' ? null : (
                <span className="seg">
                  <button {...A('mt:med')} className={t === 'med' ? 'sel' : ''}>Medication</button>
                  <button {...A('mt:otc')} className={t === 'otc' ? 'sel' : ''}>Supplement or OTC</button>
                </span>
              )}
            </div>
            <Form pre={pre} rows={rows} t={t} wide />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>Only the {t === 'hx' ? 'condition' : 'name'} is required. Blank rows are ignored.</span>
              <button className="pill" {...A('madd:' + c)}><Ic n="ti-plus" /> {ed ? 'Save' : 'Add to list'}</button>
            </div>
            <Err msg={err} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            {hasList ? <button className="pill ib" {...A('mpro:' + c)} aria-expanded={proOpen} style={{ paddingLeft: 0, color: 'var(--text-accent)' }}>
              <Ic n="ti-list-search" /> {proOpen ? 'Hide' : 'Search'} prohibited {c === 'hx' ? 'conditions' : 'medications'}
            </button> : <span />}
            <button className="pill ib" {...A('dre:open')} style={{ color: 'var(--text-warning)' }}><Ic n="ti-stethoscope" /> Create Dr enquiry</button>
          </div>
          <Expander open={hasList && proOpen}>
            <input type="text" data-f={hx ? 'hq' : 'mq'} placeholder={hx ? 'Search, e.g. epilepsy' : 'Search, e.g. sertraline'} value={pq} style={{ marginTop: 4 }} onChange={(e) => upd(() => { if (hx) S.hq = e.target.value; else S.mq = e.target.value; })} />
            <div><ProRows Pl={proFor(code)} types={[hx ? 'hx' : 'med']} q={pq} limit={5} /></div>
          </Expander>
        </Resizable>
      </Expander>
    </div>
  );
}

/* ---------------- Side panel: Meds and history ---------------- */
export function LogPanelBody() {
  const t = S.lt;
  const grp = (x) => {
    const L = S.log.filter((e) => e.t === x);
    return (
      <div key={x}>
        {L.length ? <div style={{ fontSize: 12, fontWeight: 500, marginTop: 6 }}>{groupName(x)}</div> : null}
        <AnimatePresence initial={false} mode="popLayout">
          {L.map((e, i) => <ERow key={eKey(e)} e={e} pre="r" i={i} />)}
        </AnimatePresence>
      </div>
    );
  };
  const open = !!(S.logForm || S.ed);
  const todo = listTodo().filter((e) => !(S.filling && S.fillDone.includes(e.n.toLowerCase()))).length;
  return (
    <>
      {S.log.length ? null : <p className="mut" style={{ fontSize: 12, margin: 0, fontStyle: 'italic' }}>Nothing logged yet. Items follow you through the call.</p>}
      {/* 2.12: medicines added from "Check a list" with no details yet */}
      {todo && !open ? (
        <div className="lc-ask" style={{ marginTop: 6 }}>
          <span><B>{todo} from the list still need{todo === 1 ? 's' : ''} details.</B> <span className="mut">Dosage, frequency and route.</span></span>
          <button className="pill pri" {...A('fillstart')}>Fill in details, one by one</button>
        </div>
      ) : null}
      {grp('med')}{grp('otc')}{grp('hx')}
      <Expander open={!open}>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button className="pill wide" {...A('logform')} style={{ flex: 1 }}><Ic n="ti-plus" /> Add items</button>
          <button className="pill warn wide" {...A('dre:open')} style={{ flex: 1 }}><Ic n="ti-stethoscope" /> Dr enquiry</button>
        </div>
      </Expander>
      <Expander open={open}>
        <div style={{ marginTop: 8, borderTop: '.5px solid var(--border-strong)', paddingTop: 8 }}>
          <div className="seg" style={{ display: 'flex', marginBottom: 6 }}>
            {[['med', 'Meds'], ['otc', 'Supps/OTC'], ['hx', 'History']].map(([k, l]) => (
              <button key={k} style={{ flex: 1, minWidth: 0, padding: '4px 2px' }} {...A('lt:' + k)} className={t === k ? 'sel' : ''}>{l}</button>
            ))}
          </div>
          {S.filling ? <p className="lc-filling">Details for a medicine from the list{todo ? <> · {todo} more after this</> : null}. Save goes to the next; Cancel stops.</p> : null}
          <Form pre="r" rows={S.f} t={t} />
          <p style={{ fontSize: 11, margin: '4px 0 0', fontStyle: 'italic' }} className="mut">Only the {t === 'hx' ? 'condition' : 'name'} is required. Blank rows are ignored.</p>
          <Err msg={S.logErr} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button className="pill wide" {...A('logform')} style={{ flex: 1 }}>Cancel</button>
            <button className="pill pri wide" {...A('logadd')} style={{ flex: 2 }}><Ic n="ti-plus" /> {S.filling ? (todo ? 'Save and next' : 'Save') : S.ed ? 'Save changes' : 'Add to list'}</button>
          </div>
        </div>
      </Expander>
    </>
  );
}
