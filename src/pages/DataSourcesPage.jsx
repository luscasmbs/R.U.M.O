import { Database, WifiOff } from "lucide-react";
import { EmptyState } from "../components/common/EmptyState";
import { Skeleton } from "../components/common/Skeleton";
import { useDataSources } from "../hooks/useDashboard";

export function DataSourcesPage() {
  const { data, isLoading, error } = useDataSources();

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Integrações</span>
          <h1>Fontes públicas conectadas</h1>
          <p>Status, periodicidade e rastreabilidade dos conectores oficiais.</p>
        </div>
      </header>
      {isLoading && <Skeleton rows={4} />}
      {error && <EmptyState title="Erro ao consultar fontes" description={error.message} />}
      {data?.length === 0 && <EmptyState title="Nenhuma fonte registrada" description="Execute a ingestão inicial para registrar as fontes de dados." />}
      <section className="source-grid">
        {data?.map((source) => (
          <article className="source-card" key={source.id}>
            <div className="source-icon">{source.status === "active" ? <Database size={20} /> : <WifiOff size={20} />}</div>
            <div>
              <strong>{source.name}</strong>
              <span>{source.kind} · {source.status}</span>
              <p>{source.base_url}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
