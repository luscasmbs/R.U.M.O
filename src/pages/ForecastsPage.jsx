import { useMemo, useState } from "react";
import { BrainCircuit, ChevronRight, Info, ShieldCheck } from "lucide-react";
import { getApiErrorMessage } from "../api/client";
import { EmptyState } from "../components/common/EmptyState";
import { ModelSummary } from "../components/dashboard/ModelSummary";
import { demoDashboard, demoForecasts } from "../data/demoData";
import { moduleConfigs } from "../config/dashboardModules";
import { useForecasts } from "../hooks/useDashboard";

function ForecastDetail({ item }) {
  const importance = Object.entries(item.explanation?.feature_importance || {}).sort(([, a], [, b]) => b - a);
  return (
    <aside className="forecast-detail">
      <div className="detail-heading"><span className="section-kicker">Explicabilidade</span><h2>{item.neighborhood_name}</h2><span>Previsão para {new Date(item.target_date).toLocaleDateString("pt-BR")}</span></div>
      <div className="risk-score-large"><strong>{Math.round(item.risk_score)}</strong><span>/ 100<br />score de risco</span></div>
      <div className="probability-bar"><span style={{ width: `${Math.round(item.probability * 100)}%` }} /></div>
      <div className="probability-label"><span>Probabilidade estimada</span><strong>{Math.round(item.probability * 100)}%</strong></div>
      <div className="detail-section"><span className="detail-label">Fatores que mais influenciaram</span>{importance.length ? importance.map(([label, value]) => <div className="factor-row" key={label}><span>{label.replaceAll("_", " ")}</span><div><i style={{ width: `${Math.round(value * 100)}%` }} /></div><strong>{Math.round(value * 100)}%</strong></div>) : <p className="muted">Sem explicação detalhada registrada.</p>}</div>
      <div className="detail-meta"><span><Info size={15} /> Confiança {Math.round((item.confidence || 0) * 100)}%</span><span><BrainCircuit size={15} /> {item.model_version}</span></div>
    </aside>
  );
}

export function ForecastsPage() {
  const [disease, setDisease] = useState("all");
  const query = useForecasts({ module: "epidemiology", municipality_code: "2611606", disease: disease === "all" ? undefined : disease });
  const items = query.data?.items?.length ? query.data.items : demoForecasts.map((item) => disease === "influenza" ? { ...item, risk_score: Math.min(100, Math.round(item.risk_score * 0.86)), probability: Math.min(1, item.probability * 0.86), model_version: "influenza-demo-rf-20260804", explanation: { ...item.explanation, target_disease: "influenza" } } : item);
  const isDemo = !query.data?.items?.length;
  const [selectedId, setSelectedId] = useState(items[0]?.id);
  const selected = useMemo(() => items.find((item) => item.id === selectedId) || items[0], [items, selectedId]);
  const uniqueItems = items.filter((item, index, all) => all.findIndex((candidate) => candidate.neighborhood_name === item.neighborhood_name) === index).slice(0, 10);
  const model = selected ? { version: selected.model_version, validation_metrics: selected.explanation?.validation_metrics || demoDashboard.model.validation_metrics } : demoDashboard.model;

  return (
    <div className="page-stack">
      <header className="page-header"><div><span className="eyebrow">Modelagem preditiva</span><h1>Previsões e explicabilidade</h1><p>Visualize a probabilidade estimada, os fatores contribuintes e a evolução das previsões por território.</p></div>{isDemo && <span className="demo-badge">Modo demonstração · contrato real</span>}</header>
      {query.error && <div className="inline-notice"><Info size={17} /> {getApiErrorMessage(query.error, "A API de previsões ainda não está disponível; exibindo o contrato demonstrativo.")}</div>}
      <section className="forecast-hero"><div className="forecast-hero-copy"><div className="hero-icon"><BrainCircuit size={24} /></div><div><span className="section-kicker">Horizonte de previsão</span><h2>Próximos 7 dias</h2><p>O modelo combina séries históricas e atributos territoriais para apoiar a priorização operacional em Recife.</p></div></div><div className="hero-stat"><strong>{uniqueItems.filter((item) => item.risk_score >= 65).length}</strong><span>territórios<br />em alto risco</span></div><div className="hero-stat"><strong>{Math.round((selected?.confidence || 0) * 100)}%</strong><span>confiança<br />média do modelo</span></div></section>
      <section className="control-bar forecast-filters"><div className="control-group"><label htmlFor="forecast-disease">Alvo epidemiológico</label><select id="forecast-disease" value={disease} onChange={(event) => setDisease(event.target.value)}>{moduleConfigs.epidemiology.categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="control-spacer" /><span className="data-disclaimer"><ShieldCheck size={15} /> Influenza/gripe pode ser treinada como alvo independente</span></section>
      <section className="forecast-layout">
        <article className="surface-card"><div className="card-header"><div><span className="section-kicker">Ranking territorial</span><h2>Previsões recentes</h2></div><span>{uniqueItems.length} bairros exibidos</span></div><div className="forecast-table">{uniqueItems.map((item) => <button key={item.id} className={`forecast-row ${selected?.neighborhood_name === item.neighborhood_name ? "selected" : ""}`} onClick={() => setSelectedId(item.id)}><span className={`risk-pip ${item.risk_score >= 65 ? "critical" : item.risk_score >= 40 ? "medium" : "low"}`} /><span className="forecast-place"><strong>{item.neighborhood_name}</strong><small>Atualizado em {new Date(item.created_at).toLocaleDateString("pt-BR")}</small></span><span className="forecast-probability"><strong>{Math.round(item.probability * 100)}%</strong><small>probabilidade</small></span><span className="forecast-score">{Math.round(item.risk_score)}<small>/100</small></span><ChevronRight size={17} /></button>)}</div></article>
        {selected && <ForecastDetail item={selected} />}
      </section>
      <section className="three-column-grid"><article className="surface-card"><div className="card-header"><div><span className="section-kicker">Avaliação</span><h2>Qualidade do modelo</h2></div><span>Validação histórica</span></div><ModelSummary model={model} /></article><article className="surface-card governance-card"><div className="card-header"><div><span className="section-kicker">Governança</span><h2>Como interpretar</h2></div></div><p>O score é uma medida de priorização relativa entre os territórios monitorados. A probabilidade deve ser lida junto à confiança e à qualidade/atualidade das fontes.</p><div className="audit-note"><ShieldCheck size={16} /> Cada previsão mantém versão do modelo, janela temporal e fatores usados.</div></article><article className="surface-card governance-card"><div className="card-header"><div><span className="section-kicker">Próximo ciclo</span><h2>Histórico operacional</h2></div></div><p>O backend já expõe o histórico persistido por bairro e modelo. A próxima ingestão substitui a demonstração assim que houver dados reais processados.</p><div className="source-status"><span className="status-dot" /> Última execução: hoje, 08:00</div></article></section>
    </div>
  );
}
