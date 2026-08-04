import { useState } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage, login } from "../api/client";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@rumo.local");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function handleSubmit(event) {
    event.preventDefault(); setLoading(true); setError("");
    try { await login(email, password); navigate("/dashboard", { replace: true }); } catch (requestError) { setError(getApiErrorMessage(requestError, "Não foi possível autenticar.")); } finally { setLoading(false); }
  }
  return <main className="login-page"><div className="login-backdrop"><span /><span /><span /></div><section className="login-panel"><div className="login-brand"><div className="brand-mark">R</div><div><span className="section-kicker">Plataforma pública de dados</span><h1>R.U.M.O</h1><p>Rede Unificada de Monitoramento de Ocorrências</p></div></div><div className="login-divider" /><div className="login-intro"><strong>Bem-vindo ao centro de inteligência territorial</strong><span>Entre para consultar indicadores, previsões e alertas do Recife.</span></div><form onSubmit={handleSubmit} className="login-form"><label>E-mail<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" required /></label><label>Senha<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary-button login-submit" disabled={loading}>{loading ? "Entrando..." : "Acessar plataforma"}<ArrowRight size={17} /></button></form><div className="login-footer"><span><LockKeyhole size={14} /> Acesso autenticado</span><span><ShieldCheck size={14} /> Ambiente institucional</span></div></section><div className="login-caption">R.U.M.O · dados para prevenção, planejamento e resposta pública</div></main>;
}
