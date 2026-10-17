import { Component } from 'react'
import ConnectionError from './ConnectionError'

// A lazy-loaded page chunk that fails to download (weak network, or a new
// deploy replaced the old file names) would otherwise unmount the whole app
// to a blank screen. This keeps the shell and offers a retry instead.
class RouteErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="mx-auto max-w-xl pt-10">
          <ConnectionError onRetry={() => window.location.reload()} />
        </div>
      )
    }
    return this.props.children
  }
}

export default RouteErrorBoundary
