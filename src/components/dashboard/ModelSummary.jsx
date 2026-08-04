import { ShieldCheck, Sparkles } from "lucide-react";

const metricLabels = { auc: "AUC", precision: "Precisão", recall: "Recall", f1: "F1-score" };

export function ModelSummary({ model }) {
  const metrics = model?.validation_metrics || {};
  return (
    <div className="model-summary">
      <div className="model-header"><div className="model-icon"><Sparkles size={18} /></div><div><strong>{model?.version || "Modelo aguardando treino"}</strong><span>Explicabilidade registrada por previsão</span></div></div>
      <div className="model-metrics">{Object.entries(metricLabels).map(([key, label]) => <div key={key}><span>{label}</span><strong>{metrics[key] === null || metrics[key] === undefined ? "—" : `${Math.round(metrics[key] * 100)}%`}</strong></div>)}</div>
      <div className="audit-note"><ShieldCheck size={16} /> Versão, variáveis e parâmetros são armazenados para auditoria.</div>
    </div>
  );
}
