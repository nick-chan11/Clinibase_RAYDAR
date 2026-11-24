import { Component } from 'react';

/**
 * 2.7: if one part of the screen hits a bug, only that part shows a message. Before this, a crash in any panel
 * unmounted the whole app, so the screen went blank even though the call was still in memory.
 */
export class Safe extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error('RAYDAR panel error (' + (this.props.name || 'panel') + '):', err, info && info.componentStack); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="card" role="alert" style={{ borderLeft: '3px solid var(--border-warning)', fontSize: 12 }}>
        <b style={{ fontWeight: 600 }}>{this.props.name || 'This panel'} hit a problem.</b> The call is safe: nothing has been lost.
        <div className="mut" style={{ margin: '4px 0 8px' }}>{String(this.state.err && this.state.err.message || this.state.err)}</div>
        <button className="pill" onClick={() => this.setState({ err: null })}>Try again</button>
      </div>
    );
  }
}
