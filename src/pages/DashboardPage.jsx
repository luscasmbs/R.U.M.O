import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, RefreshCw, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { api, getApiErrorMessage, getStoredUser } from "../api/client";
import { CategoryChart, TrendChart } from "../components/dashboard/InsightCharts";
import { ModelSummary } from "../components/dashboard/ModelSummary";
import { MetricCards } from "../components/dashboard/MetricCards";
import { RiskChart } from "../components/dashboard/RiskChart";
import { RiskMap } from "../components/dashboard/RiskMap";
import { EmptyState } from "../components/common/EmptyState";
import { Skeleton } from "../components/common/Skeleton";
import { getDemoDashboard } from "../data/demoData";
import { moduleConfigs, modules } from "../config/dashboardModules";
import { useDashboard, useNeighborhoodGeoJSON } from "../hooks/useDashboard";

function mergeRiskWithGeometry(geometry, riskGeoJSON) {
  if (!geometry?.features?.length) return riskGeoJSON;
  const riskById = new Map((riskGeoJSON?.features || []).map((feature) => [feature.id, feature.properties]));
  return {
    type: "FeatureCollection",
    features: geometry.features.map((feature) => ({
      ...feature,
      properties: { ...feature.properties, ...(riskById.get(feature.id) || {}) },
    })),
  };
}

