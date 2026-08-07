import { Component } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

export class RuntimeErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, details) {
    console.error("Falha ao renderizar a aplicação", error, details);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="runtime-error" role="alert">
        <TriangleAlert size={28} />
        <h1>Não foi possível carregar esta tela</h1>
        <p>A aplicação encontrou uma versão incompleta dos arquivos. Recarregue para continuar.</p>
        {import.meta.env.DEV && <code className="runtime-error-detail">{this.state.error.message}</code>}
        <button className="primary-button" onClick={() => window.location.reload()}>
          <RefreshCw size={17} /> Recarregar
        </button>
      </main>
    );
  }
}
