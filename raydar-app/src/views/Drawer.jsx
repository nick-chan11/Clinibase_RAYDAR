import { useRef } from 'react';
import { S, upd, ranked, nextOpen, fmt, COL, RAYDAR_VERSION } from '../engine/store.js';
import { ST } from '../engine/data.js';
import { A, Ic, B } from './ui.jsx';
import { Legend } from './Header.jsx';
import { Expander } from '../motion/components.jsx';

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
  const items = [['plan', 'ti-calendar-stats', 'Compare dates'], ['dre:open', 'ti-stethoscope', 'Create Dr enquiry'], ['tool:snap', 'ti-list-search', 'Study snapshot'], ['tool:guide', 'ti-help-circle', 'How to use RAYDAR'], ['tool:help', 'ti-keyboard', 'Keyboard shortcuts'], ['import', 'ti-file-import', 'Import callback or PDF']];
  const row = (l, ctl) => <div className="row"><span>{l}</span>{ctl}</div>;
  return (
    <Card>
      <H title="Tools" />
      {items.map((x) => (
        <button key={x[0]} className="pill wide" {...A(x[0])} style={{ width: '100%', textAlign: 'left', marginBottom: 6 }}><Ic n={x[1]} /> {x[2]}</button>
      ))}
      <div style={{ fontSize: 12, fontWeight: 500, margin: '8px 0 2px' }}>Layout</div>
      {row('Text size', <span className="seg"><button {...A('fs:-1')} aria-label="Smaller text">A-</button><button {...A('fs:1')} aria-label="Larger text">A+</button></span>)}
      {row('Collapse all panels', <button className="pill" {...A('colall')}>Collapse</button>)}
      {row('Reset sizes and panels', <button className="pill" {...A('layoutreset')}>Reset</button>)}
      {row('Tips and guides', <button className="pill" {...A('tips')}>{S.tips ? 'Turn off' : 'Turn on'}</button>)}
      {row('Focus mode', <button className="pill" {...A('focus')}>{S.focusMode ? 'Exit' : 'Turn on'}</button>)}
      {row('Theme', <button className="pill" {...A('theme')}>{S.dark ? 'Light mode' : 'Dark mode'}</button>)}
      <p style={{ fontSize: 11, margin: '8px 0 0' }} className="mut">{RAYDAR_VERSION.replace('RAYDAR 2.2', 'RAYDAR 2.3')}</p>
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

function Help() {
  const K = [['1 2 3', 'Pick that answer'], ['U', 'Undo the last answer'], ['Left / Right', 'Previous or next question, without answering'], ['Backspace', 'Back to where you jumped from'], ['/', 'Search questions'], ['Esc', 'Close preview or clear search'], ['Enter', 'Add to list, in a log field']];
  return (
    <Card>
      <H title="Keyboard shortcuts" />
      {K.map((x) => <div key={x[0]} className="row" style={{ fontSize: 12 }}><span className="k" style={{ margin: 0 }}>{x[0]}</span><span className="mut">{x[1]}</span></div>)}
    </Card>
  );
}

function Switch() {
  return (
    <Card>
      <H title="Switch study" />
      {ranked().map((x) => (
        <button key={x.s.c} className="pill wide" {...A('start:' + x.s.c)} style={{ width: '100%', textAlign: 'left', marginBottom: 4 }}>
          <span className="dot" style={{ background: COL[x.r[0]] }} /><span className="mono">{x.s.c}</span>
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

const TOOLS = { menu: Menu, guide: Guide, help: Help, switch: Switch, snap: Snap };

/** The tools drawer opens with the expander, so whatever sits below it glides down instead of jumping. */
export function Drawer({ open }) {
  const last = useRef(S.tool);
  if (S.tool) last.current = S.tool;
  const T = TOOLS[last.current];
  return <Expander open={open && !!S.tool}>{T ? <T /> : null}</Expander>;
}