export function DashboardPage() {
  const [module, setModule] = useState("epidemiology");
  const [category, setCategory] = useState("all");
  const [municipality, setMunicipality] = useState("2611606");
  const [windowDays, setWindowDays] = useState(7);
  const [period, setPeriod] = useState("365");
  const [notice, setNotice] = useState("");
  const user = getStoredUser();
  const canManage = ["admin", "analyst"].includes(user?.role);
  const query = useDashboard({ module, category, window_days: windowDays, municipality_code: municipality, period_days: Number(period) });
  const geometryQuery = useNeighborhoodGeoJSON(municipality);
  const hasLiveData = Boolean(query.data?.metrics && (
    query.data.metrics.neighborhoods > 0
    || query.data.metrics.forecasts > 0
    || query.data.metrics.incidents > 0
  ));
  const view = hasLiveData ? query.data : getDemoDashboard(module, category, windowDays);
  const isDemo = !hasLiveData;
  const mapGeoJSON = useMemo(
    () => (isDemo ? view.geojson : mergeRiskWithGeometry(geometryQuery.data, view.geojson)),
    [geometryQuery.data, isDemo, view.geojson],
  );

  async function runRefresh() {
    setNotice("");
    try {
      await api.post("/ingestion/run", { sources: ["recife_ckan", "inmet"] }, { timeout: 180_000 });
      await query.refetch();
      setNotice("Dados atualizados e indicadores recalculados.");
    } catch (error) {
      setNotice(getApiErrorMessage(error, "A atualização real depende da disponibilidade das fontes públicas."));
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header dashboard-heading">
        <div>
          <span className="eyebrow">Centro de inteligência territorial · Recife</span>
          <h1>Painel de situação urbana</h1>
          <p>Uma leitura integrada de ocorrências, território, clima e risco projetado para orientar a ação pública.</p>
        </div>
        <div className="header-status"><span className="status-dot" /> Atualizado em {new Date(view.generated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
      </header>

      <section className="control-bar" aria-label="Filtros do painel">
        <div className="control-group"><label htmlFor="municipality">Município</label><select id="municipality" value={municipality} onChange={(event) => setMunicipality(event.target.value)}><option value="2611606">Recife/PE</option></select></div>
        <div className="control-group"><label htmlFor="module">Módulo</label><select id="module" value={module} onChange={(event) => { const nextModule = event.target.value; setModule(nextModule); setCategory(moduleConfigs[nextModule].categories[0][0]); }}>{modules.map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}</select></div>
        <div className="control-group"><label htmlFor="category">Categoria</label><select id="category" value={category} onChange={(event) => setCategory(event.target.value)}>{moduleConfigs[module].categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="control-group"><label htmlFor="period"><CalendarDays size={14} /> Período</label><select id="period" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="365">Último ano</option><option value="1825">Últimos 5 anos</option></select></div>
        <div className="control-group"><label htmlFor="horizon">Horizonte</label><select id="horizon" value={windowDays} onChange={(event) => setWindowDays(Number(event.target.value))}><option value={1}>24 horas</option><option value={7}>7 dias</option><option value={28}>4 semanas</option></select></div>
        <div className="control-spacer" />
        {isDemo && <span className="demo-badge">Modo demonstração · contrato real</span>}
        {user && <Link className="icon-text-button" to={`/relatorios?module=${module}&category=${category}&municipality_code=${municipality}&period_days=${period}&window_days=${windowDays}`}>Relatórios</Link>}
        {canManage && <button className="icon-text-button solid" onClick={runRefresh} disabled={query.isFetching}><RefreshCw size={17} className={query.isFetching ? "spin" : ""} /> Atualizar dados</button>}
      </section>
      {notice && <div className="inline-notice"><ShieldAlert size={17} /> {notice}</div>}

      {query.isLoading && <Skeleton rows={5} />}
      {query.error && !isDemo && <EmptyState title="Falha ao carregar o painel" description={getApiErrorMessage(query.error)} />}

      <MetricCards metrics={view.metrics} />

      <section className="dashboard-grid main-insight-grid">
        <article className="surface-card map-card">
          <div className="card-header"><div><span className="section-kicker">Território</span><h2>Mapa de risco por bairro</h2></div><span>Camadas monitoradas · {view.metrics.neighborhoods} bairros</span></div>
          <RiskMap geojson={mapGeoJSON} />
        </article>
        <article className="surface-card">
          <div className="card-header"><div><span className="section-kicker">Priorização</span><h2>Onde agir primeiro</h2></div><span>Score previsto · 0 a 100</span></div>
          <RiskChart data={view.top_neighborhoods} />
          <p className="chart-footnote">O score combina histórico de notificações, variáveis ambientais e padrão territorial. Ele orienta priorização; não substitui decisão técnica.</p>
        </article>
      </section>

      <section className="three-column-grid">
        <article className="surface-card chart-card"><div className="card-header"><div><span className="section-kicker">Tendência</span><h2>Ocorrências ao longo do tempo</h2></div><span>Semanal</span></div><TrendChart data={view.time_series} /></article>
        <article className="surface-card chart-card"><div className="card-header"><div><span className="section-kicker">Composição</span><h2>Perfil das ocorrências</h2></div><span>Período selecionado</span></div><CategoryChart data={view.category_breakdown} /></article>
        <article className="surface-card"><div className="card-header"><div><span className="section-kicker">Governança</span><h2>{user ? "Modelo em produção" : "Como interpretar"}</h2></div><span>{user ? "Rastreabilidade" : "Uso responsável"}</span></div>{user ? <ModelSummary model={view.model} /> : <div className="governance-card"><p>O mapa mostra prioridades relativas entre os territórios. Confirme os sinais com as equipes responsáveis antes de tomar uma decisão operacional.</p><Link className="icon-text-button" to="/login">Ver estatísticas profissionais</Link></div>}</article>
      </section>

      <section className="surface-card alert-panel">
        <div className="card-header"><div><span className="section-kicker">Resposta orientada por evidências</span><h2>Alertas que pedem atenção</h2></div><span>{view.metrics.active_alerts} prioridades ativas</span></div>
        {!view.alerts?.length ? <EmptyState title="Nenhum alerta ativo" description="Quando a previsão superar o limiar configurado, a recomendação aparecerá aqui." /> : <div className="alert-list">{view.alerts.map((alert) => <article key={alert.id} className={`alert-row severity-${alert.severity}`}><div className="alert-title"><div className="alert-icon"><AlertTriangle size={17} /></div><div><strong>{alert.title}</strong><span>{alert.neighborhood_name || "Recife"} · {new Date(alert.created_at).toLocaleDateString("pt-BR")}</span></div><b>{alert.severity === "critical" ? "Crítico" : alert.severity === "high" ? "Alto" : "Atenção"}</b></div><p>{alert.description}</p>{alert.recommended_actions?.immediate?.length > 0 && <div className="action-tags">{alert.recommended_actions.immediate.map((action) => <span key={action}>{action}</span>)}</div>}</article>)}</div>}
      </section>

      <footer className="data-disclaimer"><span><ShieldAlert size={15} /> {isDemo ? "Os números exibidos são dados demonstrativos com o mesmo contrato das fontes reais." : "Dados carregados das integrações registradas e previsões persistidas."}</span><span>Período: últimos {period} dias · município: {municipality === "2611606" ? "Recife/PE" : municipality}</span></footer>
    </div>
  );
}
