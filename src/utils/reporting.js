export const REPORT_TYPES = [
  ["executive", "Boletim executivo", "Decisões, prioridades e providências recomendadas."],
  ["territorial", "Relatório territorial", "Risco comparado, cobertura e prioridades por bairro."],
  ["governance", "Fontes e governança", "Qualidade, atualização, limitações e rastreabilidade."],
  ["model", "Relatório do modelo", "Metodologia, validação temporal e explicabilidade."],
];

export function hasOperationalData(data) {
  const metrics = data?.metrics;
  return Boolean(metrics && (metrics.neighborhoods > 0 || metrics.forecasts > 0 || metrics.incidents > 0));
}

export function formatReportDate(value, withTime = false) {
  if (!value) return "Não informado";
  const normalized = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T12:00:00`
    : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(
    "pt-BR",
    withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" },
  );
}

export function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "Não estimada";
  return `${Math.round(Number(value) * 100)}%`;
}

export function horizonLabel(days) {
  if (days === 1) return "24 horas";
  if (days === 28) return "4 semanas";
  return `${days} dias`;
}

export function riskLevel(score) {
  if (score >= 80) return "Crítico";
  if (score >= 65) return "Alto";
  if (score >= 40) return "Atenção";
  return "Baixo";
}

export function recommendedAction(score) {
  if (score >= 80) return "Validação imediata e priorização de campo";
  if (score >= 65) return "Verificação técnica em até 24 horas";
  if (score >= 40) return "Monitoramento reforçado no próximo ciclo";
  return "Manter vigilância de rotina";
}

export function sourceCoverageLabel(source) {
  if (source.records) return source.records;
  if (["string", "number"].includes(typeof source.coverage)) return source.coverage;
  if (source.coverage && typeof source.coverage === "object") {
    return "Metadados de cobertura disponíveis";
  }
  return "—";
}

export function buildReportLimitations({ dataQuality, freshnessDays, hasModel }) {
  return [
    "O score orienta a priorização territorial. Ele não substitui a avaliação da equipe responsável nem a decisão administrativa.",
    "Subnotificação, atraso de publicação e mudanças no padrão de registro podem reduzir a capacidade preditiva.",
    freshnessDays > 14
      ? `A base usada pelo modelo está defasada em ${freshnessDays} dias. Confirme a atualização antes de mobilizar recursos.`
      : null,
    dataQuality.geocoding_rate < 0.95
      ? `A vinculação territorial é de ${formatPercent(dataQuality.geocoding_rate)}. Registros sem bairro reduzem a leitura espacial.`
      : null,
    !hasModel
      ? "Não há modelo treinado para o horizonte selecionado. Os resultados exibidos são demonstrativos ou descritivos."
      : null,
  ].filter(Boolean);
}

export function buildActionPlan({ dashboard, dataQuality, highCount, topRisk, rankingLength }) {
  return [
    {
      deadline: "0–24 h",
      owner: "Vigilância e coordenação operacional",
      action: highCount
        ? `Validar os sinais dos ${highCount} territórios com score alto ou crítico e registrar a decisão.`
        : "Confirmar a ausência de sinais críticos e manter o monitoramento.",
      evidence: topRisk
        ? `${topRisk.label}: score ${Math.round(topRisk.risk_score)}/100`
        : "Sem previsão territorial disponível",
    },
    {
      deadline: "2–7 dias",
      owner: "Equipes territoriais e atenção básica",
      action: "Cruzar focos, notificações recentes e capacidade de atendimento; priorizar inspeções e comunicação preventiva.",
      evidence: `${dashboard.metrics.incidents || 0} ocorrências no período selecionado`,
    },
    {
      deadline: "8–28 dias",
      owner: "Planejamento, dados e gestão",
      action: "Reavaliar recursos, cobertura das fontes e efeito das medidas; documentar divergências entre previsão e ocorrência observada.",
      evidence: `Cobertura prevista em ${dataQuality.neighborhoods_with_forecast ?? rankingLength} territórios`,
    },
  ];
}

export function serializeTerritorialCsv(ranking) {
  return [
    "bairro;score_prioridade;classificacao;probabilidade;casos_previstos;confianca;ocorrencias_periodo;acao_recomendada",
    ...ranking.map((item) => [
      item.label,
      Math.round(item.risk_score),
      riskLevel(item.risk_score),
      item.probability ?? "",
      item.predicted_value ?? "",
      item.confidence ?? "",
      item.incident_count || 0,
      recommendedAction(item.risk_score),
    ].join(";")),
  ].join("\n");
}
