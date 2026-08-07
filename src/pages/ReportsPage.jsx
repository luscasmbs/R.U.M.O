import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Database, Download, FileBarChart, FileText, Printer, ShieldCheck } from "lucide-react";
import { getDemoDashboard, demoSources } from "../data/demoData";
import { getCategoryLabel, moduleConfigs, modules } from "../config/dashboardModules";
import { getModelFeatureLabel } from "../config/modelFeatures";
import { useDashboard, useDataSources } from "../hooks/useDashboard";
import { ReportSectionHeading } from "../components/reports/ReportSectionHeading";
import {
  REPORT_TYPES,
  buildActionPlan,
  buildReportLimitations,
  formatPercent,
  formatReportDate,
  hasOperationalData,
  horizonLabel,
  recommendedAction,
  riskLevel,
  serializeTerritorialCsv,
  sourceCoverageLabel,
} from "../utils/reporting";
import "../styles/reports.css";

export function ReportsPage() {
  const [searchParams] = useSearchParams();
  const [type, setType] = useState("executive");
  const [module, setModule] = useState(searchParams.get("module") || "epidemiology");
  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [municipality, setMunicipality] = useState(searchParams.get("municipality_code") || "2611606");
  const [period, setPeriod] = useState(searchParams.get("period_days") || "365");
  const [windowDays, setWindowDays] = useState(Number(searchParams.get("window_days") || 7));
  const dashboardQuery = useDashboard({ module, category, window_days: windowDays, municipality_code: municipality, period_days: Number(period) });
  const sourcesQuery = useDataSources();
  const isLive = hasOperationalData(dashboardQuery.data);
  const dashboard = isLive ? dashboardQuery.data : getDemoDashboard(module, category, windowDays);
  const sources = useMemo(() => {
    const live = sourcesQuery.data || [];
    return demoSources.map((catalog) => live.find((source) => source.name === catalog.name) || catalog);
  }, [sourcesQuery.data]);
  const selected = REPORT_TYPES.find(([value]) => value === type) || REPORT_TYPES[0];
  const [generatedAt] = useState(() => new Date().toISOString());
  const dataQuality = dashboard.data_quality || {};
  const model = dashboard.model || {};
  const history = model.training_history || {};
  const ranking = dashboard.top_neighborhoods || [];
  const topRisk = ranking[0];
  const reportId = `RUMO-${municipality}-${generatedAt.slice(0, 10).replaceAll("-", "")}-${windowDays}D`;
  const scope = `${municipality === "2611606" ? "Recife/PE" : municipality} · ${moduleConfigs[module]?.label || module} · ${getCategoryLabel(module, category)} · últimos ${period} dias · horizonte de ${horizonLabel(windowDays)}`;
  const criticalCount = ranking.filter((item) => item.risk_score >= 80).length;
  const highCount = ranking.filter((item) => item.risk_score >= 65).length;
  const featureImportance = Object.entries(model.feature_importance || {}).sort(([, a], [, b]) => b - a);
  const freshnessDays = model.data_freshness_days;
  const limitations = buildReportLimitations({
    dataQuality,
    freshnessDays,
    hasModel: Boolean(model.version),
  });
  const actionPlan = buildActionPlan({
    dashboard,
    dataQuality,
    highCount,
    topRisk,
    rankingLength: ranking.length,
  });
  const report = {
    report_id: reportId,
    title: selected[1],
    generated_at: generatedAt,
    scope,
    contract_version: dashboard.contract_version,
    metrics: dashboard.metrics,
    data_quality: dataQuality,
    model,
    alerts: dashboard.alerts,
    top_neighborhoods: ranking,
    time_series: dashboard.time_series,
    sources,
    limitations,
    action_plan: actionPlan,
  };

  function downloadReport(format) {
    const content = format === "csv"
      ? serializeTerritorialCsv(ranking)
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
      <header className="page-header"><div><span className="eyebrow">Prestação de informação · Recife</span><h1>Relatórios e boletins</h1><p>Documento técnico-gerencial para decisão, operação, governança e prestação de contas.</p></div><span className="demo-badge">Exportação institucional</span></header>
      <section className="control-bar report-filters" aria-label="Escopo do relatório"><div className="control-group"><label htmlFor="report-municipality">Município</label><select id="report-municipality" value={municipality} onChange={(event) => setMunicipality(event.target.value)}><option value="2611606">Recife/PE</option></select></div><div className="control-group"><label htmlFor="report-module">Módulo</label><select id="report-module" value={module} onChange={(event) => { const next = event.target.value; setModule(next); setCategory(moduleConfigs[next].categories[0][0]); }}>{modules.map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}</select></div><div className="control-group"><label htmlFor="report-category">Categoria</label><select id="report-category" value={category} onChange={(event) => setCategory(event.target.value)}>{moduleConfigs[module].categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="control-group"><label htmlFor="report-period">Período</label><select id="report-period" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="365">Último ano</option><option value="730">Últimos 2 anos</option><option value="1825">Últimos 5 anos</option></select></div><div className="control-group"><label htmlFor="report-horizon">Horizonte</label><select id="report-horizon" value={windowDays} onChange={(event) => setWindowDays(Number(event.target.value))}><option value={1}>24 horas</option><option value={7}>7 dias</option><option value={28}>4 semanas</option></select></div></section>
      <section className="report-toolbar"><div className="report-selector">{REPORT_TYPES.map(([value, label, description]) => <button key={value} className={type === value ? "selected" : ""} onClick={() => setType(value)}><FileText size={17} /><span><strong>{label}</strong><small>{description}</small></span></button>)}</div><div className="report-actions"><button className="icon-text-button" onClick={() => downloadReport("json")}><Download size={16} /> JSON técnico</button><button className="icon-text-button" onClick={() => downloadReport("csv")}><FileBarChart size={16} /> Base territorial</button><button className="icon-text-button solid" onClick={() => window.print()}><Printer size={16} /> Imprimir / PDF</button></div></section>

      <article className="report-sheet" id="report-sheet">
        <header className="report-sheet-header"><div><span className="section-kicker">R.U.M.O · documento técnico-gerencial</span><h2>{selected[1]}</h2><p>{selected[2]}</p></div><div className="report-mark"><strong>R</strong><span>R.U.M.O</span></div></header>
        <dl className="report-control-grid"><div><dt>Identificação</dt><dd>{reportId}</dd></div><div><dt>Escopo</dt><dd>{scope}</dd></div><div><dt>Emissão</dt><dd>{formatReportDate(generatedAt, true)}</dd></div><div><dt>Classificação</dt><dd>Uso técnico-gerencial</dd></div><div><dt>Contrato de dados</dt><dd>{dashboard.contract_version || "2026-02"}</dd></div><div><dt>Situação</dt><dd>{isLive ? "Dados persistidos" : "Demonstração sinalizada"}</dd></div></dl>

        <section className="report-section">
          <ReportSectionHeading number="01" title="Síntese executiva" description="Leitura consolidada para decisão e encaminhamento." />
          <p className="report-lead">No escopo selecionado, foram contabilizadas <strong>{dashboard.metrics.incidents || 0} ocorrências</strong> e <strong>{dashboard.metrics.active_alerts || 0} alertas ativos</strong>. O sistema classifica <strong>{highCount} territórios em risco alto ou crítico</strong>{topRisk ? `, com maior prioridade em ${topRisk.label} (score ${Math.round(topRisk.risk_score)}/100)` : ""}. A tendência recente é de {dashboard.metrics.trend > 0 ? `alta de ${Math.abs(dashboard.metrics.trend)}%` : dashboard.metrics.trend < 0 ? `queda de ${Math.abs(dashboard.metrics.trend)}%` : "estabilidade ou série insuficiente"} frente à semana anterior.</p>
          <div className="report-kpis">{[
            ["Bairros monitorados", dashboard.metrics.neighborhoods],
            ["Com previsão", dataQuality.neighborhoods_with_forecast ?? dashboard.metrics.forecasts],
            ["Risco médio", `${dashboard.metrics.average_risk}/100`],
            ["Alto/crítico", highCount],
            ["Alertas ativos", dashboard.metrics.active_alerts],
            ["Ocorrências", dashboard.metrics.incidents],
          ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value ?? 0}</strong></div>)}</div>
          {(criticalCount > 0 || freshnessDays > 14) && <div className="report-warning"><AlertTriangle size={17} /><span>{criticalCount > 0 ? `${criticalCount} território(s) em nível crítico exigem validação imediata.` : ""} {freshnessDays > 14 ? `Dados do modelo com defasagem de ${freshnessDays} dias.` : ""}</span></div>}
        </section>

        <section className="report-section">
          <ReportSectionHeading number="02" title="Plano de ação recomendado" description="Encaminhamentos propostos; a autoridade responsável deve validar prioridade, capacidade e competência." />
          <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Prazo</th><th>Responsável sugerido</th><th>Providência</th><th>Evidência</th></tr></thead><tbody>{actionPlan.map((item) => <tr key={item.deadline}><td><strong>{item.deadline}</strong></td><td>{item.owner}</td><td>{item.action}</td><td>{item.evidence}</td></tr>)}</tbody></table></div>
        </section>

        <section className="report-section">
          <ReportSectionHeading number="03" title="Prioridades territoriais" description="Ranking comparável por score, probabilidade de excedência, carga prevista e evidência observada." />
          {ranking.length ? <div className="report-table-wrap"><table className="report-table report-priority-table"><thead><tr><th>#</th><th>Território</th><th>Score</th><th>Nível</th><th>Prob.</th><th>Casos previstos</th><th>Confiança</th><th>Ocorrências</th><th>Encaminhamento</th></tr></thead><tbody>{ranking.map((item, index) => <tr key={item.id || item.label}><td>{index + 1}</td><td><strong>{item.label}</strong></td><td>{Math.round(item.risk_score)}/100</td><td><span className={`report-risk risk-${riskLevel(item.risk_score).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}>{riskLevel(item.risk_score)}</span></td><td>{formatPercent(item.probability)}</td><td>{item.predicted_value === null || item.predicted_value === undefined ? "—" : Number(item.predicted_value).toFixed(1)}</td><td>{formatPercent(item.confidence)}</td><td>{item.incident_count || 0}</td><td>{recommendedAction(item.risk_score)}</td></tr>)}</tbody></table></div> : <p className="report-empty">Não há previsão persistida para este horizonte. Execute o treino multihorizonte ou verifique o critério mínimo de qualidade.</p>}
        </section>

        <section className="report-section report-two-columns">
          <div><ReportSectionHeading number="04" title="Alertas e resposta" description="Sinais ativos vinculados ao horizonte selecionado." />{dashboard.alerts?.length ? <ul className="report-alert-list">{dashboard.alerts.map((alert) => <li key={alert.id}><strong>{alert.neighborhood_name || "Recife"} · {alert.title}</strong><span>{alert.description}</span><small>{(alert.recommended_actions?.immediate || []).join(" · ")}</small></li>)}</ul> : <p className="report-empty">Nenhum alerta ativo para o horizonte. Isso não elimina a necessidade de monitoramento de rotina.</p>}</div>
          <aside><ReportSectionHeading number="05" title="Evidências do modelo" description="Versão, janela de treino e desempenho fora da amostra." /><dl className="report-definition-list"><div><dt>Versão</dt><dd>{model.version || "Aguardando treinamento"}</dd></div><div><dt>Método</dt><dd>{model.method === "random_forest_daily_panel" ? "Random Forest sobre painel diário contínuo" : model.method || "Não informado"}</dd></div><div><dt>Histórico de treino</dt><dd>{history.data_start && history.data_end ? `${formatReportDate(history.data_start)} a ${formatReportDate(history.data_end)} (${history.coverage_days} dias)` : "Não registrado"}</dd></div><div><dt>Horizonte</dt><dd>{horizonLabel(model.horizon_days || windowDays)}</dd></div><div><dt>AUC / F1</dt><dd>{formatPercent(model.validation_metrics?.auc)} / {formatPercent(model.validation_metrics?.f1)}</dd></div><div><dt>MAE / RMSE</dt><dd>{model.validation_metrics?.mae ?? "—"} / {model.validation_metrics?.rmse ?? "—"}</dd></div></dl></aside>
        </section>

        <section className="report-section report-two-columns">
          <div><ReportSectionHeading number="06" title="Cobertura e qualidade" description="Indicadores mínimos para julgar confiabilidade e alcance." /><div className="report-table-wrap"><table className="report-table"><tbody><tr><th>Período observado</th><td>{dataQuality.coverage_start ? `${formatReportDate(dataQuality.coverage_start)} a ${formatReportDate(dataQuality.coverage_end)}` : "Sem ocorrências no período"}</td></tr><tr><th>Histórico selecionado</th><td>{dataQuality.historical_years ?? 0} ano(s)</td></tr><tr><th>Registros brutos</th><td>{dataQuality.raw_incidents ?? dashboard.metrics.incidents ?? 0}</td></tr><tr><th>Vinculação a bairro</th><td>{formatPercent(dataQuality.geocoding_rate)}</td></tr><tr><th>Cobertura geométrica</th><td>{formatPercent(dataQuality.geometry_rate)}</td></tr><tr><th>Cobertura de previsão</th><td>{formatPercent(dataQuality.forecast_coverage_rate)}</td></tr></tbody></table></div></div>
          <aside><ReportSectionHeading number="07" title="Explicabilidade" description="Variáveis de maior contribuição no modelo selecionado." />{featureImportance.length ? <ol className="report-feature-list">{featureImportance.slice(0, 8).map(([feature, value]) => <li key={feature}><span>{getModelFeatureLabel(feature)}</span><strong>{formatPercent(value)}</strong></li>)}</ol> : <p className="report-empty">Importância das variáveis não registrada para esta previsão.</p>}<p className="report-method-note">{model.probability_definition || "A probabilidade deve ser interpretada em conjunto com o score, a confiança e a atualidade da base."}</p></aside>
        </section>

        <section className="report-section">
          <ReportSectionHeading number="08" title="Fontes e rastreabilidade" description="Situação dos conectores públicos que sustentam o relatório." />
          <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Fonte</th><th>Tipo</th><th>Status</th><th>Periodicidade</th><th>Último sucesso</th><th>Registros / cobertura</th></tr></thead><tbody>{sources.map((source) => <tr key={source.id || source.name}><td><strong>{source.name}</strong></td><td>{source.kind || "—"}</td><td>{source.status || "não informado"}</td><td>{source.refresh_frequency || "—"}</td><td>{formatReportDate(source.last_success_at)}</td><td>{sourceCoverageLabel(source)}</td></tr>)}</tbody></table></div>
        </section>

        <section className="report-section">
          <ReportSectionHeading number="09" title="Limitações, governança e uso responsável" description="Condições que devem acompanhar qualquer decisão baseada neste documento." />
          <ul className="report-limitations">{limitations.map((item) => <li key={item}>{item}</li>)}</ul>
          <div className="report-governance"><Database size={18} /><p><strong>Rastreabilidade:</strong> versão do modelo, horizonte, janela histórica, fatores observados e métricas de validação ficam vinculados a cada previsão. <strong>Responsabilidade:</strong> recomendações são subsídios para validação pela equipe pública competente.</p></div>
        </section>

        <footer className="report-sheet-footer"><span>R.U.M.O · Rede Unificada de Monitoramento de Ocorrências</span><span><ShieldCheck size={12} /> {reportId} · gerado em {formatReportDate(generatedAt, true)}</span></footer>
      </article>
    </div>
  );
}
