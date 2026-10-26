import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  label?: string
}

type State = {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="grid min-h-dvh place-items-center bg-canvas p-6 text-ink">
        <section role="alert" className="w-full max-w-lg rounded-[28px] border border-line bg-surface p-7 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">StudyFlow</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">A apărut o eroare neașteptată</h1>
          <p className="mt-3 text-sm leading-6 text-ink-soft">
            {this.props.label
              ? `Secțiunea „${this.props.label}” nu a putut fi afișată. Datele tale salvate nu au fost modificate.`
              : 'Aplicația nu a putut porni. Datele tale salvate nu au fost modificate.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"
            >
              Reîncearcă
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold hover:bg-surface-hover"
            >
              Reîncarcă pagina
            </button>
          </div>
        </section>
      </main>
    )
  }
}
