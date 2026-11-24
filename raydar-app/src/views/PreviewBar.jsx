import { SOURCE } from '../esource/studies.js';
import { previewEvents } from '../admin/events.js';
import { Ic } from './ui.jsx';

/** 2.8: shown over the call screens while the study admin previews a draft */
export function PreviewBar() {
  return (
    <div role="status" style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', gap: 10, alignItems: 'center', padding: '8px 14px', marginBottom: 8, borderRadius: 10, background: '#3a2a63', color: '#e4dcff', border: '1px solid #7a62c9', fontSize: 13 }}>
      <Ic n="ti-eye" />
      <span style={{ flex: 1 }}><b style={{ fontWeight: 650 }}>Previewing a draft</b> of {SOURCE.preview}. Nothing here is saved or published, and recruiters can't see it.</span>
      <button className="pill" style={{ background: '#e4dcff', color: '#2b2540', border: 0, fontWeight: 600 }} onClick={() => previewEvents.dispatchEvent(new Event('end'))}>Back to the study admin</button>
    </div>
  );
}
