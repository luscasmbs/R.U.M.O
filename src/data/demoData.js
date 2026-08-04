const neighborhoods = [
  ["Boa Viagem", -8.126, -34.901, 86, 0.86, 42],
  ["Várzea", -8.055, -34.954, 74, 0.74, 35],
  ["Ibura", -8.121, -34.943, 68, 0.68, 31],
  ["Santo Amaro", -8.047, -34.891, 63, 0.63, 28],
  ["Dois Unidos", -8.015, -34.904, 57, 0.57, 22],
  ["Imbiribeira", -8.112, -34.916, 51, 0.51, 18],
  ["Casa Amarela", -8.026, -34.917, 44, 0.44, 16],
  ["Cordeiro", -8.061, -34.922, 39, 0.39, 13],
  ["Jardim São Paulo", -8.087, -34.944, 32, 0.32, 11],
  ["Madalena", -8.061, -34.905, 24, 0.24, 8],
];

function polygon(lat, lon) {
  const size = 0.014;
  return [
    [lon - size, lat - size],
    [lon + size, lat - size * 0.8],
    [lon + size * 0.9, lat + size],
    [lon - size * 0.8, lat + size * 0.9],
    [lon - size, lat - size],
  ];
}

const features = neighborhoods.map(([name, lat, lon, risk, probability, incidents], index) => ({
  type: "Feature",
  id: `demo-${index}`,
  properties: {
    id: `demo-${index}`,
    name,
    code: `2611606-${String(index + 1).padStart(2, "0")}`,
    centroid_lat: lat,
    centroid_lon: lon,
    risk_score: risk,
    probability,
    confidence: 0.72,
    incident_count: incidents,
    category: "epidemiology",
  },
  geometry: { type: "Polygon", coordinates: [polygon(lat, lon)] },
}));

const timeSeries = [
  ["2026-05-18", 74, 0.38],
  ["2026-05-25", 82, 0.42],
  ["2026-06-01", 96, 0.48],
  ["2026-06-08", 91, 0.45],
  ["2026-06-15", 118, 0.56],
  ["2026-06-22", 127, 0.62],
  ["2026-06-29", 136, 0.68],
  ["2026-07-06", 149, 0.73],
  ["2026-07-13", 141, 0.7],
  ["2026-07-20", 158, 0.76],
  ["2026-07-27", 172, 0.81],
  ["2026-08-03", 184, 0.86],
];

export const demoSources = [
  { id: "demo-recife", name: "Portal de Dados Abertos do Recife", kind: "ckan", status: "active", base_url: "dados.recife.pe.gov.br", refresh_frequency: "Trimestral", last_success_at: "2026-08-04T08:20:00Z", coverage: "Arboviroses", records: 18342, metadata: { transport: "CKAN API", quality: "alta" } },
  { id: "demo-datasus", name: "DATASUS", kind: "health_data", status: "ready", base_url: "datasus.saude.gov.br", refresh_frequency: "Mensal", last_success_at: null, coverage: "Notificações epidemiológicas", records: 0, metadata: { transport: "TabNet / arquivos oficiais", quality: "aguardando configuração" } },
  { id: "demo-inmet", name: "INMET", kind: "weather_api", status: "active", base_url: "apitempo.inmet.gov.br", refresh_frequency: "Diária", last_success_at: "2026-08-04T06:00:00Z", coverage: "Chuva, temperatura e umidade", records: 8760, metadata: { stations: 4, quality: "alta" } },
  { id: "demo-apac", name: "APAC", kind: "weather_monitoring", status: "monitoring", base_url: "apac.pe.gov.br", refresh_frequency: "Diária", last_success_at: "2026-08-03T18:10:00Z", coverage: "Monitoramento hídrico e boletins", records: 214, metadata: { transport: "links oficiais", quality: "parcial" } },
  { id: "demo-ibge", name: "IBGE", kind: "geospatial", status: "active", base_url: "geoftp.ibge.gov.br", refresh_frequency: "Sob demanda", last_success_at: "2026-08-02T13:45:00Z", coverage: "Malha territorial e demografia", records: 94, metadata: { year: 2022, quality: "alta" } },
];

const topNeighborhoods = neighborhoods.map(([label, , , risk, probability, incidents], index) => ({
  id: `demo-${index}`,
  label,
  risk_score: risk,
  probability,
  predicted_value: Math.round(risk / 4.7),
  confidence: 0.72,
  incident_count: incidents,
  model_version: "epidemiology-demo-rf-20260804",
  explanation: {
    feature_importance: { rolling_4w: 0.42, cases_lag_1: 0.28, rain_7d: 0.16, humidity: 0.09, population_density: 0.05 },
    features: { rolling_4w: Math.round(incidents / 2), cases_lag_1: Math.round(incidents * 0.7), rain_7d: 42 + index * 3, humidity: 78 - index, population_density: 0.7 + index / 20 },
  },
}));

