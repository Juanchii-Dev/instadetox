import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { log } from "./logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../client/.env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
// IMPORTANTE: Para que Express pueda bypassear RLS al crear notificaciones a otro usuario,
// se requiere la SERVICE_ROLE_KEY. Si no está, usa la ANON_KEY pero las inserciones cruzadas podrían fallar.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials in server environment");
}

export const supabaseAdmin = createClient<any>(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Tipamos la Request extendida para tener el usuario inyectado
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
  userSupabase?: SupabaseClient<any>;
}

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");

    // Validamos el JWT contra Supabase (Uso de auth.getUser para validación del lado del servidor)
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      log(`Auth failed: ${error?.message || "Invalid user"}`, "warn", "auth");
      return res.status(401).json({ error: "No autorizado. Token inválido o expirado." });
    }

    // Inyectamos el usuario en la request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    req.userSupabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    next();
  } catch (err) {
    return res.status(500).json({ error: "Internal Auth Error" });
  }
};
