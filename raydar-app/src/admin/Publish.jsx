/* Preview the draft as a recruiter, see what changes, and publish it. */
import { useEffect, useState } from 'react';
import { S, act, replaceS } from '../engine/store.js';
import { W, notify, say, draftStudy, publish, history, openFromHistory, beginPreview, changed, liveBundle } from './ws.js';
import { ALL } from '../esource/studies.js';
import { FOLDER } from '../esource/connect.js';
import { nameParts } from '../esource/convert.js';
import { diffStudies } from '../esource/diff.js';
import { ADMIN_MODE } from './gate.js';
import { blocking } from './Checks.jsx';
import { fileFor, SITES } from './ws.js';

const Ic = ({ n }) => <i className={'ti ' + n} aria-hidden="true" />;

export function PublishTab({ b }) {
  const { site, code } = nameParts(b.file, b.esource);
  const s = draftStudy(b);
  const live = b.isNew ? null : liveBundle(b.file);
  const d = s.error ? null : diffStudies(b.file, live ? live.esource : null, b.esource);
  const datesChanged = JSON.stringify((live && live.dates) || null) !== JSON.stringify(b.dates || null) || JSON.stringify((live && live.schedule) || null) !== JSON.stringify(b.schedule || null);
  const setChanged = JSON.stringify((live && live.settings) || {}) !== JSON.stringify(b.settings || {});
  const must = s.error ? [] : blocking(s);
  // dates that aren't finished stop publishing too
  const dateProbs = [];
  if (b.dates) b.dates.cohorts.forEach((c) => { if (!c.in || !c.out) dateProbs.push(c.n + ' has no dates'); else if (!c.src || c.src.trim().length < 10) dateProbs.push(c.n + ' has no study-notes sentence'); (c.v || []).forEach((v) => { if (!v.d) dateProbs.push(c.n + ': a follow-up visit has no date'); }); });
  if (b.schedule && !(b.schedule.value.visits || []).some((v) => v.day === 1)) dateProbs.push('The visit schedule has no Day 1');
  const others = SITES.filter((x) => x !== site).map((x) => fileFor(x, code)).filter((f) => ALL.find((st) => st.file === f));
  const [p, setP] = useState({ sex: 'f', age: 35, ht: 168, wt: 70 });
  const [o, setO] = useState({ approver: '', noSecond: false, note: '', alsoTo: [], anyway: false });
  const [res, setRes] = useState(null);
  // 2.8: say why Publish is greyed out, rather than leaving the button dead
  const why = [];
  if (s.error) why.push('the draft can\'t be read');
  if (!(changed(b.file) || W.qcDirty)) why.push('nothing has changed: this study is the same as the live version. Make a change in another tab first');
  if (!W.name) why.push('enter your name at the top of the page');
  if (dateProbs.length) why.push('finish the dates (see above)');
  if (must.length && !o.anyway) why.push('tick "Publish anyway" or fix the file check problems');
  if (!o.noSecond && !o.approver.trim()) why.push('enter who checked it, or tick "Publish without a second check"');
  const ready = !why.length;

  const preview = () => {
    const saved = S;
    beginPreview(b, () => replaceS(saved));
    const st = ALL.find((x) => x.file === b.file);
    act('new');
    const t = new Date(); t.setFullYear(t.getFullYear() - (+p.age || 35)); t.setDate(t.getDate() - 1);
    S.pid = 'p000000_0000'; S.dob = t.toISOString().slice(0, 10); S.match = true; act('confirm');
    S.sex = p.sex; S.ht = String(p.ht); S.wt = String(p.wt); if (p.sex === 'f') S.preg = 'n';
    act('norest'); S.meds = 'n'; S.smoke = 'n';
    if (st) act('start:' + st.c);
    if (ADMIN_MODE === 'combined') act('admin:close');
  };
  const go = async () => {
    setRes(null);
    const r = await publish(b.file, { ...o });
    setRes(r);
    if (r.ok) { W.view = 'studies'; notify(); }
  };
  return (
    <div className="ad-page ad-publish">
      <div className="ad-pgrid">
        <section className="ad-card">
          <h2>Try it as a recruiter</h2>
          <p className="ad-mut ad-small">Runs the draft in the real call screens, with a made-up participant. Nothing is saved, and recruiters can't see it.</p>
          <div className="ad-row">
            <label className="ad-field sm">Sex <select value={p.sex} onChange={(e) => setP({ ...p, sex: e.target.value })}><option value="f">Female</option><option value="m">Male</option></select></label>
            <label className="ad-field sm">Age <input type="number" value={p.age} onChange={(e) => setP({ ...p, age: e.target.value })} /></label>
            <label className="ad-field sm">Height cm <input type="number" value={p.ht} onChange={(e) => setP({ ...p, ht: e.target.value })} /></label>
            <label className="ad-field sm">Weight kg <input type="number" value={p.wt} onChange={(e) => setP({ ...p, wt: e.target.value })} /></label>
          </div>
          <button className="ad-btn pri" disabled={!!s.error} onClick={preview}><Ic n="ti-player-play" /> Preview as a recruiter</button>
          <p className="ad-mut ad-small">Quick check answers are set to "no" for every condition, medication and smoking; change them in the preview to test the rules.</p>
        </section>

        <section className="ad-card">
          <h2>What changes for recruiters</h2>
          {s.error ? <p className="ad-msg bad">The draft can't be read: {s.error}</p> : !d ? null : (
            <>
              {b.isNew ? <p><b>A new study</b>: {s.Q.filter((q) => q.kind !== 'note').length} questions in {[...new Set(s.Q.map((q) => q.sec))].length} sections.</p> : null}
              {!b.isNew && !d.questions.length && !d.notes.added.length && !d.notes.removed.length && !datesChanged && !setChanged ? <p className="ad-mut">No changes to the questions, notes, dates or settings.</p> : null}
              {!b.isNew ? d.questions.slice(0, 30).map((q, i) => (
                <div key={i} className="ad-chg">
                  <span className={'ad-tag ' + (q.kind === 'removed' ? 'warn' : q.kind === 'added' ? 'ok' : 'dash')}>{q.kind === 'added' ? 'Added' : q.kind === 'removed' ? 'Removed' : 'Changed'}</span> {q.title.slice(0, 90)}
                  {q.details.map((x, k) => (
                    <div key={k} className="ad-small ad-chgd">
                      {x.kind === 'wording' ? <>Wording: …{x.before}<del>{x.was}</del><ins>{x.now}</ins>{x.after}…</> : x.kind === 'answers' ? <>Answers: {x.gone.length ? 'removed ' + x.gone.join(', ') : ''}{x.gone.length && x.come.length ? '; ' : ''}{x.come.length ? 'now ' + x.come.join(', ') : ''}</> : x.kind === 'when' ? <>Shows when: {x.was} → {x.now}</> : x.kind === 'moved' ? <>Moved from {x.was} to {x.now}</> : x.kind === 'hint' ? 'Recruiter hint changed' : 'Notes beside it changed'}
                    </div>
                  ))}
                </div>
              )) : null}
              {!b.isNew && (d.notes.added.length || d.notes.removed.length) ? <div className="ad-chg"><span className="ad-tag dash">Study notes</span> {d.notes.added.length} line(s) added, {d.notes.removed.length} removed{d.datesNotes ? <b className="warn"> · dates mentioned: check Dates and visits</b> : null}</div> : null}
              {datesChanged ? <div className="ad-chg"><span className="ad-tag dash">Dates</span> cohort dates or visit schedule changed</div> : null}
              {setChanged ? <div className="ad-chg"><span className="ad-tag dash">Settings</span> prohibited-list corrections or protocol number changed</div> : null}
              {W.qcDirty ? <div className="ad-chg"><span className="ad-tag dash">Quick check</span> settings changed (they apply to every study)</div> : null}
              {!b.isNew && d.reask ? <p className="ad-msg warn">Callback PDFs saved before this goes live: {d.reask} question(s) will be asked again when they're reopened. Every other answer comes back.</p> : null}
            </>
          )}
        </section>
      </div>

      <section className="ad-card" id="ad-publish">
        <h2>Publish</h2>
        {!W.name ? <p className="ad-msg warn">Enter your name at the top first: it's recorded with every publish.</p> : null}
        {FOLDER.status !== 'connected' || !FOLDER.write ? <p className="ad-msg warn">No studies folder you can save to is connected, so publishing downloads the changed files for you to put in the folder. Connect it on the Studies folder page to publish straight in.</p> : null}
        {dateProbs.length ? <div className="ad-msg bad">Finish the dates first (Dates and visits): {dateProbs.slice(0, 4).join('; ')}{dateProbs.length > 4 ? '…' : ''}</div> : null}
        {must.length ? (
          <div className="ad-msg bad">The file check found {must.length} problem(s) that make questions never show (Quick check and lists tab).
            <label className="ad-check"><input type="checkbox" checked={o.anyway} onChange={(e) => setO({ ...o, anyway: e.target.checked })} /> Publish anyway (the eSource has the same problem)</label></div>
        ) : null}
        {others.length ? (
          <fieldset className="ad-fs"><legend>Also apply the questions to</legend>
            {others.map((f) => <label key={f} className="ad-check"><input type="checkbox" checked={o.alsoTo.includes(f)} onChange={(e) => setO({ ...o, alsoTo: e.target.checked ? o.alsoTo.concat(f) : o.alsoTo.filter((x) => x !== f) })} /> {f.replace(/ - pre-screening\.json$/, '')} (replaces its questions with these; its dates stay)</label>)}
          </fieldset>
        ) : null}
        <label className="ad-field">Note for recruiters (shows once in RAYDAR) <input value={o.note} onChange={(e) => setO({ ...o, note: e.target.value })} placeholder={'e.g. ' + code + ': Day 1 is 30 Nov, about 5-6 hours'} /></label>
        <div className="ad-row" style={{ alignItems: 'flex-end' }}>
          <label className="ad-field">Checked by (a second person) <input value={o.approver} disabled={o.noSecond} onChange={(e) => setO({ ...o, approver: e.target.value })} placeholder="e.g. your team lead" /></label>
          <label className="ad-check"><input type="checkbox" checked={o.noSecond} onChange={(e) => setO({ ...o, noSecond: e.target.checked })} /> Publish without a second check</label>
        </div>
        <div className="ad-row">
          <button className="ad-btn pri big" disabled={!ready || W.busy} onClick={go}>{W.busy ? 'Publishing…' : 'Publish ' + code}</button>
          <span className="ad-mut ad-small">Recorded in the change history with your name{o.noSecond ? '' : ' and the checker\'s'}. Every version is kept and can be rolled back.</span>
        </div>
        {why.length ? <p className="ad-msg warn" role="status">To publish: {why.join('; ')}.</p> : null}
        {res && !res.ok ? <p className="ad-msg bad">{res.msg}</p> : null}
      </section>
      <HistoryList file={b.file} />
    </div>
  );
}

function HistoryList({ file }) {
  const [list, setList] = useState(null);
  useEffect(() => { history(file).then(setList); }, [file, FOLDER.at]);
  if (!list || !list.length) return null;
  return (
    <section className="ad-card">
      <h2>Published versions</h2>
      {list.slice(0, 10).map((n) => <div key={n} className="ad-row"><span className="ad-small">{n.replace(/\.json$/, '')}</span><span style={{ flex: 1 }} /><button className="ad-btn sm" onClick={() => openFromHistory(file, n)}>Open as a draft</button></div>)}
    </section>
  );
}
export { say };
