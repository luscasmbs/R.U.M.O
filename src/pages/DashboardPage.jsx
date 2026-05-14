import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "../api/client";
import { MetricCards } from "../components/dashboard/MetricCards";
import { RiskChart } from "../components/dashboard/RiskChart";
import { RiskMap } from "../components/dashboard/RiskMap";
import { EmptyState } from "../components/common/EmptyState";
import { Skeleton } from "../components/common/Skeleton";
import { useDashboard } from "../hooks/useDashboard";

export function DashboardPage() {
  const [module, setModule] = useState("epidemiology");
  const [windowDays, setWindowDays] = useState(7);
  const { data, isLoading, error, refetch, isFetching } = useDashboard({ module, window_days: windowDays });
  const chartData = useMemo(() => data?.top_neighborhoods || [], [data]);

  async function runRefresh() {
    await api.post("/ingestion/run", { sources: ["recife_ckan"] });
    await refetch();
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Operação Recife</span>
          <h1>Dashboard de risco territorial</h1>
          <p>Dados públicos reais, previsões versionadas e alertas auditáveis por bairro.</p>
        </div>
        <div className="toolbar">
          <select value={module} onChange={(e) => setModule(e.target.value)}>
            <option value="epidemiology">Epidemiologia</option>
            <option value="flood">Alagamentos</option>
            <option value="landslide">Deslizamentos</option>
            <option value="security">Segurança</option>
          </select>
          <select value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))}>
            <option value={1}>24h</option>
            <option value={7}>7 dias</option>
            <option value={28}>4 semanas</option>
          </select>
          <button className="icon-text-button solid" onClick={runRefresh} disabled={isFetching}>
            <RefreshCw size={18} />
            Atualizar dados
          </button>
        </div>
      </header>

      {isLoading && <Skeleton rows={5} />}
      {error && <EmptyState title="Falha ao carregar dashboard" description={error.response?.data?.detail || error.message} />}
      {data && (
        <>
          <MetricCards metrics={data.metrics} />
          <section className="dashboard-grid">
            <article className="surface-card map-card">
              <div className="card-header">
                <h2>Mapa de risco</h2>
                <span>Malha territorial real quando a ingestão geográfica estiver carregada</span>
              </div>
              <RiskMap geojson={data.geojson} />
            </article>
            <article className="surface-card">
              <div className="card-header">
                <h2>Bairros prioritários</h2>
                <span>Ordenados por score previsto</span>
              </div>
              <RiskChart data={chartData} />
            </article>
          </section>

          <section className="surface-card">
            <div className="card-header">
              <h2>Alertas ativos</h2>
              <span>Gerados a partir de previsões e limiares configuráveis</span>
            </div>
            {!data.alerts?.length ? (
              <EmptyState title="Nenhum alerta ativo" description="Quando houver previsão acima do limiar, os alertas aparecerão aqui." />
            ) : (
              <div className="alert-list">
                {data.alerts.map((alert) => (
                  <article key={alert.id} className="alert-row">
                    <strong>{alert.title}</strong>
                    <span>{alert.severity} · {alert.neighborhood_name || "Recife"}</span>
                    <p>{alert.description}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
