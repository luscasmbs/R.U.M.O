import { Activity, AlertTriangle, Gauge, MapPinned, RadioTower, TrendingUp } from "lucide-react";

const icons = { neighborhoods: MapPinned, alerts: AlertTriangle, sources: RadioTower, forecasts: TrendingUp, incidents: Activity, risk: Gauge };

export function MetricCards({ metrics }) {
  const cards = [
    { key: "neighborhoods", label: "Bairros monitorados", value: metrics?.neighborhoods || 0, suffix: "territórios" },
    { key: "risk", label: "Risco médio", value: metrics?.average_risk || 0, suffix: "/ 100", trend: metrics?.trend },
    { key: "alerts", label: "Alertas ativos", value: metrics?.active_alerts || 0, suffix: "prioridades" },
    { key: "incidents", label: "Ocorrências no período", value: metrics?.incidents || 0, suffix: "registros" },
    { key: "forecasts", label: "Previsões geradas", value: metrics?.forecasts || 0, suffix: "estimativas" },
    { key: "sources", label: "Fontes no ecossistema", value: metrics?.data_sources || 0, suffix: "conectores" },
  ];

  return (
    <section className="metric-grid" aria-label="Indicadores principais">
      {cards.map((card) => {
        const Icon = icons[card.key];
        return (
          <article key={card.key} className="metric-card">
            <div className="metric-icon"><Icon size={20} /></div>
            <div className="metric-copy">
              <span>{card.label}</span>
              <strong>{card.value} <small>{card.suffix}</small></strong>
              {card.trend !== undefined && <em className={card.trend >= 0 ? "trend-up" : "trend-down"}>{card.trend >= 0 ? "↑" : "↓"} {Math.abs(card.trend)}% vs. semana anterior</em>}
            </div>
          </article>
        );
      })}
    </section>
  );
}
