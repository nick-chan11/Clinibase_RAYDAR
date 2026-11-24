import { useRef } from 'react';
import { S, act, upd, ranked, nextOpen, fmt, COL, RAYDAR_VERSION } from '../engine/store.js';
import { KEY_ACTIONS, isDefault, keyName } from '../engine/keys.js';
import { ST, SOURCE, loadFiles } from '../esource/studies.js';
import { A, Ic, B } from './ui.jsx';
import { Legend } from './Header.jsx';
import { Expander } from '../motion/components.jsx';
import { ImportButton } from './Import.jsx';

function H({ title }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <span style={{ fontWeight: 500, fontSize: 15 }}>{title}</span>
      <button className="pill ib" {...A('close')} aria-label="Close"><Ic n="ti-x" /></button>
    </div>
  );
}
const Card = ({ children }) => <div className="card" style={{ padding: '10px 12px', marginBottom: 10 }}>{children}</div>;

function Menu() {
  const items = [['plan', 'ti-calendar-stats', 'Compare dates'], ['dre:open', 'ti-stethoscope', 'Create Dr enquiry'], ['tool:files', 'ti-files', 'Study files and file check'], ['tool:snap', 'ti-list-search', 'Study snapshot'], ['tool:guide', 'ti-help-circle', 'How to use RAYDAR'], ['tool:help', 'ti-keyboard', 'Keyboard shortcuts (change keys)']];
  const row = (l, ctl) => <div className="row"><span>{l}</span>{ctl}</div>;
  return (
    <Card>
      <H title="Tools" />
      {items.map((x) => (
        <button key={x[0]} className="pill wide" {...A(x[0])} style={{ width: '100%', textAlign: 'left', marginBottom: 6 }}><Ic n={x[1]} /> {x[2]}</button>
      ))}
      <ImportButton label="Import callback PDF" className="pill wide" style={{ width: '100%', textAlign: 'left', marginBottom: 6 }} />
      <div style={{ fontSize: 12, fontWeight: 500, margin: '8px 0 2px' }}>Layout</div>
      {row('Text size', <span className="seg"><button {...A('fs:-1')} aria-label="Smaller text">A-</button><button {...A('fs:1')} aria-label="Larger text">A+</button></span>)}
      {row('Collapse all panels', <button className="pill" {...A('colall')}>Collapse</button>)}
      {row('Reset sizes and panels', <button className="pill" {...A('layoutreset')}>Reset</button>)}
      {row('Tips and guides', <button className="pill" {...A('tips')}>{S.tips ? 'Turn off' : 'Turn on'}</button>)}
      {row('Focus mode', <button className="pill" {...A('focus')}>{S.focusMode ? 'Exit' : 'Turn on'}</button>)}
      {row('Theme', <button className="pill" {...A('theme')}>{S.dark ? 'Light mode' : 'Dark mode'}</button>)}
      <p style={{ fontSize: 11, margin: '8px 0 0' }} className="mut">{RAYDAR_VERSION}</p>
      {S.toast ? <p className="mut" style={{ fontSize: 12 }} role="status">{S.toast}</p> : null}
    </Card>
  );
}

function Guide() {
  const st = (n, h, d) => <div key={n}><b>{n} {h}</b>{d}</div>;
  const ar = (k) => <i key={k} className="ti ti-chevron-right ar" aria-hidden="true" />;
  const W = (ic, h, d) => (
    <div className="row" style={{ fontSize: 12, alignItems: 'flex-start' }}>
      <span style={{ display: 'flex', gap: 6 }}>
        <Ic n={ic} style={{ color: 'var(--text-accent)', marginTop: 2 }} />
        <span><B>{h}</B><br /><span className="mut">{d}</span></span>
      </span>
    </div>
  );
  return (
    <Card>
      <H title="How to use RAYDAR" />
      <div className="flow">
        {st(1, 'Identity', 'Confirm PID and DOB')}{ar('a')}{st(2, 'Quick check', 'Rule studies out fast')}{ar('b')}
        {st(3, 'Pre-screen', 'Read the script, record answers')}{ar('c')}{st(4, 'Finish', 'Save the outcome file')}
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, margin: '4px 0 2px' }}>Where to find things</div>
      {W('ti-calendar-stats', 'Compare dates (top bar)', 'Add away dates. Cohorts sort into Available, Caution and Clash. Hover bars for dates.')}
      {W('ti-pill', 'Meds and history (side panel)', 'Log medications and conditions. They follow you through the call and are checked against the prohibited list.')}
      {W('ti-stethoscope', 'Dr enquiry', 'In the Meds and history panel, or Tools.')}
      {W('ti-search', 'Search questions', 'Press / and type, e.g. tyramine. Click a result to preview it.')}
      {W('ti-list', 'One at a time or Section list', 'Switch above the questions. Section list keeps the next question centred.')}
      {W('ti-keyboard', 'Answer with the keyboard', 'Press 1 for the suggested answer, or the one that moves on. 2, 3 and 4 pick the others. Change any key in Tools.')}
      {W('ti-arrow-back-up', 'Undo and Clear answer', 'Undo appears after each answer (or press U). Clear answer sits next to any recorded answer.')}
      {W('ti-focus-2', 'Focus mode', 'Hides the side panels and extras so only the script shows.')}
      <div style={{ fontSize: 12, fontWeight: 500, margin: '8px 0 4px' }}>Answer colours</div>
      <Legend />
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button className="pill wide" {...A('tips')} style={{ flex: 1 }}>{S.tips ? 'Hide tips' : 'Show tips'}</button>
        <button className="pill wide" {...A('tool:help')} style={{ flex: 1 }}><Ic n="ti-keyboard" /> Shortcuts</button>
      </div>
    </Card>
  );
}

