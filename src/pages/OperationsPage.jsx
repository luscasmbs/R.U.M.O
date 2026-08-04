import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BrainCircuit, CloudDownload, Droplets, FileHeart, MapPinned, RadioTower } from "lucide-react";
import { api, getApiErrorMessage, getStoredUser } from "../api/client";

const actions = [
  { key: "recife_ckan", title: "Arboviroses do Recife", description: "Baixa recursos CKAN oficiais de dengue, zika e chikungunya e normaliza ocorrências históricas.", icon: CloudDownload, source: "Portal de Dados Abertos do Recife" },
  { key: "datasus", title: "Contrato DATASUS", description: "Registra o contrato e a prontidão do conector epidemiológico para a carga oficial.", icon: FileHeart, source: "DATASUS" },
  { key: "inmet", title: "Estações meteorológicas", description: "Consulta estações públicas do INMET para alimentar chuva, temperatura e umidade.", icon: RadioTower, source: "INMET" },
  { key: "apac", title: "Monitoramento APAC", description: "Coleta links oficiais de boletins, chuva e cotas para rastreabilidade hídrica.", icon: Droplets, source: "APAC" },
  { key: "ibge_geo", title: "Malha territorial IBGE", description: "Baixa a malha oficial de bairros/setores e persiste geometrias em PostGIS.", icon: MapPinned, source: "IBGE" },
];

export function OperationsPage() {
  const [trainingDisease, setTrainingDisease] = useState("all");
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const canManage = ["admin", "analyst"].includes(user?.role);
  const ingestion = useMutation({ mutationFn: (payload) => api.post("/ingestion/run", payload), onSuccess: () => queryClient.invalidateQueries() });
  const train = useMutation({ mutationFn: () => api.post("/ml/train", { module: "epidemiology", disease: trainingDisease === "all" ? null : trainingDisease }), onSuccess: () => queryClient.invalidateQueries() });
  const pending = ingestion.isPending || train.isPending;

  return (
    <div className="page-stack">
      <header className="page-header"><div><span className="eyebrow">ETL · qualidade · ML</span><h1>Operações de dados</h1><p>Execute cargas, atualize fontes e treine o modelo mantendo o histórico auditável.</p></div><span className="role-badge">Perfil: {user?.role || "operador"}</span></header>
      {!canManage && <div className="inline-notice"><BrainCircuit size={17} /> Seu perfil pode consultar o sistema, mas a execução de ETL e treino requer perfil de analista ou administrador.</div>}
      <section className="operation-grid">{actions.map((action) => { const ActionIcon = action.icon; return <article className="operation-card" key={action.key}><div className="operation-icon"><ActionIcon size={21} /></div><span className="section-kicker">{action.source}</span><strong>{action.title}</strong><p>{action.description}</p><button className="primary-button" onClick={() => ingestion.mutate({ sources: [action.key] })} disabled={!canManage || pending}>Executar carga</button></article>; })}</section>
      <section className="surface-card model-training-card"><div className="card-header"><div><span className="section-kicker">Alvo do treino</span><h2>Escolha a síndrome/doença</h2></div><span>Histórico persistido</span></div><div className="control-group"><label htmlFor="training-disease">Previsão a treinar</label><select id="training-disease" value={trainingDisease} onChange={(event) => setTrainingDisease(event.target.value)}><option value="all">Todas as doenças epidemiológicas</option><option value="influenza">Influenza / gripe</option><option value="dengue">Dengue</option><option value="chikungunya">Chikungunya</option><option value="zika">Zika</option></select></div><button className="primary-button" onClick={() => train.mutate()} disabled={!canManage || pending}>Treinar alvo selecionado</button></section>
      {(ingestion.data || train.data) && <pre className="result-box">{JSON.stringify((ingestion.data || train.data).data, null, 2)}</pre>}
      {(ingestion.error || train.error) && <div className="form-error">{getApiErrorMessage(ingestion.error || train.error)}</div>}
    </div>
  );
}
