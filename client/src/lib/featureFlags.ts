/**
 * ============================================================================
 * FASE 0 - FEATURE FLAGS SYSTEM
 * ============================================================================
 * Sistema de flags para activación segura y rollback instantáneo.
 * 
 * Reglas:
 * - NUNCA usar process.env directamente en componentes
 * - Siempre usar los helpers tipados de este archivo
 * - Los flags son inmutables en runtime (recarga requerida)
 * - Valor por defecto SIEMPRE debe mantener comportamiento actual
 * ============================================================================
 */

import { z } from "zod";

/**
 * Schema de validación para feature flags.
 * Agregar nuevos flags aquí con su tipo y default.
 */
const FeatureFlagsSchema = z.object({
  /**
   * Flag maestro para el nuevo sistema de mensajería.
   * Cuando está en false (default): Usa sistema actual sin cambios.
   * Cuando está en true: Usa nuevo sistema (cuando esté implementado).
   */
  ENABLE_NEW_MESSAGE_SYSTEM: z.boolean().default(false),
  
  /**
   * FASE 4: Flag para realtime optimizado con filtros server-side.
   * Cuando está en false (default): Usa suscripción global sin filtros.
   * Cuando está en true: Usa canales filtrados por conversation_id.
   *
   * ⚠️ CRÍTICO: Reversible, no rompe realtime actual.
   */
  ENABLE_REALTIME_FILTERED: z.boolean().default(false),
  
  /**
   * Flag para activar métricas detalladas de mensajería.
   * Útil para debugging sin afectar performance en producción.
   */
  ENABLE_MESSAGE_METRICS: z.boolean().default(true),
  
  /**
   * Flag para modo debug de mensajería (logs adicionales).
   * Solo para desarrollo, nunca en producción.
   */
  DEBUG_MESSAGING: z.boolean().default(false),
  
  /**
   * FASE 5: Flag para Outbox Engine (Reliable Messaging).
   * Cuando está en false (default): Usa retry simple sin outbox persistente.
   * Cuando está en true: Usa outbox con backoff exponencial y DLQ.
   *
   * ⚠️ CRÍTICO: Reversible, no rompe realtime actual.
   */
  ENABLE_OUTBOX_ENGINE: z.boolean().default(false),
});

type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

/**
 * Configuración fuente de los flags.
 * Orden de precedencia:
 * 1. process.env (build time)
 * 2. localStorage (runtime override para testing)
 * 3. Valores default (fallback)
 */
function loadFeatureFlags(): FeatureFlags {
  // En development, permitir override desde localStorage
  const localOverride = (() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem("ig_feature_flags_override");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  })();

  const rawFlags = {
    ENABLE_NEW_MESSAGE_SYSTEM: parseBooleanEnv(
      import.meta.env?.VITE_ENABLE_NEW_MESSAGE_SYSTEM,
      localOverride.ENABLE_NEW_MESSAGE_SYSTEM,
      false
    ),
    ENABLE_REALTIME_FILTERED: parseBooleanEnv(
      import.meta.env?.VITE_ENABLE_REALTIME_FILTERED,
      localOverride.ENABLE_REALTIME_FILTERED,
      false
    ),
    ENABLE_MESSAGE_METRICS: parseBooleanEnv(
      import.meta.env?.VITE_ENABLE_MESSAGE_METRICS,
      localOverride.ENABLE_MESSAGE_METRICS,
      true
    ),
    DEBUG_MESSAGING: parseBooleanEnv(
      import.meta.env?.VITE_DEBUG_MESSAGING,
      localOverride.DEBUG_MESSAGING,
      false
    ),
    ENABLE_OUTBOX_ENGINE: parseBooleanEnv(
      import.meta.env?.VITE_ENABLE_OUTBOX_ENGINE,
      localOverride.ENABLE_OUTBOX_ENGINE,
      false
    ),
  };

  // Validación estricta con Zod
  const result = FeatureFlagsSchema.safeParse(rawFlags);
  
  if (!result.success) {
    console.error("[FeatureFlags] Error de validación:", result.error.format());
    // Fallback seguro: todos los flags en false
    return {
      ENABLE_NEW_MESSAGE_SYSTEM: false,
      ENABLE_REALTIME_FILTERED: false,
      ENABLE_MESSAGE_METRICS: true,
      DEBUG_MESSAGING: false,
      ENABLE_OUTBOX_ENGINE: false,
    };
  }

  return result.data;
}

/**
 * Parsea variables de entorno booleanas.
 * Soporta: "true", "1", "yes" (case insensitive)
 */
