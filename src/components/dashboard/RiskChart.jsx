import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "../common/EmptyState";

export function RiskChart({ data }) {
  if (!data?.length) {
    return <EmptyState title="Sem série histórica" description="Ainda não há previsões suficientes para montar o gráfico." />;
  }

  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d8dee8" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="risk_score" name="Risco" fill="#126a8a" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
