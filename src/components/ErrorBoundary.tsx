import { Component, type ReactNode } from "react";

/** Évite la page blanche : si un écran plante, on affiche un message et un bouton pour continuer. */
export default class ErrorBoundary extends Component<{ children: ReactNode; onReset?: () => void; label?: string }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { console.error("ErrorBoundary", err); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="fixed inset-0 z-[200] grid place-items-center bg-background p-6 text-center">
        <div className="max-w-sm space-y-3">
          <h2 className="text-lg font-semibold">{this.props.label ?? "Un problème est survenu"}</h2>
          <p className="text-sm text-muted-foreground">{this.state.err.message}</p>
          <div className="flex justify-center gap-2">
            <button className="rounded-md border px-3 py-2 text-sm" onClick={() => { this.setState({ err: null }); this.props.onReset?.(); }}>Revenir</button>
            <button className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={() => location.reload()}>Recharger la page</button>
          </div>
        </div>
      </div>
    );
  }
}
