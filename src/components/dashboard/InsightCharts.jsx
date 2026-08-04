import { Area, AreaChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "../common/EmptyState";

const COLORS = ["#126a8a", "#d98324", "#b83232", "#168a70", "#6f82a0"];

export function TrendChart({ data }) {
  if (!data?.length) return <EmptyState title="Sem série histórica" description="A série será exibida quando houver ocorrências consolidadas." />;
  const formatted = data.map((item) => ({ ...item, label: new Date(`${item.period}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) }));
  return <ResponsiveContainer width="100%" height={260}><AreaChart data={formatted} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}><defs><linearGradient id="riskArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#126a8a" stopOpacity={0.28} /><stop offset="95%" stopColor="#126a8a" stopOpacity={0.02} /></linearGradient></defs><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => [`${value}`, "Ocorrências"]} /><Area type="monotone" dataKey="incidents" stroke="#126a8a" strokeWidth={2.5} fill="url(#riskArea)" /></AreaChart></ResponsiveContainer>;
}

export function CategoryChart({ data }) {
  if (!data?.length) return <EmptyState title="Sem categorias" description="Os registros categorizados aparecerão aqui." />;
  return <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={data} dataKey="value" nameKey="label" innerRadius={62} outerRadius={92} paddingAngle={3}>{data.map((entry, index) => <Cell key={entry.label} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /><Legend verticalAlign="bottom" height={32} iconSize={8} wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer>;
}
