import { motion } from 'motion/react';
import { S, SITE, age, bmi, nextStep, curQ, RAYDAR_VERSION } from '../engine/store.js';
import { SITES } from '../esource/studies.js';
import { keyName } from '../engine/keys.js';
import { A, Ic, B } from './ui.jsx';
import { Expander, IconSwap } from '../motion/components.jsx';
import { DUR, tr } from '../motion/tokens.js';

export function Legend() {
  const L = [['--fill-success', 'Eligible'], ['--fill-warning', 'Dr check'], ['--fill-danger', 'Exclude'], ['--fill-accent', 'Opens a follow-up']];
  return (
    <span style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap' }}>
      {L.map(([c, l]) => (
        <span className="lg" key={l}><span className="dot" style={{ background: 'var(' + c + ')' }} />{l}</span>
      ))}
    </span>
  );
}

function HBtn({ a, ic, lab, tip, on }) {
  return (
    <button className={'pill' + (on ? ' on' : '')} {...A(a)} title={tip} aria-label={tip} aria-pressed={!!on}>
      <IconSwap k={ic}><Ic n={ic} /></IconSwap>
      {lab ? ' ' + lab : ''}
    </button>
  );
}

/** What the slim header says about where you are: site and step */
function slimLine() {
  const site = SITE.city === 'all' ? 'All sites' : SITE.city === 'sydney' ? 'Sydney' : 'Melbourne';
  let where = { id: 'Identity', qc: 'Quick check', ps: 'Pre-screen', finish: 'Finish' }[S.stage] || '';
  if (S.stage === 'ps' && S.study && S.qon) { const { L, i } = curQ(); if (L.length) where += ', Q' + (i + 1) + ' of ' + L.length; }
  return site + ' · ' + where;
}

export function Header() {
  const s = S.study, a = age(), b = bmi();
  return (
    <div className="bar">
      <span className="brand" title={RAYDAR_VERSION}>
        RAYDAR <span style={{ color: 'var(--text-accent)' }}>2.7</span>
      </span>
      {S.idok ? (
        <span className="pill ok" style={{ cursor: 'default' }}>
          <Ic n="ti-user-check" /> {S.pid}
          {S.sex ? ' · ' + (S.sex === 'f' ? 'F' : 'M') : ''}
          {a != null ? ' · ' + a : ''}
          {b != null ? ' · BMI ' + b : ''}
        </span>
      ) : (
        <span className="pill mut" style={{ cursor: 'default' }}>Call {S.call} · no participant yet</span>
      )}
      {s && (S.stage === 'ps' || S.stage === 'finish') ? (
        <button className="pill" {...A('tool:switch')} title="Switch study">{s.c} <Ic n="ti-selector" /></button>
      ) : null}
      <span className="slim-hide"><SitePicker /></span>
      <span className="only-slim mut" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{slimLine()}</span>
      <span style={{ flex: 1 }} />
      <button className={'slim-hide pill ' + (S.discard ? 'bad' : 'ib')} {...A('discard')} title="Clear this call and start again" style={S.discard ? null : { color: 'var(--text-danger)' }}>
        <Ic n="ti-trash" /> {S.discard ? 'Click again to discard' : 'Discard'}
      </button>
      <span className="hgrp">
        <HBtn a="plan" ic="ti-calendar-stats" lab="Compare dates" tip="Compare cohort dates across studies" on={S.plan} />
        <HBtn a="tool:menu" ic="ti-tool" lab="Tools" tip="Dr enquiry, study snapshot, shortcuts and layout" on={S.tool === 'menu'} />
        <HBtn a="tool:guide" ic="ti-help-circle" lab="Guide" tip="How to use RAYDAR" on={S.tool === 'guide'} />
      </span>
      <span className="hgrp slim-hide">
        <HBtn a="focus" ic="ti-focus-2" tip={S.focusMode ? 'Exit focus mode' : 'Focus mode: hide side panels and extras'} on={S.focusMode} />
        <HBtn a="rail" ic={'ti-layout-sidebar-right' + (S.rail ? '' : '-collapse')} tip={(S.rail ? 'Hide' : 'Show') + ' side panel'} on={S.rail && !S.focusMode} />
        <HBtn a="theme" ic={'ti-' + (S.dark ? 'sun' : 'moon')} tip={S.dark ? 'Switch to light mode' : 'Switch to dark mode'} />
      </span>
      <button className="pill pri" {...A('go:finish')}>Finish call</button>
    </div>
  );
}

