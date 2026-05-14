import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import { EmptyState } from "../common/EmptyState";

const RECIFE_CENTER = [-8.0476, -34.877];

function riskColor(score) {
  if (score >= 75) return "#b42318";
  if (score >= 50) return "#dc6803";
  if (score >= 25) return "#b54708";
  if (score > 0) return "#16803c";
  return "#9aa4b2";
}

export function RiskMap({ geojson }) {
  if (!geojson?.features?.length) {
    return (
      <EmptyState
        title="Mapa sem bairros carregados"
        description="Execute a ingestão geográfica do IBGE para carregar a malha real do Recife."
      />
    );
  }

  return (
    <MapContainer center={RECIFE_CENTER} zoom={12} className="risk-map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <GeoJSON
        key={JSON.stringify(geojson).length}
        data={geojson}
        style={(feature) => ({
          color: "#ffffff",
          weight: 1,
          fillColor: riskColor(feature.properties?.risk_score || 0),
          fillOpacity: 0.68,
        })}
        onEachFeature={(feature, layer) => {
          const p = feature.properties || {};
          layer.bindPopup(
            `<strong>${p.name || "Bairro"}</strong><br/>Risco: ${p.risk_score ?? "sem previsão"}<br/>Casos: ${p.incident_count ?? 0}`
          );
        }}
      />
    </MapContainer>
  );
}
