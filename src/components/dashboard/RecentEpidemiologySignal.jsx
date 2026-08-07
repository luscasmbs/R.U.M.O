import { Activity, CalendarClock } from "lucide-react";

const diseaseLabels = {
  dengue: "Dengue",
  chikungunya: "Chikungunya",
  zika: "Zika",
};

function formatDate(value) {
  if (!value) return "sem data recente";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

export function RecentEpidemiologySignal({ signal }) {
  if (!signal) return null;
  return (
    <section className="epidemiology-strip" aria-label="Sinal epidemiológico municipal recente">
      <div className="epidemiology-heading">
        <Activity size={20} />
        <div>
          <span className="section-kicker">Sinal municipal · Open Data SUS</span>
          <strong>Notificações de arboviroses em {signal.reference_year}</strong>
          <small><CalendarClock size={12} /> Registro mais recente: {formatDate(signal.latest_notification_date)}</small>
        </div>
      </div>
      <dl className="epidemiology-measures">
        {signal.diseases.map((item) => (
          <div key={item.disease}>
            <dt>{diseaseLabels[item.disease] || item.disease}</dt>
            <dd>{item.status === "available" ? `${item.records_sampled.toLocaleString("pt-BR")}${item.sample_limit_reached ? "+" : ""}` : "Indisponível"}</dd>
            <small>registros consultados</small>
          </div>
        ))}
      </dl>
      <p>{signal.scope_note}</p>
    </section>
  );
}
