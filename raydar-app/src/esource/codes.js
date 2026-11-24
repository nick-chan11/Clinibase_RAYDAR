/* Protocol numbers for file names and PDF headers (RAYDAR 2.7). Kept apart from the PDF code so the study tools in
   scripts/ can use the same rule. */
/* The team's file names use the protocol number. The eSource title starts with it, except CORSERA, whose eSource
   says COR-PAG-26 while the PDFs the team already files say COR-PAG-26-101. */
export const PROTO_OVERRIDE = { CORSERA: 'COR-PAG-26-101' };
export function protoCode(s) {
  if (!s) return 'QuickCheck';
  if (s.protocolOverride) return s.protocolOverride; // 2.8: set in the study admin (RAYDAR study settings.json)
  if (PROTO_OVERRIDE[s.code]) return PROTO_OVERRIDE[s.code];
  const m = /^\s*([A-Za-z0-9][A-Za-z0-9.-]*\d[A-Za-z0-9.-]*)/.exec(s.d || '');
  return m ? m[1] : s.code;
}

/** A short fingerprint of a question's wording and answers, to tell on import whether the eSource changed it */
export function qhash(q) {
  const t = q.t + '|' + (q.a || []).map((b) => b[0] + '=' + b[2]).join(';');
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
