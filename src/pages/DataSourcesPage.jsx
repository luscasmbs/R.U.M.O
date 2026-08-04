import { Database, ExternalLink, RadioTower, ShieldCheck, WifiOff } from "lucide-react";
import { EmptyState } from "../components/common/EmptyState";
import { Skeleton } from "../components/common/Skeleton";
import { demoSources } from "../data/demoData";
import { useDataSources } from "../hooks/useDashboard";

const statusLabels = { active: "Ativa", ready: "Pronta para conectar", monitoring: "Monitoramento parcial", error: "Com erro" };

export function DataSourcesPage() {
  const query = useDataSources();
  const liveSources = query.data || [];
  const sources = [
    ...demoSources.map((catalog) => liveSources.find((source) => source.name === catalog.name) || catalog),
    ...liveSources.filter((source) => !demoSources.some((catalog) => catalog.name === source.name)),
  ];
  const isDemo = !query.data?.length;
  return (
    <div className="page-stack">
      <header className="page-header"><div><span className="eyebrow">Ecossistema de dados</span><h1>Fontes públicas conectadas</h1><p>Rastreabilidade, cobertura e prontidão das bases que alimentam indicadores, mapas e previsões.</p></div>{isDemo && <span className="demo-badge">Catálogo demonstrativo</span>}</header>
      <section className="source-overview"><div><strong>{sources.length}</strong><span>fontes catalogadas</span></div><div><strong>{sources.filter((source) => ["active", "ready"].includes(source.status)).length}</strong><span>com integração preparada</span></div><div><strong>5 anos</strong><span>horizonte mínimo do TCC</span></div><div><strong>2026-01</strong><span>contrato de dados</span></div></section>
      {query.isLoading && <Skeleton rows={4} />}
      {query.error && !isDemo && <EmptyState title="Erro ao consultar fontes" description={query.error.message} />}
      <section className="source-grid">{sources.map((source) => <article className="source-card source-card-rich" key={source.id}><div className={`source-icon source-${source.status}`}>{source.status === "error" ? <WifiOff size={20} /> : source.status === "active" ? <Database size={20} /> : <RadioTower size={20} />}</div><div className="source-content"><div className="source-heading"><strong>{source.name}</strong><span className={`status-label status-${source.status}`}>{statusLabels[source.status] || source.status}</span></div><span>{source.kind} · atualização {source.refresh_frequency || "não informada"}</span><p>{source.coverage || source.base_url}</p><div className="source-meta"><span>{source.records ? `${Number(source.records).toLocaleString("pt-BR")} registros` : "Aguardando primeira carga"}</span><a href={source.base_url?.startsWith("http") ? source.base_url : `https://${source.base_url}`} target="_blank" rel="noreferrer" aria-label={`Abrir ${source.name}`}><ExternalLink size={14} /></a></div><div className="source-quality"><ShieldCheck size={14} /> {source.metadata?.quality || "qualidade monitorada"}</div></div></article>)}</section>
      <section className="surface-card source-note"><ShieldCheck size={18} /><div><strong>Rastreabilidade de ponta a ponta</strong><p>Cada conector registra horário da última execução, erro, periodicidade, contrato esperado e metadados da carga. DATASUS e APAC permanecem preparados para ingestão produtiva assim que o transporte oficial estiver configurado.</p></div></section>
    </div>
  );
}