/* Shortcuts you can rebind (RAYDAR 2.4). Click a key, press the new one; Esc cancels.
   A key already in use swaps with the action that had it, so nothing is left without a key. */
let boundAt = 0;
export const markBound = () => { boundAt = performance.now(); };

function Help() {
  const fixed = [['Ctrl Z', 'Undo, as well as the key above'], ['Esc', 'Close preview or clear search'], ['Enter', 'Add to list, in a log field']];
  return (
    <Card>
      <H title="Keyboard shortcuts" />
      <p className="mut" style={{ fontSize: 12, margin: '0 0 6px' }}>Click a key to change it, then press the new key. <B>Esc</B> cancels. Saved in this browser.</p>
      {KEY_ACTIONS.map(([id, label]) => {
        const on = S.rebind === id;
        return (
          <div key={id} className="row" style={{ fontSize: 12, padding: '4px 0' }}>
            <span>{label}</span>
            <button
              className={'pill keycap' + (on ? ' on' : '')}
              aria-label={'Change the key for ' + label + '. Now ' + keyName(id)}
              aria-pressed={on}
              onClick={(e) => { e.preventDefault(); if (performance.now() - boundAt < 300) return; act('rebind:' + id); }}
            >
              {on ? <span className="mut">Press a key…</span> : keyName(id)}
            </button>
          </div>
        );
      })}
      {fixed.map((x) => (
        <div key={x[0]} className="row" style={{ fontSize: 12, padding: '4px 0' }}>
          <span className="mut">{x[1]}</span><span className="k" style={{ margin: 0 }}>{x[0]}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <span className="mut" style={{ fontSize: 12 }} role="status" aria-live="polite">{S.keyMsg}</span>
        <button className="pill" {...A('keyreset')} disabled={isDefault()} style={isDefault() ? { opacity: 0.5, cursor: 'default' } : null}>Reset to defaults</button>
      </div>
    </Card>
  );
}

function Switch() {
  return (
    <Card>
      <H title="Switch study" />
      {ranked().map((x) => (
        <button key={x.s.c} className="pill wide" {...A('start:' + x.s.c)} style={{ width: '100%', textAlign: 'left', marginBottom: 4 }}>
          <span className="dot" style={{ background: COL[x.r[0]] }} /><span className="mono">{x.s.c}</span> <span className="mut" style={{ fontSize: 11 }}>{x.s.site}</span>
        </button>
      ))}
      <p className="mut" style={{ fontSize: 11, margin: '4px 0 0' }}>Meds, history and away dates carry over.</p>
    </Card>
  );
}

function Snap() {
  const q = S.snapQ.toLowerCase();
  const L = ST.filter((s) => (s.c + ' ' + s.d + ' ' + s.site).toLowerCase().includes(q));
  return (
    <Card>
      <H title="Study snapshot" />
      <input type="search" aria-label="Search code or condition" placeholder="Search code or condition" value={S.snapQ} style={{ height: 30, fontSize: 12, width: '100%', boxSizing: 'border-box' }} onChange={(e) => upd(() => (S.snapQ = e.target.value))} />
      <div style={{ marginTop: 6 }}>
        {L.length ? L.map((s) => {
          const no = nextOpen(s);
          return (
            <div key={s.c} className="row" style={{ fontSize: 12, alignItems: 'flex-start' }}>
              <div><div className="mono">{s.c}</div><div className="mut" style={{ fontSize: 11 }}>{s.d}{no ? ' · next ' + fmt(no.in) : ''}</div></div>
              <span className="mut" style={{ fontSize: 11, textAlign: 'right' }}>
                {s.age ? 'Age ' + s.age.join('-') : 'Any age'}
                {s.bmi ? <><br />BMI {s.bmi.join('-')}</> : s.bmiMin ? <><br />BMI {s.bmiMin}+</> : null}
              </span>
            </div>
          );
        }) : <p className="mut" style={{ fontSize: 12 }}>No studies match.</p>}
      </div>
    </Card>
  );
}

/* 2.5: where the studies come from, loading new or updated eSource files, and the file check */
function Files() {
  const inp = useRef(null);
  const pick = async (e) => {
    const res = await loadFiles(e.target.files);
    e.target.value = '';
    upd(() => {
      S.fileMsg = res;
      if (S.study) { const now = ST.find((x) => x.file === S.study.file); if (now) S.study = now; } // keep the call on the newer version
    });
  };
  const withIssues = ST.filter((s) => s.issues.length);
  return (
    <Card>
      <H title="Study files" />
      <p style={{ fontSize: 12, margin: '0 0 8px' }}>
        <B>{ST.length} studies</B> from the TST eSource files{SOURCE.builtAt ? ', built into this RAYDAR on ' + SOURCE.builtAt : ''}. Questions, scripts and notes are used exactly as written in each eSource. Cohort dates come from RAYDAR cohort dates.json.
      </p>
      <input ref={inp} type="file" accept=".json,application/json" multiple onChange={pick} style={{ display: 'none' }} />
      <button className="pill wide" onClick={() => inp.current && inp.current.click()} style={{ width: '100%' }}><Ic n="ti-file-upload" /> Load eSource or Quick check files (.json)</button>
      <p className="mut" style={{ fontSize: 11, margin: '4px 0 0' }}>A file with the same name as a built-in study replaces it until this tab closes; a new name adds a study. Quick check rules are read from each study's questions; RAYDAR quick check.json lists the conditions and any extra rules.</p>
      {S.fileMsg ? (
        <div role="status" style={{ marginTop: 8 }}>
          {S.fileMsg.map((r, i) => <div key={i} style={{ fontSize: 12, color: r.ok ? 'var(--text-success)' : 'var(--text-danger)' }}><Ic n={r.ok ? 'ti-check' : 'ti-alert-triangle'} /> {r.file}: {r.msg}</div>)}
        </div>
      ) : null}
      <div style={{ fontSize: 12, fontWeight: 500, margin: '12px 0 2px' }}>File check {withIssues.length ? <span className="mut" style={{ fontWeight: 400 }}>· {withIssues.reduce((n, s) => n + s.issues.length, 0)} things to check across {withIssues.length} files</span> : null}</div>
      <p className="mut" style={{ fontSize: 11, margin: '0 0 4px' }}>Things in an eSource that stop a question showing, or leave an answer without an outcome (worth passing to TST), and the Quick check rules read from each study. Hover a rule for its question.</p>
      <div style={{ maxHeight: 340, overflowY: 'auto' }}>
        {ST.map((s) => (
          <div key={s.file} className="row" style={{ fontSize: 12, alignItems: 'flex-start', padding: '5px 0' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div><span className="mono">{s.c}</span> <span className="mut">{s.site}{s.version ? ' · ' + s.version : ''}{s.loaded ? ' · loaded file' : ''}</span></div>
              <div className="mut" style={{ fontSize: 11 }}>{s.Q.length} steps{s.cohorts ? ' · ' + s.cohorts.length + ' cohorts with dates' : ''}{s.age ? ' · age ' + s.age[0] + (s.age[1] < 120 ? '-' + s.age[1] : '+') : ''}{s.bmi ? ' · BMI ' + s.bmi[0] + (s.bmi[1] < 100 ? '-' + s.bmi[1] : '+') : ''}</div>
              {s.issues.map((x, i) => <div key={i} style={{ fontSize: 11, color: 'var(--text-warning)', marginTop: 2 }}><Ic n="ti-alert-triangle" /> {x.q ? <B>{x.q}: </B> : null}{x.msg}</div>)}
              {(s.qc || []).map((r, i) => (
                <div key={'qc' + i} style={{ fontSize: 11, marginTop: 2 }} title={r.qt ? 'From the eSource: ' + r.qt + (r.a ? '\nAnswer: ' + r.a : '') : ''}>
                  <span style={{ color: r.result === 'no' ? 'var(--text-danger)' : 'var(--text-warning)' }}>Quick check: {r.why}</span>
                  <span className="mut"> · {r.auto ? 'read from "' + (r.qt.length > 70 ? r.qt.slice(0, 69) + '…' : r.qt) + '"' : 'from RAYDAR quick check.json'}</span>
                </div>
              ))}
              {(s.qcMissing || []).map((m, i) => (
                <div key={'qm' + i} style={{ fontSize: 11, color: 'var(--text-warning)', marginTop: 2 }}><Ic n="ti-alert-triangle" /> Needs <B>{m.name}</B>, which Quick check doesn't ask about yet. Add it to RAYDAR quick check.json.</div>
              ))}
            </div>
            {s.issues.length ? null : <Ic n="ti-check" style={{ color: 'var(--text-success)' }} label="No problems found" />}
          </div>
        ))}
      </div>
    </Card>
  );
}

const TOOLS = { menu: Menu, guide: Guide, help: Help, switch: Switch, snap: Snap, files: Files };

/** The tools drawer opens with the expander, so whatever sits below it glides down instead of jumping. */
export function Drawer({ open }) {
  const last = useRef(S.tool);
  if (S.tool) last.current = S.tool;
  const T = TOOLS[last.current];
  return <Expander open={open && !!S.tool}>{T ? <T /> : null}</Expander>;
}
