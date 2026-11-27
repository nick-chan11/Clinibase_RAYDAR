/* RAYDAR 2.11: travel time (option G1). From the participant's postcode to a study's site, or to another place its
   eSource names (scans and the like), opened in Google Maps in a separate window: by car or public transport.
   No Google key, no cost, nothing to install. Only the postcode leaves RAYDAR; never a name, phone or email.
   Addresses: RAYDAR study settings.json → sites (each site's address) and studies[file].locations (other places,
   with the eSource's own words). */
import { useEffect, useRef, useState } from 'react';
import { S, upd } from '../engine/store.js';
import { SETTINGS } from '../esource/studies.js';
import { Ic } from './ui.jsx';

const STATE = { 0: 'NT', 2: 'NSW', 3: 'VIC', 4: 'QLD', 5: 'SA', 6: 'WA', 7: 'TAS' };
export const okPostcode = (pc) => /^\d{4}$/.test(String(pc || ''));
const origin = (pc) => pc + ' ' + (STATE[String(pc)[0]] || '') + ' Australia';

/** The Google Maps directions link (no key needed) */
export function mapsUrl(pc, address, mode) {
  return 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(origin(pc)) + '&destination=' + encodeURIComponent(address) + '&travelmode=' + (mode === 'transit' ? 'transit' : 'driving');
}
/** Open it in its own window, which the recruiter can move and resize; the same window is reused each time */
export function openTravel(address, mode) {
  if (!okPostcode(S.pc)) return;
  const w = Math.min(1100, screen.availWidth - 80), h = Math.min(800, screen.availHeight - 80);
  window.open(mapsUrl(S.pc, address, mode), 'raydar-travel', 'popup,width=' + w + ',height=' + h + ',left=' + Math.max(0, screen.availWidth - w - 40) + ',top=40');
}

/** Where a study takes place: its site, then any other place its eSource names */
export function placesFor(s) {
  if (!s) return [];
  const site = (SETTINGS.sites || {})[s.site];
  const out = site ? [{ what: 'Study site', name: site.name, address: site.address }] : [];
  ((SETTINGS.studies || {})[s.file] || {}).locations?.forEach((l) => out.push({ what: l.what, address: l.address, quote: l.quote }));
  return out;
}
/** Each site once, for travel before a study is chosen */
export function allSites() {
  return Object.values(SETTINGS.sites || {}).map((x) => ({ what: x.name, address: x.address }));
}

/* "1096 Toorak Rd", "Suite 2/12 Lord St", "35-45 Spring Street" → a key to spot the same place in a question */
const ST_WORD = { road: 'rd', rd: 'rd', street: 'st', st: 'st', highway: 'hwy', hwy: 'hwy' };
export function placeKey(text) {
  const m = /(\d+)[a-z]?\s+([A-Za-z]+)\s+(Road|Rd|Street|St|Highway|Hwy)\b/i.exec(String(text || ''));
  return m ? m[1] + ' ' + m[2].toLowerCase() + ' ' + ST_WORD[m[3].toLowerCase()] : '';
}
/** The places a question names: its words include the same street address ("1096 Toorak Rd", "2/12 Lord St") */
const unify = (t) => String(t || '').replace(/\bStreet\b/gi, 'St').replace(/\bRoad\b/gi, 'Rd').replace(/\bHighway\b/gi, 'Hwy');
export function placesInQuestion(q, s) {
  const text = unify([q.t, q.r].filter(Boolean).join(' '));
  return placesFor(s).filter((p) => {
    const k = placeKey(p.address);
    if (!k) return false;
    const [num, ...street] = k.split(' ');
    return new RegExp('(^|[^0-9])' + num + '[a-z]?\\s+' + street.join('\\s+') + '\\b', 'i').test(text);
  });
}

function Modes({ p }) {
  return (
    <span className="tv-modes">
      <button type="button" className="pill" onClick={() => openTravel(p.address, 'driving')}><Ic n="ti-car" /> By car</button>
      <button type="button" className="pill" onClick={() => openTravel(p.address, 'transit')}><Ic n="ti-bus" /> Public transport</button>
    </span>
  );
}

function PostcodeBox() {
  return (
    <label className="tv-pc">
      <span>Their postcode</span>
      <input type="text" inputMode="numeric" data-f="pc" value={S.pc} placeholder="e.g. 3150" autoFocus
        onChange={(e) => upd(() => { S.pc = e.target.value.replace(/\D/g, '').slice(0, 4); })} />
    </label>
  );
}

/** A Travel button with a small list of places and By car / Public transport for each */
export function TravelButton({ s, places, label, className, title }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const off = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', off); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); };
  }, [open]);
  const L = places || (s ? placesFor(s) : allSites());
  return (
    <span className="tv-wrap" ref={ref}>
      <button type="button" className={className || 'pill tv-btn'} aria-expanded={open} title={title || 'Travel time in Google Maps'} onClick={() => setOpen((v) => !v)}>
        <Ic n="ti-route" /> {label || 'Travel'}
      </button>
      {open ? (
        <div className="tv-pop" role="dialog" aria-label="Travel time">
          <div className="tv-h">Travel {okPostcode(S.pc) ? <>from <b>{S.pc}</b></> : null}<span className="mut"> · opens Google Maps</span></div>
          {okPostcode(S.pc) ? null : <PostcodeBox />}
          {L.length ? L.map((p) => (
            <div key={p.address} className="tv-row">
              <div style={{ minWidth: 0 }}>
                <b>{p.what}</b><div className="mut">{p.address}</div>
                {p.quote ? <div className="mut tv-q" title={p.quote}>eSource: {p.quote}</div> : null}
              </div>
              {okPostcode(S.pc) ? <Modes p={p} /> : null}
            </div>
          )) : <div className="mut">No address for this study yet. Add the site's address in RAYDAR study settings.json.</div>}
        </div>
      ) : null}
    </span>
  );
}

/** In the header: the postcode, once there is one, and Travel for the study on screen */
export function TravelChip() {
  if (!okPostcode(S.pc)) return null;
  return <TravelButton s={S.study} label={S.pc + ' · Travel'} className="pill tv-chip" title="Travel time from their postcode" />;
}

/** On a question that names a place (the study's site or a scan location): travel to that place */
export function QuestionTravel({ q, s }) {
  const L = placesInQuestion(q, s);
  if (!L.length) return null;
  return (
    <div className="tv-q-row">
      <TravelButton s={s} places={L} label={okPostcode(S.pc) ? 'Travel from ' + S.pc + ' to ' + L[0].address : 'Check travel to ' + L[0].address} />
    </div>
  );
}

