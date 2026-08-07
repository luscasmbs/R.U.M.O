import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";

const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const DataSourcesPage = lazy(() => import("./pages/DataSourcesPage").then((module) => ({ default: module.DataSourcesPage })));
const OperationsPage = lazy(() => import("./pages/OperationsPage").then((module) => ({ default: module.OperationsPage })));
const ForecastsPage = lazy(() => import("./pages/ForecastsPage").then((module) => ({ default: module.ForecastsPage })));
const ReportsPage = lazy(() => import("./pages/ReportsPage").then((module) => ({ default: module.ReportsPage })));

function PageFallback() {
  return <div className="page-fallback" role="status">Carregando módulo…</div>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Suspense fallback={<PageFallback />}><DashboardPage /></Suspense>} />
        <Route path="fontes" element={<ProtectedRoute><Suspense fallback={<PageFallback />}><DataSourcesPage /></Suspense></ProtectedRoute>} />
        <Route path="operacoes" element={<ProtectedRoute><Suspense fallback={<PageFallback />}><OperationsPage /></Suspense></ProtectedRoute>} />
        <Route path="previsoes" element={<ProtectedRoute><Suspense fallback={<PageFallback />}><ForecastsPage /></Suspense></ProtectedRoute>} />
        <Route path="relatorios" element={<ProtectedRoute><Suspense fallback={<PageFallback />}><ReportsPage /></Suspense></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
