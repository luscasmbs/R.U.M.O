import { useMemo, useState } from "react";
import { BrainCircuit, ChevronRight, Info, ShieldCheck } from "lucide-react";
import { getApiErrorMessage } from "../api/client";
import { ModelSummary } from "../components/dashboard/ModelSummary";
import { demoDashboard, demoForecasts } from "../data/demoData";
import { moduleConfigs } from "../config/dashboardModules";
import { getModelFeatureLabel } from "../config/modelFeatures";
import { useForecasts } from "../hooks/useDashboard";

function horizonLabel(days) {
  if (days === 1) return "Próximas 24 horas";
  if (days === 28) return "Próximas 4 semanas";
  return `Próximos ${days} dias`;
}

function ForecastDetail({ item }) {
  const importance = Object.entries(item.explanation?.feature_importance || {}).sort(([, a], [, b]) => b - a);
  const probability = item.probability === null || item.probability === undefined ? null : Math.round(item.probability * 100);
  return (
    <aside className="forecast-detail">
      <div className="detail-heading"><span className="section-kicker">Explicabilidade</span><h2>{item.neighborhood_name}</h2><span>Previsão para {new Date(`${item.target_date}T12:00:00`).toLocaleDateString("pt-BR")}</span></div>
      <div className="risk-score-large"><strong>{Math.round(item.risk_score)}</strong><span>/ 100<br />score de prioridade</span></div>
      <div className="probability-bar"><span style={{ width: `${probability || 0}%` }} /></div>
      <div className="probability-label"><span>Probabilidade de superar o limiar histórico</span><strong>{probability === null ? "Não estimada" : `${probability}%`}</strong></div>
      <div className="detail-section"><span className="detail-label">Fatores que mais influenciaram</span>{importance.length ? importance.map(([label, value]) => <div className="factor-row" key={label}><span>{getModelFeatureLabel(label)}</span><div><i style={{ width: `${Math.round(value * 100)}%` }} /></div><strong>{Math.round(value * 100)}%</strong></div>) : <p className="muted">Sem explicação detalhada registrada.</p>}</div>
      <div className="detail-meta"><span><Info size={15} /> Confiança {Math.round((item.confidence || 0) * 100)}%</span><span><BrainCircuit size={15} /> {item.model_version}</span><span>Base até {item.explanation?.training_history?.data_end ? new Date(`${item.explanation.training_history.data_end}T12:00:00`).toLocaleDateString("pt-BR") : "data não registrada"}</span></div>
    </aside>
  );
}

