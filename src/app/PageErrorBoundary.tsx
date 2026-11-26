import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'

type Props = { children: ReactNode; /** Changing it (the route) clears the error. */ resetKey: string }
type State = { failed: boolean; key: string }

/**
 * Keeps one page's failure from blanking the whole app. The usual cause is a
 * page's code that can't be fetched (offline before it was ever cached, or a
 * tab left open across an update), so the way out is a reload. The nav stays usable.
 */
export default class PageErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, key: this.props.resetKey }

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('A page failed to load', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="max-w-2xl mx-auto px-4 pt-16 pb-28 text-center" role="alert">
        <p className="text-[18px] font-extrabold text-primary">This page couldn’t load.</p>
        <p className="text-[14px] text-muted mt-1.5">You may be offline, or Ollie was just updated. Your data is safe on this device.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-on-brand font-bold text-[14px] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <RotateCcw className="w-4 h-4" /> Reload
        </button>
      </div>
    )
  }
}
