import { Component, type ReactNode } from 'react'
import { api } from '../lib/api'
import { CutButton, GhostButton } from './Primitives'

interface State {
  error: Error | null
}

/** If the interface itself fails, say so plainly. Files are never touched by the interface alone. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="crash" role="alert">
        <h1>Whittle hit a snag.</h1>
        <p>The window failed to draw. Your files are fine: the interface cannot change them without the engine, and the engine was not involved.</p>
        <pre className="crash__detail">{this.state.error.message}</pre>
        <div className="crash__actions">
          <CutButton onClick={() => window.location.reload()}>Reload</CutButton>
          <GhostButton onClick={() => void api.openExternal('issues')}>Report this</GhostButton>
        </div>
      </div>
    )
  }
}
