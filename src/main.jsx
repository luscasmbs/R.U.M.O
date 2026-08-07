import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "./styles/global.css";
import App from "./App.jsx";
import { RuntimeErrorBoundary } from "./components/common/RuntimeErrorBoundary.jsx";
import { installRuntimeRecovery } from "./core/runtimeRecovery.js";

installRuntimeRecovery();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <RuntimeErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </RuntimeErrorBoundary>
);