function parseBooleanEnv(
  envValue: string | undefined,
  localOverride: boolean | undefined,
  defaultValue: boolean
): boolean {
  // Local override tiene prioridad
  if (typeof localOverride === "boolean") {
    return localOverride;
  }
  
  if (!envValue) return defaultValue;
  
  const normalized = envValue.toString().toLowerCase().trim();
  return ["true", "1", "yes", "on"].includes(normalized);
}

/**
 * Singleton de flags inicializado una sola vez.
 * Los flags son inmutables después de la carga inicial.
 */
const FLAGS = loadFeatureFlags();

/**
 * ============================================================================
 * HELPERS PÚBLICOS - Usar estos en lugar de acceder a FLAGS directamente
 * ============================================================================
 */

/**
 * Verifica si el nuevo sistema de mensajería está activado.
 * USAR ESTA FUNCIÓN - Nunca acceder directamente a FLAGS.
 */
export function isNewMessagingEnabled(): boolean {
  return FLAGS.ENABLE_NEW_MESSAGE_SYSTEM;
}

/**
 * FASE 4: Verifica si el realtime optimizado con filtros está activado.
 * USAR ESTA FUNCIÓN - Nunca acceder directamente a FLAGS.
 */
export function isRealtimeFilteredEnabled(): boolean {
  return FLAGS.ENABLE_REALTIME_FILTERED;
}

/**
 * Verifica si las métricas de mensajería están habilitadas.
 */
export function isMessageMetricsEnabled(): boolean {
  return FLAGS.ENABLE_MESSAGE_METRICS;
}

/**
 * Verifica si el modo debug de mensajería está activo.
 */
export function isMessagingDebugEnabled(): boolean {
  return FLAGS.DEBUG_MESSAGING;
}

/**
 * FASE 5: Verifica si el Outbox Engine está habilitado.
 * Controla el sistema de retry confiable con backoff exponencial y DLQ.
 */
export function isOutboxEngineEnabled(): boolean {
  return FLAGS.ENABLE_OUTBOX_ENGINE;
}

/**
 * Obtiene el estado completo de todos los flags (para diagnóstico).
 * Útil para logging y debugging.
 */
export function getAllFeatureFlags(): Readonly<FeatureFlags> {
  return Object.freeze({ ...FLAGS });
}

/**
 * ============================================================================
 * UTILIDADES DE DESARROLLO
 * ============================================================================
 */

/**
 * Permite override temporal de flags en localStorage (solo development).
 * Útil para testing manual sin rebuild.
 */
export function setLocalFlagOverride<K extends keyof FeatureFlags>(
  key: K,
  value: FeatureFlags[K]
): void {
  if (typeof window === "undefined") return;
  if (import.meta.env?.PROD) {
    console.warn("[FeatureFlags] Override bloqueado en producción");
    return;
  }
  
  try {
    const current = JSON.parse(localStorage.getItem("ig_feature_flags_override") || "{}");
    current[key] = value;
    localStorage.setItem("ig_feature_flags_override", JSON.stringify(current));
    console.log(`[FeatureFlags] Override aplicado: ${key} = ${value}. Recargar para aplicar.`);
  } catch (e) {
    console.error("[FeatureFlags] Error aplicando override:", e);
  }
}

/**
 * Limpia todos los overrides de localStorage.
 */
export function clearLocalFlagOverrides(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("ig_feature_flags_override");
  console.log("[FeatureFlags] Overrides limpiados. Recargar para aplicar.");
}

/**
 * ============================================================================
 * INICIALIZACIÓN Y LOGGING
 * ============================================================================
 */

// Log de inicialización (solo una vez)
if (typeof window !== "undefined") {
  console.log("[FeatureFlags] Sistema inicializado:", {
    ENABLE_NEW_MESSAGE_SYSTEM: FLAGS.ENABLE_NEW_MESSAGE_SYSTEM,
    ENABLE_MESSAGE_METRICS: FLAGS.ENABLE_MESSAGE_METRICS,
    DEBUG_MESSAGING: FLAGS.DEBUG_MESSAGING,
    source: import.meta.env?.VITE_ENABLE_NEW_MESSAGE_SYSTEM !== undefined 
      ? "env" 
      : "default",
  });
  
  // Advertencia si el nuevo sistema está activo (fase de desarrollo)
  if (FLAGS.ENABLE_NEW_MESSAGE_SYSTEM) {
    console.warn(
      "[FeatureFlags] ⚠️ NUEVO SISTEMA DE MENSAJERÍA ACTIVADO. " +
      "Si ves comportamiento inesperado, desactivar inmediatamente."
    );
  }
}

export default FLAGS;