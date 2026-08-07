import { CloudRain, Droplets, Thermometer, Wind } from "lucide-react";

function formatObservation(value) {
  if (!value) return "horário não informado";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WeatherSummary({ forecast, isLoading }) {
  if (isLoading) {
    return <section className="weather-strip weather-loading" aria-label="Carregando previsão climática" />;
  }
  if (!forecast) return null;

  const current = forecast.current;
  const next24h = forecast.next_24h;
  return (
    <section className="weather-strip" aria-label="Condições e previsão climática do Recife">
      <div className="weather-heading">
        <CloudRain size={20} />
        <div>
          <span className="section-kicker">Clima atual · Recife</span>
          <strong>{current.condition}</strong>
          <small>Atualizado em {formatObservation(forecast.updated_at)} · {forecast.source}</small>
        </div>
      </div>
      <dl className="weather-measures">
        <div><Thermometer size={16} /><dt>Temperatura</dt><dd>{current.temperature_c.toFixed(1)} °C</dd></div>
        <div><Droplets size={16} /><dt>Umidade</dt><dd>{current.relative_humidity_pct.toFixed(0)}%</dd></div>
        <div><CloudRain size={16} /><dt>Chuva nas próximas 24h</dt><dd>{next24h.precipitation_mm.toFixed(1)} mm · {next24h.precipitation_probability_pct}%</dd></div>
        <div><Wind size={16} /><dt>Vento</dt><dd>{current.wind_speed_kmh.toFixed(1)} km/h</dd></div>
      </dl>
      <p>{forecast.usage_note}</p>
    </section>
  );
}