export const demoDashboard = {
  contract_version: "2026-01",
  mode: "demo",
  generated_at: "2026-08-04T09:30:00Z",
  filters: { module: "epidemiology", category: "epidemiology", window_days: 7, municipality_code: "2611606" },
  metrics: { neighborhoods: 94, active_alerts: 7, forecasts: 94, data_sources: 5, incidents: 1842, high_risk: 9, average_risk: 58.4, trend: 7 },
  geojson: { type: "FeatureCollection", features },
  top_neighborhoods: topNeighborhoods,
  time_series: timeSeries.map(([period, incidents, risk]) => ({ period, incidents, average_risk: Math.round(risk * 100) })),
  category_breakdown: [
    { label: "Dengue", value: 62 },
    { label: "Chikungunya", value: 24 },
    { label: "Zika", value: 9 },
    { label: "Outras arboviroses", value: 5 },
  ],
  model: { version: "epidemiology-demo-rf-20260804", validation_metrics: { auc: 0.86, precision: 0.79, recall: 0.74, f1: 0.76 }, explainability: "feature_importance + variáveis observadas por bairro" },
  alerts: [
    { id: "alert-1", title: "Risco epidemiológico elevado", description: "A tendência de notificações e o acumulado de chuva elevaram o risco projetado para a próxima semana.", severity: "critical", neighborhood_name: "Boa Viagem", created_at: "2026-08-04T08:15:00Z", forecast_id: "forecast-1", recommended_actions: { immediate: ["Priorizar visitas de campo", "Reforçar comunicação preventiva"] } },
    { id: "alert-2", title: "Atenção: tendência de alta", description: "O histórico das últimas quatro semanas supera a linha de base territorial.", severity: "high", neighborhood_name: "Várzea", created_at: "2026-08-03T17:40:00Z", forecast_id: "forecast-2", recommended_actions: { immediate: ["Checar focos informados", "Monitorar atualização diária"] } },
    { id: "alert-3", title: "Chuva acumulada acima da média", description: "Variável meteorológica com impacto potencial no risco epidemiológico.", severity: "medium", neighborhood_name: "Ibura", created_at: "2026-08-02T12:05:00Z", forecast_id: "forecast-3", recommended_actions: { immediate: ["Acompanhar boletim APAC"] } },
  ],
};

export const demoForecasts = topNeighborhoods.flatMap((item, index) => [
  { ...item, neighborhood_name: item.label, id: `forecast-${index + 1}`, target_date: "2026-08-11", created_at: "2026-08-04T08:00:00Z", horizon_days: 7, module: "epidemiology" },
  { ...item, neighborhood_name: item.label, id: `forecast-${index + 1}-previous`, target_date: "2026-08-04", created_at: "2026-07-28T08:00:00Z", horizon_days: 7, risk_score: Math.max(12, item.risk_score - 6), probability: Math.max(0.12, item.probability - 0.06), module: "epidemiology" },
]);

const moduleProfiles = {
  epidemiology: { factor: 1, title: "Risco epidemiológico elevado", categories: [{ label: "Dengue", value: 48 }, { label: "Influenza / gripe", value: 27 }, { label: "Chikungunya", value: 16 }, { label: "Zika", value: 9 }] },
  flood: { factor: 1.12, title: "Risco de alagamento elevado", categories: [{ label: "Chuva intensa", value: 54 }, { label: "Cota de rio", value: 25 }, { label: "Maré alta", value: 13 }, { label: "Drenagem", value: 8 }] },
  landslide: { factor: 0.92, title: "Atenção para instabilidade de encosta", categories: [{ label: "Instabilidade de encosta", value: 46 }, { label: "Solo saturado", value: 32 }, { label: "Via interditada", value: 22 }] },
  security: { factor: 0.78, title: "Ocorrências de segurança em monitoramento", categories: [{ label: "Furto e roubo", value: 45 }, { label: "Violência", value: 34 }, { label: "Sinistro de trânsito", value: 21 }] },
};

const categoryFactors = { all: 1, dengue: 1.08, chikungunya: 0.92, zika: 0.74, influenza: 0.86, rain_intense: 1.15, river_level: 1.02, tide: 0.88, slope: 1.08, soil_saturation: 0.96, blocked_road: 0.78, theft: 0.86, violence: 1.05, traffic: 0.72 };

export function getDemoDashboard(module = "epidemiology", category = "all", windowDays = 7) {
  const profile = moduleProfiles[module] || moduleProfiles.epidemiology;
  const factor = profile.factor * (categoryFactors[category] || 1);
  const score = (value) => Math.min(100, Math.max(0, Math.round(value * factor)));
  const geojson = { ...demoDashboard.geojson, features: demoDashboard.geojson.features.map((feature) => ({ ...feature, properties: { ...feature.properties, category, risk_score: score(feature.properties.risk_score), probability: score(feature.properties.risk_score) / 100 } })) };
  const top = demoDashboard.top_neighborhoods.map((item) => ({ ...item, risk_score: score(item.risk_score), probability: score(item.risk_score) / 100, explanation: { ...item.explanation, target_disease: module === "epidemiology" && category !== "all" ? category : undefined } }));
  return {
    ...demoDashboard,
    generated_at: new Date().toISOString(),
    filters: { ...demoDashboard.filters, module, category, window_days: windowDays },
    metrics: { ...demoDashboard.metrics, average_risk: score(demoDashboard.metrics.average_risk), high_risk: top.filter((item) => item.risk_score >= 65).length, trend: Math.round(demoDashboard.metrics.trend * factor) },
    geojson,
    top_neighborhoods: top,
    category_breakdown: profile.categories,
    model: { ...demoDashboard.model, version: `${module}-demo-rf-20260804` },
    alerts: demoDashboard.alerts.map((alert) => ({ ...alert, title: profile.title })),
  };
}
