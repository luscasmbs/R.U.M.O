import { useMemo, useState } from "react";
import { Circle, CircleMarker, GeoJSON, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import { EmptyState } from "../common/EmptyState";

const RECIFE_CENTER = [-8.0476, -34.877];

function riskColor(score) {
  if (score >= 75) return "#b83232";
  if (score >= 50) return "#d98324";
  if (score >= 25) return "#e7b34b";
  if (score > 0) return "#168a70";
  return "#91a1ad";
}

function popupFor(feature) {
  const properties = feature.properties || {};
  const content = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = properties.name || "Bairro";
  const body = document.createElement("p");
  const probability = properties.probability === null || properties.probability === undefined
    ? "não estimada"
    : `${Math.round(properties.probability * 100)}%`;
  body.textContent = `Score ${properties.risk_score ?? "sem previsão"}/100 · ${properties.incident_count ?? 0} ocorrências · probabilidade ${probability}`;
  content.append(title, body);
  return content;
}

export function RiskMap({ geojson }) {
  const [layers, setLayers] = useState({ areas: true, heat: true, points: true });
  const features = useMemo(() => geojson?.features || [], [geojson]);
  const points = useMemo(
    () => features.filter((feature) => feature.properties?.centroid_lat && feature.properties?.centroid_lon),
    [features],
  );
  const riskLayerKey = useMemo(
    () => features.map((feature) => `${feature.id}:${feature.properties?.risk_score ?? "none"}`).join("|"),
    [features],
  );
  if (!features.length) {
    return <EmptyState title="Mapa sem bairros carregados" description="Execute a ingestão geográfica do IBGE ou ative o modo demonstração para visualizar a malha." />;
  }

  return (
    <div className="map-frame">
      <div className="map-tools" aria-label="Camadas do mapa">
        {[["areas", "Áreas de risco"], ["heat", "Campo de calor"], ["points", "Marcadores"]].map(([key, label]) => (
          <label key={key} className="switch-label"><input type="checkbox" checked={layers[key]} onChange={() => setLayers((current) => ({ ...current, [key]: !current[key] }))} /> {label}</label>
        ))}
      </div>
      <MapContainer center={RECIFE_CENTER} zoom={12} className="risk-map" scrollWheelZoom>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {layers.areas && <GeoJSON
          key={`${riskLayerKey}-${layers.areas}`}
          data={geojson}
          style={(feature) => ({ color: "#ffffff", weight: 1, fillColor: riskColor(feature.properties?.risk_score || 0), fillOpacity: 0.62 })}
          onEachFeature={(feature, layer) => layer.bindPopup(popupFor(feature))}
        />}
        {layers.heat && points.map((feature) => {
          const properties = feature.properties;
          return <Circle key={`heat-${feature.id}`} center={[properties.centroid_lat, properties.centroid_lon]} radius={Math.max(450, (properties.risk_score || 0) * 13)} pathOptions={{ color: riskColor(properties.risk_score), fillColor: riskColor(properties.risk_score), fillOpacity: 0.12, weight: 0 }} />;
        })}
        {layers.points && points.map((feature) => {
          const properties = feature.properties;
          return <CircleMarker key={`point-${feature.id}`} center={[properties.centroid_lat, properties.centroid_lon]} radius={6 + Math.round((properties.risk_score || 0) / 25)} pathOptions={{ color: "#fff", weight: 2, fillColor: riskColor(properties.risk_score), fillOpacity: 1 }}><Tooltip direction="top">{properties.name}: {properties.risk_score}/100</Tooltip></CircleMarker>;
        })}
      </MapContainer>
      <div className="map-legend" aria-label="Legenda de risco">
        <span><i className="legend-dot low" /> Baixo</span><span><i className="legend-dot medium" /> Atenção</span><span><i className="legend-dot high" /> Alto</span><span><i className="legend-dot critical" /> Crítico</span>
      </div>
    </div>
  );
}
