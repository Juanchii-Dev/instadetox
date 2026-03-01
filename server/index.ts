import express, { type Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import cors, { type CorsOptions } from "cors";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { log } from "./logger";
import path from "path";

dotenv.config({ path: path.resolve(import.meta.dirname, ".env") });

const app = express();
app.set("trust proxy", 1);

const isProduction = process.env.NODE_ENV === "production";
const corsAllowList = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (corsAllowList.length === 0) {
      callback(null, !isProduction);
      return;
    }

    callback(null, corsAllowList.includes(origin));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Límite global razonable para /api
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiadas peticiones desde esta IP, por favor intenta más tarde." },
});

// Limitador estricto para AUTH (Login/Register/Recovery) - Protección M12
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 15, // Solo 15 intentos por hora por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiados intentos de acceso. Por seguridad, espera una hora." },
});

// Limitador para acciones sociales (Likes, Comments, Follows) - Anti-Spam
const socialLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 20, // Máximo 20 acciones sociales por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Estás realizando acciones demasiado rápido. Tómate un respiro." },
});

app.use(
  helmet({
    // In dev, Vite injects runtime scripts/styles that strict CSP blocks.
    contentSecurityPolicy: isProduction,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(cors(corsOptions));
app.use(express.json({ 
  limit: "100kb", 
  type: ["application/json", "text/plain"] 
}));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use("/api", limiter);
app.use("/api/auth", authLimiter); // Este endpoint se manejará en routes.ts si existe, o se reserva para el futuro

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "...";
      }

      log(logLine, "info", "express");
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const normalized = err as { status?: number; statusCode?: number; message?: string };
    const status = normalized.status || normalized.statusCode || 500;
    const message = status >= 500 ? "Internal Server Error" : normalized.message || "Request failed";

    log(`HTTP ${status}: ${normalized.message ?? "unknown error"}`, "error", "express");
    res.status(status).json({ message });
  });

  const port = Number(process.env.PORT ?? "3000");
  const host = process.env.HOST ?? "0.0.0.0";

  server.listen(
    {
      port,
      host,
    },
    () => {
      log(`serving on ${host}:${port}`);
    },
  );
})();
