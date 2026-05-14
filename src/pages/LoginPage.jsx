import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/client";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@rumo.local");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Não foi possível autenticar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          <div className="brand-mark">R</div>
          <div>
            <h1>R.U.M.O</h1>
            <p>Rede Unificada de Monitoramento de Ocorrências</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <label>
            E-mail
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" />
          </label>
          <label>
            Senha
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
