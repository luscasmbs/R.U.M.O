import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, FileBarChart, FileText, Printer, ShieldCheck } from "lucide-react";
import { getDemoDashboard, demoSources } from "../data/demoData";
import { getCategoryLabel, moduleConfigs, modules } from "../config/dashboardModules";
import { useDashboard, useDataSources } from "../hooks/useDashboard";

const reportTypes = [
  ["executive", "Boletim executivo", "Síntese dos principais indicadores, alertas e tendências."],
  ["territorial", "Relatório territorial", "Ranking de bairros, mapa de risco e prioridades de campo."],
  ["governance", "Fontes e governança", "Cobertura, atualização e rastreabilidade das fontes públicas."],
  ["model", "Relatório do modelo", "Versão, qualidade, explicabilidade e histórico das previsões."],
];

function operationalData(data) {
  return Boolean(data?.metrics && (data.metrics.neighborhoods > 0 || data.metrics.forecasts > 0 || data.metrics.incidents > 0));
}

export function ReportsPage() {
  const [searchParams] = useSearchParams();
  const [type, setType] = useState("executive");
  const [module, setModule] = useState(searchParams.get("module") || "epidemiology");
  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [municipality, setMunicipality] = useState(searchParams.get("municipality_code") || "2611606");
  const [period, setPeriod] = useState(searchParams.get("period_days") || "90");
  const [windowDays, setWindowDays] = useState(Number(searchParams.get("window_days") || 7));
  const dashboardQuery = useDashboard({ module, category, window_days: windowDays, municipality_code: municipality, period_days: Number(period) });
  const sourcesQuery = useDataSources();
  const dashboard = operationalData(dashboardQuery.data) ? dashboardQuery.data : getDemoDashboard(module, category, windowDays);
  const sources = useMemo(() => {
    const live = sourcesQuery.data || [];
    return demoSources.map((catalog) => live.find((source) => source.name === catalog.name) || catalog);
  }, [sourcesQuery.data]);
  const selected = reportTypes.find(([value]) => value === type) || reportTypes[0];
  const report = {
    title: selected[1],
    generated_at: new Date().toISOString(),
    scope: `${municipality === "2611606" ? "Recife/PE" : municipality} · ${moduleConfigs[module]?.label || module} · ${getCategoryLabel(module, category)} · últimos ${period} dias · horizonte de ${windowDays} dias`,
    metrics: dashboard.metrics,
    model: dashboard.model,
    alerts: dashboard.alerts,
    top_neighborhoods: dashboard.top_neighborhoods,
    time_series: dashboard.time_series,
    sources,
  };

  function downloadReport(format) {
    const content = format === "csv"
      ? ["bairro,score,probabilidade,ocorrencias", ...dashboard.top_neighborhoods.map((item) => `${item.label},${item.risk_score},${item.probability},${item.incident_count || 0}`)].join("\n")
      : JSON.stringify(report, null, 2);
    const blob = new Blob([content], { type: format === "csv" ? "text/csv;charset=utf-8" : "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rumo-${type}-${new Date().toISOString().slice(0, 10)}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-stack reports-page">
      <header className="page-header"><div><span className="eyebrow">Prestação de informação · Recife</span><h1>Relatórios e boletins</h1><p>Transforme os dados monitorados em uma síntese pronta para reunião, decisão operacional ou prestação de contas.</p></div><span className="demo-badge">Exportação disponível</span></header>
      <section className="control-bar report-filters" aria-label="Escopo do relatório"><div className="control-group"><label htmlFor="report-municipality">Município</label><select id="report-municipality" value={municipality} onChange={(event) => setMunicipality(event.target.value)}><option value="2611606">Recife/PE</option></select></div><div className="control-group"><label htmlFor="report-module">Módulo</label><select id="report-module" value={module} onChange={(event) => { const next = event.target.value; setModule(next); setCategory(moduleConfigs[next].categories[0][0]); }}>{modules.map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}</select></div><div className="control-group"><label htmlFor="report-category">Categoria</label><select id="report-category" value={category} onChange={(event) => setCategory(event.target.value)}>{moduleConfigs[module].categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="control-group"><label htmlFor="report-period">Período</label><select id="report-period" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="365">Último ano</option><option value="1825">Últimos 5 anos</option></select></div><div className="control-group"><label htmlFor="report-horizon">Horizonte</label><select id="report-horizon" value={windowDays} onChange={(event) => setWindowDays(Number(event.target.value))}><option value={1}>24 horas</option><option value={7}>7 dias</option><option value={28}>4 semanas</option></select></div></section>
      <section className="report-toolbar"><div className="report-selector">{reportTypes.map(([value, label, description]) => <button key={value} className={type === value ? "selected" : ""} onClick={() => setType(value)}><FileText size={17} /><span><strong>{label}</strong><small>{description}</small></span></button>)}</div><div className="report-actions"><button className="icon-text-button" onClick={() => downloadReport("json")}><Download size={16} /> JSON</button><button className="icon-text-button" onClick={() => downloadReport("csv")}><FileBarChart size={16} /> CSV</button><button className="icon-text-button solid" onClick={() => window.print()}><Printer size={16} /> Imprimir / PDF</button></div></section>
      <article className="report-sheet" id="report-sheet">
        <header className="report-sheet-header"><div><span className="section-kicker">R.U.M.O · relatório institucional</span><h2>{selected[1]}</h2><p>{report.scope}</p></div><div className="report-mark"><strong>R</strong><span>R.U.M.O</span></div></header>
        <div className="report-meta"><span>Gerado em {new Date(report.generated_at).toLocaleString("pt-BR")}</span><span><ShieldCheck size={14} /> Contrato de dados 2026-01</span><span>{operationalData(dashboardQuery.data) ? "Dados reais persistidos" : "Dados demonstrativos sinalizados"}</span></div>
        <section className="report-kpis">{[["Bairros monitorados", dashboard.metrics.neighborhoods], ["Ocorrências", dashboard.metrics.incidents], ["Alertas ativos", dashboard.metrics.active_alerts], ["Risco médio", `${dashboard.metrics.average_risk}/100`], ["Fontes catalogadas", sources.length]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>
        <section className="report-content-grid"><div><h3>Leitura executiva</h3><p>O painel integra território, registros históricos, fontes meteorológicas e previsões para orientar prioridades de prevenção e resposta. O risco é uma medida de priorização relativa e deve ser analisado junto da confiança do modelo e da qualidade da fonte.</p><h3>Principais prioridades territoriais</h3><ol className="report-ranking">{dashboard.top_neighborhoods.slice(0, 5).map((item) => <li key={item.id || item.label}><span>{item.label}</span><strong>{Math.round(item.risk_score)}/100</strong><small>{Math.round((item.probability || 0) * 100)}% de probabilidade · {item.incident_count || 0} ocorrências</small></li>)}</ol></div><aside><h3>Modelo e evidências</h3><div className="report-model"><strong>{dashboard.model?.version || "Aguardando treinamento"}</strong><span>AUC {dashboard.model?.validation_metrics?.auc ? `${Math.round(dashboard.model.validation_metrics.auc * 100)}%` : "—"}</span><span>F1-score {dashboard.model?.validation_metrics?.f1 ? `${Math.round(dashboard.model.validation_metrics.f1 * 100)}%` : "—"}</span></div><h3>Alertas ativos</h3><p>{dashboard.alerts?.length ? `${dashboard.alerts.length} alerta(s) requerem atenção operacional.` : "Nenhum alerta ativo no período."}</p></aside></section>
        <footer className="report-sheet-footer"><span>R.U.M.O · Rede Unificada de Monitoramento de Ocorrências</span><span>Fontes: {sources.map((source) => source.name).join(" · ")}</span></footer>
      </article>
    </div>
  );
}
