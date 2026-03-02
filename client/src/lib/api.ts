import { supabase } from "./supabase";

export interface ApiError extends Error {
  status: number;
  code: string;
  retryable: boolean;
}

// URL base del backend - en producción debe apuntar al servidor Express
const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  if (!supabase) throw new Error("Supabase client not initialized");

  try {
    const { data: { session } } = await supabase.auth.getSession();

    // 2. Construir los headers y preservar los existentes
    const headers = new Headers(options.headers);
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }

    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    // 3. Opciones finales
    const finalOptions: RequestInit = {
      ...options,
      headers,
    };

    // 4. Construir URL completa usando el backend configurado
    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, finalOptions);

    if (!response.ok) {
      const status = response.status;
      let message = `API Error ${status}`;
      let code = "UNKNOWN_ERROR";
      
      try {
        const errPayload = await response.json();
        message = errPayload.error || errPayload.message || message;
        code = errPayload.code || (status >= 500 ? "SERVER_ERROR" : "CLIENT_ERROR");
      } catch {
        // ignore json parse error
      }

      const error = new Error(message) as ApiError;
      error.status = status;
      error.code = code;
      error.retryable = status >= 500 || status === 429;
      throw error;
    }

    // 5. Parsear si hay JSON (no lanzar error si es body vacío)
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch (err: any) {
    if (err.status) throw err; // Ya normalizado
    
    // Error de red o similar
    const networkError = new Error(err.message || "Network request failed") as ApiError;
    networkError.status = 0;
    networkError.code = "NETWORK_ERROR";
    networkError.retryable = true;
    throw networkError;
  }
}
