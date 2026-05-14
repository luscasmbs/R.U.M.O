import { Bell, Database, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { getStoredUser, logout } from "../../api/client";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/fontes", label: "Fontes", icon: Database },
  { to: "/operacoes", label: "Operações", icon: Bell },
];

export function AppShell() {
  const navigate = useNavigate();
  const user = getStoredUser();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegação principal">
        <div className="brand-block">
          <div className="brand-mark">R</div>
          <div>
            <strong>R.U.M.O</strong>
            <span>Monitoramento real</span>
          </div>
        </div>

        <nav className="nav-list">
          {links.map((link) => {
            const LinkIcon = link.icon;
            return (
              <NavLink key={link.to} to={link.to} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                <LinkIcon size={18} />
                <span>{link.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-pill">
            <ShieldCheck size={18} />
            <div>
              <strong>{user?.name || "Usuário"}</strong>
              <span>{user?.role || "operador"}</span>
            </div>
          </div>
          <button className="icon-text-button" onClick={handleLogout}>
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      <main className="main-surface">
        <Outlet />
      </main>
    </div>
  );
}