/** 2.6: the site filter. A city (or all), then which sites in it. Filters every study list and the dates calendar. */
export function SitePicker() {
  const inCity = SITES.filter((x) => SITE.city === 'all' || x.city === SITE.city);
  return (
    <span className="sitepick" role="group" aria-label="Site">
      <span className="mut" style={{ fontSize: 13 }}>Site</span>
      <span className="seg big">
        {[['all', 'All'], ['melbourne', 'Melbourne'], ['sydney', 'Sydney']].map(([k, l]) => (
          <button key={k} {...A('city:' + k)} className={SITE.city === k ? 'sel' : ''} aria-pressed={SITE.city === k}>{l}</button>
        ))}
      </span>
      {SITE.city !== 'all' && inCity.length > 1 ? inCity.map((x) => {
        const on = !SITE.off[x.key];
        return (
          <button key={x.key} className={'pill sitechip ' + (on ? 'on ' : '') + 'site-' + x.city + (x.key === 'Veritus' ? '-v' : '')} aria-pressed={on} {...A('sitet:' + encodeURIComponent(x.key))}>
            {on ? <Ic n="ti-check" /> : null} {x.label || x.key}
          </button>
        );
      }) : null}
    </span>
  );
}

const STEPS = [['id', 'Identity'], ['qc', 'Quick check'], ['ps', 'Pre-screen'], ['finish', 'Finish']];

/** Steps: the underline slides to the current step, finished steps swap their number for a check. */
export function Steps() {
  const ix = STEPS.findIndex((x) => x[0] === S.stage), n = nextStep();
  // 2.4: once this stage is done, the next step's number pulses twice to point the way
  const ready = n ? STEPS.findIndex((x) => x[1] === n.to) : -1;
  return (
    <div className="stepsrow" style={{ display: 'flex', gap: 4, marginTop: 8 }}>
      {STEPS.map((x, i) => (
        <button
          key={x[0]}
          className="pill wide"
          {...A('go:' + x[0])}
          aria-current={i === ix ? 'step' : undefined}
          style={{
            flex: 1, border: 0, borderBottom: '2px solid ' + (i < ix ? 'var(--border-success)' : 'var(--border)'), borderRadius: 0, position: 'relative',
            color: i === ix ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: i === ix ? 500 : 400,
          }}
        >
          <span className={'sn ' + (i < ix ? 'done' : i === ix ? 'cur' : '') + (i === ready ? ' ready' : '')}>
            <IconSwap k={i < ix ? 'done' : 'n'}>{i < ix ? <Ic n="ti-check" /> : i + 1}</IconSwap>
          </span>
          {x[1]}
          {i === ix ? (
            <motion.span
              layoutId="step-underline"
              transition={tr(DUR.move, 'io')}
              style={{ position: 'absolute', left: 0, right: 0, bottom: -2, height: 2, background: 'var(--border-accent)' }}
            />
          ) : null}
        </button>
      ))}
    </div>
  );
}

function guideText() {
  if (S.stage === 'id') return <><B>Start here.</B> Check the PID and date of birth against their profile, then press <B>Enter</B>.</>;
  if (S.stage === 'qc') return <><B>Quick check</B> rules studies out fast. Studies they can't do drop down the <B>Pivotable studies</B> list on the right. Pick one to pre-screen.</>;
  if (S.stage === 'ps' && !S.study) return <><B>Choose a study.</B> The list follows the site picked in the header; press a study's number or click Start.</>;
  if (S.stage === 'ps' && !S.qon) return <>Check the {S.study.sched ? <B>visit timeline</B> : <B>cohort dates</B>} and read the <B>study information</B> in either order, then press <B>Start questions</B>.</>;
  if (S.stage === 'ps')
    return (
      <>
        Read the <Ic n="ti-microphone" /> <B>Say</B> text aloud. <span style={{ color: 'var(--text-warning)' }}>Recruiter only</span> notes stay with you.{' '}
        {S.mode === 'list' ? 'The list follows the next question to ask.' : <>Tap an answer, or press <B>{keyName('ans1')}</B> for the suggested one, and RAYDAR moves on.</>}
      </>
    );
  return <>Pick how the call ended, then save the file and upload it to CTMS.</>;
}

export function Guide() {
  return (
    <Expander open={S.tips && !S.focusMode}>
      <div className="guide">
        <Ic n="ti-bulb" />
        <span style={{ flex: 1, minWidth: 200 }}>{guideText()}</span>
        {S.stage === 'ps' && S.qon ? <Legend /> : null}
        <button className="pill ib" {...A('tips')} title="Hide tips. Turn them back on from Guide" aria-label="Hide tips" style={{ color: 'inherit' }}>
          <Ic n="ti-x" />
        </button>
      </div>
    </Expander>
  );
}
