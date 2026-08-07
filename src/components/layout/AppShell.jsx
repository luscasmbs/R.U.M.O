import { Bell, BrainCircuit, Database, FileText, LayoutDashboard, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { getStoredUser, logout } from "../../api/client";

const links = [
  { to: "/dashboard", label: "Visão pública", icon: LayoutDashboard, public: true },
  { to: "/previsoes", label: "Previsões", icon: BrainCircuit },
  { to: "/relatorios", label: "Relatórios", icon: FileText },
  { to: "/fontes", label: "Fontes", icon: Database },
  { to: "/operacoes", label: "Operações", icon: Bell },
];

export function AppShell() {
  const navigate = useNavigate();
  const user = getStoredUser();
  function handleLogout() { logout(); navigate("/login", { replace: true }); }
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegação principal">
        <div className="brand-block"><div className="brand-mark">R</div><div><strong>R.U.M.O</strong><span>Inteligência territorial</span></div></div>
        <div className="sidebar-rule" />
        <nav className="nav-list">{links.filter((link) => user || link.public).map((link) => { const LinkIcon = link.icon; return <NavLink key={link.to} to={link.to} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}><LinkIcon size={18} /><span>{link.label}</span></NavLink>; })}</nav>
        <div className="sidebar-context"><span className="section-kicker">Escopo ativo</span><strong>Recife · PE</strong><span>Monitoramento urbano integrado</span></div>
        <div className="sidebar-footer">{user ? <><div className="user-pill"><ShieldCheck size={18} /><div><strong>{user.name}</strong><span>{user.role}</span></div></div><button className="icon-text-button" onClick={handleLogout}><LogOut size={18} /> Sair</button></> : <><div className="user-pill"><LayoutDashboard size={18} /><div><strong>Acesso público</strong><span>visão geral do território</span></div></div><Link className="icon-text-button" to="/login"><LogIn size={18} /> Acesso profissional</Link></>}</div>
      </aside>
      <main className="main-surface"><div className="main-topbar"><span>R.U.M.O · rede unificada de monitoramento de ocorrências</span><span className="topbar-secure"><ShieldCheck size={14} /> {user ? "Ambiente profissional" : "Informação pública"}</span></div><Outlet /></main>
    </div>
  );
}
