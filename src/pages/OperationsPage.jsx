import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BrainCircuit, CloudDownload, MapPinned } from "lucide-react";
import { api } from "../api/client";

export function OperationsPage() {
  const queryClient = useQueryClient();

  const ingestion = useMutation({
    mutationFn: (payload) => api.post("/ingestion/run", payload),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const train = useMutation({
    mutationFn: () => api.post("/ml/train", { module: "epidemiology" }),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const actions = [
    {
      title: "Ingerir arboviroses do Recife CKAN",
      description: "Baixa CSVs oficiais de dengue, zika e chikungunya e grava ocorrências históricas.",
      icon: CloudDownload,
      onClick: () => ingestion.mutate({ sources: ["recife_ckan"] }),
    },
    {
      title: "Carregar malha geográfica do IBGE",
      description: "Baixa a malha oficial de bairros/setores e persiste geometrias em PostGIS.",
      icon: MapPinned,
      onClick: () => ingestion.mutate({ sources: ["ibge_geo"] }),
    },
    {
      title: "Treinar modelo epidemiológico",
      description: "Treina modelo real com histórico persistido e salva previsões por bairro.",
      icon: BrainCircuit,
      onClick: () => train.mutate(),
    },
  ];

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">ETL e ML</span>
          <h1>Operações do MVP</h1>
          <p>Rotinas reais de ingestão, geografia e treinamento inicial.</p>
        </div>
      </header>
      <section className="operation-grid">
        {actions.map((action) => {
          const ActionIcon = action.icon;
          return (
            <article className="operation-card" key={action.title}>
              <ActionIcon size={24} />
              <strong>{action.title}</strong>
              <p>{action.description}</p>
              <button className="primary-button" onClick={action.onClick} disabled={ingestion.isPending || train.isPending}>
                Executar
              </button>
            </article>
          );
        })}
      </section>
      {(ingestion.data || train.data) && <pre className="result-box">{JSON.stringify((ingestion.data || train.data).data, null, 2)}</pre>}
      {(ingestion.error || train.error) && <div className="form-error">{(ingestion.error || train.error).message}</div>}
    </div>
  );
}
