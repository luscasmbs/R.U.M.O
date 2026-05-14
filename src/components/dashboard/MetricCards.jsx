import { AlertTriangle, MapPinned, RadioTower, TrendingUp } from "lucide-react";

const icons = {
  neighborhoods: MapPinned,
  alerts: AlertTriangle,
  sources: RadioTower,
  forecasts: TrendingUp,
};

export function MetricCards({ metrics }) {
  const cards = [
    { key: "neighborhoods", label: "Bairros monitorados", value: metrics?.neighborhoods || 0 },
    { key: "alerts", label: "Alertas ativos", value: metrics?.active_alerts || 0 },
    { key: "forecasts", label: "Previsões geradas", value: metrics?.forecasts || 0 },
    { key: "sources", label: "Fontes conectadas", value: metrics?.data_sources || 0 },
  ];

  return (
    <section className="metric-grid">
      {cards.map((card) => {
        const Icon = icons[card.key];
        return (
          <article key={card.key} className="metric-card">
            <Icon size={20} />
            <div>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </div>
          </article>
        );
      })}
    </section>
  );
}
