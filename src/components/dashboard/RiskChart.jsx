import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "../common/EmptyState";

export function RiskChart({ data }) {
  if (!data?.length) return <EmptyState title="Sem previsão territorial" description="Ainda não há scores suficientes para priorizar os bairros." />;
  return (
    <div className="chart-box risk-ranking">
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 18 }}>
          <CartesianGrid horizontal={false} stroke="#dbe5ec" />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => [`${value}/100`, "Score de risco"]} />
          <Bar dataKey="risk_score" name="Risco" radius={[0, 6, 6, 0]}>
            {data.map((entry) => <Cell key={entry.id || entry.label} fill={entry.risk_score >= 65 ? "#c53b35" : entry.risk_score >= 40 ? "#d98324" : "#168a70"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
