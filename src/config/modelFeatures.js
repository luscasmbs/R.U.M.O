export const modelFeatureLabels = {
  cases_lag_1: "Casos no dia anterior",
  cases_lag_7: "Casos há 7 dias",
  cases_lag_14: "Casos há 14 dias",
  cases_lag_28: "Casos há 28 dias",
  rolling_7d: "Acumulado de 7 dias",
  rolling_28d: "Acumulado de 28 dias",
  rolling_90d: "Acumulado de 90 dias",
  trend_7d: "Variação semanal",
  dayofyear_sin: "Sazonalidade anual (seno)",
  dayofyear_cos: "Sazonalidade anual (cosseno)",
};

export function getModelFeatureLabel(feature) {
  return modelFeatureLabels[feature] || feature.replaceAll("_", " ");
}