export function ForecastsPage() {
  const [disease, setDisease] = useState("all");
  const [horizonDays, setHorizonDays] = useState(7);
  const query = useForecasts({
    module: "epidemiology",
    municipality_code: "2611606",
    horizon_days: horizonDays,
    disease,
  });
  const demoItems = demoForecasts.map((item) => {
    const horizonFactor = horizonDays / 7;
    const diseaseFactor = disease === "influenza" ? 0.86 : 1;
    return {
      ...item,
      id: `${item.id}-${horizonDays}-${disease}`,
      horizon_days: horizonDays,
      risk_score: Math.min(100, Math.round(item.risk_score * Math.min(1.25, Math.max(0.65, horizonFactor)) * diseaseFactor)),
      probability: Math.min(1, item.probability * Math.min(1.2, Math.max(0.7, horizonFactor)) * diseaseFactor),
      predicted_value: (item.predicted_value || 1) * horizonFactor,
      model_version: `${disease === "influenza" ? "influenza" : "epidemiology"}-demo-rf-20260804`,
      explanation: { ...item.explanation, target_disease: disease, horizon_days: horizonDays },
    };
  });
  const items = query.data?.items?.length ? query.data.items : demoItems;
  const isDemo = !query.data?.items?.length;
  const [selectedId, setSelectedId] = useState(items[0]?.id);
  const selected = useMemo(() => items.find((item) => item.id === selectedId) || items[0], [items, selectedId]);
  const uniqueItems = items.filter((item, index, all) => all.findIndex((candidate) => candidate.neighborhood_name === item.neighborhood_name) === index).slice(0, 10);
  const model = selected ? {
    version: selected.model_version,
    validation_metrics: selected.explanation?.validation_metrics || demoDashboard.model.validation_metrics,
  } : demoDashboard.model;

  return (
    <div className="page-stack">
      <header className="page-header"><div><span className="eyebrow">Modelagem preditiva</span><h1>Previsões e explicabilidade</h1><p>Probabilidade de excedência, carga esperada, score de prioridade e fatores observados por território.</p></div>{isDemo && <span className="demo-badge">Modo demonstração · contrato real</span>}</header>
      {query.error && <div className="inline-notice"><Info size={17} /> {getApiErrorMessage(query.error, "A API de previsões ainda não está disponível; exibindo o contrato demonstrativo.")}</div>}
      <section className="forecast-hero"><div className="forecast-hero-copy"><div className="hero-icon"><BrainCircuit size={24} /></div><div><span className="section-kicker">Horizonte de previsão</span><h2>{horizonLabel(horizonDays)}</h2><p>O modelo usa painel diário contínuo, histórico de cinco anos, sazonalidade e validação temporal. O piso de qualidade exige pelo menos 365 dias de dados.</p></div></div><div className="hero-stat"><strong>{uniqueItems.filter((item) => item.risk_score >= 65).length}</strong><span>territórios<br />em alto risco</span></div><div className="hero-stat"><strong>{Math.round((selected?.confidence || 0) * 100)}%</strong><span>confiança<br />da previsão</span></div></section>
      <section className="control-bar forecast-filters"><div className="control-group"><label htmlFor="forecast-disease">Alvo epidemiológico</label><select id="forecast-disease" value={disease} onChange={(event) => setDisease(event.target.value)}>{moduleConfigs.epidemiology.categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="control-group"><label htmlFor="forecast-horizon">Horizonte</label><select id="forecast-horizon" value={horizonDays} onChange={(event) => setHorizonDays(Number(event.target.value))}><option value={1}>24 horas</option><option value={7}>7 dias</option><option value={28}>4 semanas</option></select></div><div className="control-spacer" /><span className="data-disclaimer"><ShieldCheck size={15} /> Cada horizonte possui alvo e validação independentes</span></section>
      <section className="forecast-layout">
        <article className="surface-card"><div className="card-header"><div><span className="section-kicker">Ranking territorial</span><h2>Previsões recentes</h2></div><span>{uniqueItems.length} bairros exibidos</span></div><div className="forecast-table">{uniqueItems.map((item) => <button key={item.id} className={`forecast-row ${selected?.neighborhood_name === item.neighborhood_name ? "selected" : ""}`} onClick={() => setSelectedId(item.id)}><span className={`risk-pip ${item.risk_score >= 65 ? "critical" : item.risk_score >= 40 ? "medium" : "low"}`} /><span className="forecast-place"><strong>{item.neighborhood_name}</strong><small>Atualizado em {new Date(item.created_at).toLocaleDateString("pt-BR")}</small></span><span className="forecast-probability"><strong>{item.probability === null || item.probability === undefined ? "—" : `${Math.round(item.probability * 100)}%`}</strong><small>probabilidade</small></span><span className="forecast-score">{Math.round(item.risk_score)}<small>/100</small></span><ChevronRight size={17} /></button>)}</div></article>
        {selected && <ForecastDetail item={selected} />}
      </section>
      <section className="three-column-grid"><article className="surface-card"><div className="card-header"><div><span className="section-kicker">Avaliação</span><h2>Qualidade do modelo</h2></div><span>Validação temporal</span></div><ModelSummary model={model} /></article><article className="surface-card governance-card"><div className="card-header"><div><span className="section-kicker">Governança</span><h2>Como interpretar</h2></div></div><p>Probabilidade, score e confiança são medidas diferentes. O score combina chance de excedência e carga prevista para ordenar territórios; a decisão final continua sob responsabilidade técnica.</p><div className="audit-note"><ShieldCheck size={16} /> Versão, janela histórica, variáveis, limiar e métricas ficam vinculados à previsão.</div></article><article className="surface-card governance-card"><div className="card-header"><div><span className="section-kicker">Base temporal</span><h2>Histórico mínimo</h2></div></div><p>O treinamento usa até cinco anos de registros, preservando dias sem ocorrência. Se houver menos de 365 dias, o sistema bloqueia o treino supervisionado e sinaliza uma linha de base.</p><div className="source-status"><span className="status-dot" /> Critério de qualidade ativo</div></article></section>
    </div>
  );
}
