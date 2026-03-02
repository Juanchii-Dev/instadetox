import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import "./index.css";
// import { initPerformanceTelemetry } from "./lib/telemetry";

// Telemetría desactivada temporalmente - el backend no está en el mismo dominio que el frontend
// initPerformanceTelemetry();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
