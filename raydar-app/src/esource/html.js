/* Study Notes and recruiter notes arrive as HTML written in the eSource editor. RAYDAR shows that formatting
   (bold, colour, lists, tables) but rebuilds every element from an allow-list, so nothing in a file can run
   code or load anything. Black or white text colours are dropped so notes stay readable in dark mode. */

const TAGS = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'span', 'div', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'a', 'hr', 'sup', 'sub', 'mark', 'blockquote', 'figure', 'figcaption', 'code', 'pre', 'small']);
const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea', 'link', 'meta', 'svg', 'math', 'video', 'audio', 'img', 'source', 'template', 'noscript']);
const STYLE_KEYS = new Set(['color', 'background-color', 'font-weight', 'font-style', 'text-decoration', 'text-align']);

function okColour(v) {
  const c = v.trim().toLowerCase().replace(/\s+/g, '');
  if (/^(black|white|windowtext|#000|#000000|#fff|#ffffff|rgb\(0,0,0\)|rgb\(255,255,255\))$/.test(c)) return false;
  const hsl = /^hsl\(\d+(?:\.\d+)?,\d+(?:\.\d+)?%,(\d+(?:\.\d+)?)%\)$/.exec(c);
  if (hsl && (+hsl[1] < 12 || +hsl[1] > 92)) return false;
  return /^(#[0-9a-f]{3,8}|rgba?\([\d.,%]+\)|hsla?\([\d.,%]+\)|[a-z]+)$/.test(c);
}

function cleanStyle(style) {
  const out = [];
  String(style || '').split(';').forEach((d) => {
    const i = d.indexOf(':');
    if (i < 0) return;
    const k = d.slice(0, i).trim().toLowerCase(), v = d.slice(i + 1).trim();
    if (!STYLE_KEYS.has(k) || /url\(|expression|javascript:/i.test(v)) return;
    if ((k === 'color' || k === 'background-color') && !okColour(v)) return;
    out.push(k + ':' + v);
  });
  return out.join(';');
}

const cache = new Map();

/** Sanitised HTML string, safe to render. */
export function sanitize(html) {
  const src = String(html || '');
  if (cache.has(src)) return cache.get(src);
  if (typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString('<div>' + src + '</div>', 'text/html');
  const outDoc = document.implementation.createHTMLDocument('');
  const copy = (node, into) => {
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) { into.appendChild(outDoc.createTextNode(n.nodeValue)); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName.toLowerCase();
      if (DROP.has(tag)) {
        if (tag === 'img') { const e = outDoc.createElement('em'); e.textContent = '[Picture in the eSource]'; into.appendChild(e); }
        return;
      }
      if (!TAGS.has(tag)) { copy(n, into); return; } // unknown wrapper: keep its text
      const e = outDoc.createElement(tag);
      const st = cleanStyle(n.getAttribute('style'));
      if (st) e.setAttribute('style', st);
      if (tag === 'a') {
        const href = n.getAttribute('href') || '';
        if (/^https?:\/\//i.test(href)) { e.setAttribute('href', href); e.setAttribute('target', '_blank'); e.setAttribute('rel', 'noopener noreferrer'); }
      }
      if ((tag === 'td' || tag === 'th') && n.getAttribute('colspan')) e.setAttribute('colspan', String(parseInt(n.getAttribute('colspan'), 10) || 1));
      copy(n, e);
      into.appendChild(e);
    });
  };
  const root = outDoc.createElement('div');
  copy(doc.body.firstChild || doc.body, root);
  // Editors leave runs of empty paragraphs; keep at most one
  let out = root.innerHTML.replace(/(<p>(?:&nbsp;|\s|<br>)*<\/p>\s*){2,}/g, '<p></p>');
  cache.set(src, out);
  return out;
}
