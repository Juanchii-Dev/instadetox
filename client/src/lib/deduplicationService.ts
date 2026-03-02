/**
 * ============================================================================
 * FASE 1 - MESSAGE DEDUPLICATION SERVICE
 * ============================================================================
 * Servicio de deduplicación de mensajes usando IndexedDB como store persistente.
 *
 * Responsabilidades:
 * - Mantener registro persistente de message_ids procesados
 * - Evitar duplicados por eventos realtime repetidos
 * - Evitar duplicados por reintentos de red
 * - Evitar duplicados por race conditions entre fetch + subscription
 *
 * Reglas:
 * - Backend ID (message.id) es la fuente de verdad
 * - Si no existe aún (optimistic), usar clientMutationId si existe
 * - Fallback: hash determinístico (senderId + timestamp + content)
 * - O(1) lookup via IndexedDB
 * - TTL defensivo para prunning automático
 * - Totalmente reversible por feature flag
 * ============================================================================
 */

import { isMessagingDebugEnabled } from "./featureFlags";
import { messagingCounters } from "./messagingMetrics";

/**
 * Estructura de entrada en la base de datos de deduplicación
 */
interface DedupEntry {
  /** ID único del mensaje (UUID del backend o hash determinístico) */
  id: string;
  /** ID de la conversación a la que pertenece el mensaje */
  conversationId: string;
  /** Timestamp de registro (para TTL) */
  registeredAt: number;
  /** Timestamp del mensaje (para debugging) */
  messageTimestamp: string;
}

/**
 * Configuración del servicio de deduplicación
 */
const DEDUP_CONFIG = {
  /** Nombre de la base de datos IndexedDB */
  DB_NAME: "instadetox_dedup_v1",
  /** Nombre del object store */
  STORE_NAME: "processed_messages",
  /** Versión de la base de datos */
  DB_VERSION: 1,
  /** TTL máximo en milisegundos (7 días) */
  MAX_TTL_MS: 7 * 24 * 60 * 60 * 1000,
  /** Límite de entradas antes de forzar prune */
  MAX_ENTRIES: 10000,
  /** Entradas a mantener tras prune agresivo */
  PRUNE_TARGET: 5000,
} as const;

/**
 * Estado interno del servicio
 */
interface DedupState {
  /** Indica si la base de datos está inicializada */
  isInitialized: boolean;
  /** Referencia a la base de datos IndexedDB */
  db: IDBDatabase | null;
  /** Contador de operaciones pendientes para debug */
  pendingOps: number;
}

const state: DedupState = {
  isInitialized: false,
  db: null,
  pendingOps: 0,
};

/**
 * ============================================================================
 * INICIALIZACIÓN
 * ============================================================================
 */

/**
 * Inicializa la base de datos IndexedDB para deduplicación.
 * Idempotente - puede llamarse múltiples veces sin efectos secundarios.
 */
async function initDB(): Promise<IDBDatabase | null> {
  if (state.isInitialized && state.db) {
    return state.db;
  }

  if (typeof window === "undefined" || !window.indexedDB) {
    if (isMessagingDebugEnabled()) {
      console.warn("[DedupService] IndexedDB no disponible, deduplicación desactivada");
    }
    return null;
  }

  try {
    const request = indexedDB.open(DEDUP_CONFIG.DB_NAME, DEDUP_CONFIG.DB_VERSION);

    request.onerror = () => {
      if (isMessagingDebugEnabled()) {
        console.error("[DedupService] Error al abrir IndexedDB:", request.error);
      }
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Crear object store con keyPath = id
      if (!db.objectStoreNames.contains(DEDUP_CONFIG.STORE_NAME)) {
        const store = db.createObjectStore(DEDUP_CONFIG.STORE_NAME, { keyPath: "id" });

        // Índice para búsqueda por conversationId (para clearConversation)
        store.createIndex("conversationId", "conversationId", { unique: false });

        // Índice para TTL pruning
        store.createIndex("registeredAt", "registeredAt", { unique: false });

        if (isMessagingDebugEnabled()) {
          console.log("[DedupService] Object store creado:", DEDUP_CONFIG.STORE_NAME);
        }
      }
    };

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    state.db = db;
    state.isInitialized = true;

    if (isMessagingDebugEnabled()) {
      console.log("[DedupService] IndexedDB inicializada correctamente");
    }

    return db;
  } catch (error) {
    if (isMessagingDebugEnabled()) {
      console.error("[DedupService] Fallo al inicializar IndexedDB:", error);
    }
    return null;
  }
}

/**
 * ============================================================================
 * ID RESOLUTION
 * ============================================================================
 */

/**
 * Genera un ID determinístico para deduplicación basado en el contenido del mensaje.
 * Usado como fallback cuando no hay ID del backend ni clientMutationId.
 */
function generateDeterministicId(
  senderId: string,
  timestamp: string,
  content: string
): string {
  // Normalizar contenido para hash consistente
  const normalized = content.trim().toLowerCase();
  const seed = `${senderId}:${timestamp}:${normalized}`;

  // Simple hash FNV-1a para generar ID determinístico
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  // Convertir a hex string y combinar con timestamp para unicidad
  const hashHex = (hash >>> 0).toString(16).padStart(8, "0");
  return `det:${senderId.slice(0, 8)}:${timestamp.slice(0, 19)}:${hashHex}`;
}

/**
 * Interface para mensajes que pueden ser deduplicados
 */
export interface DeduplicatableMessage {
  /** ID del mensaje (del backend) - preferido para dedup */
  id?: string;
  /** ID temporal para optimistic updates */
  clientMutationId?: string;
  /** ID de la conversación */
  conversationId: string;
  /** ID del remitente */
  senderId: string;
  /** Timestamp del mensaje */
  createdAt: string;
  /** Contenido del mensaje (para hash determinístico) */
  body: string;
}

/**
 * Resuelve el ID a usar para deduplicación siguiendo la jerarquía:
 * 1. Backend ID (message.id) - fuente de verdad
 * 2. clientMutationId (optimistic)
 * 3. Hash determinístico (fallback)
 */
export function resolveDedupId(message: DeduplicatableMessage): string {
  // Prioridad 1: Backend ID
  if (message.id && message.id.length > 0) {
    return message.id;
  }

  // Prioridad 2: clientMutationId (optimistic)
  if (message.clientMutationId && message.clientMutationId.length > 0) {
    return message.clientMutationId;
  }

  // Prioridad 3: Hash determinístico
  return generateDeterministicId(
    message.senderId,
    message.createdAt,
    message.body
  );
}

/**
 * ============================================================================
 * API PÚBLICA
 * ============================================================================
 */

/**
 * Verifica si un mensaje ya fue procesado (duplicado).
 * O(1) lookup vía IndexedDB.
 */
export async function has(messageId: string): Promise<boolean> {
  const db = await initDB();
  if (!db) return false; // Si no hay DB, asumir no duplicado

  return new Promise((resolve) => {
    const transaction = db.transaction([DEDUP_CONFIG.STORE_NAME], "readonly");
    const store = transaction.objectStore(DEDUP_CONFIG.STORE_NAME);
    const request = store.get(messageId);

    request.onsuccess = () => {
      resolve(request.result !== undefined);
    };

    request.onerror = () => {
      if (isMessagingDebugEnabled()) {
        console.error("[DedupService] Error en has():", request.error);
      }
      resolve(false); // En caso de error, asumir no duplicado
    };
  });
}

/**
 * Registra un mensaje como procesado.
 * Idempotente - registrar el mismo ID múltiples veces es seguro.
 */
export async function register(
  messageId: string,
  conversationId: string,
  messageTimestamp: string
): Promise<void> {
  const db = await initDB();
  if (!db) return;

  const entry: DedupEntry = {
    id: messageId,
    conversationId,
    registeredAt: Date.now(),
    messageTimestamp,
  };

  return new Promise((resolve) => {
    const transaction = db.transaction([DEDUP_CONFIG.STORE_NAME], "readwrite");
    const store = transaction.objectStore(DEDUP_CONFIG.STORE_NAME);
    const request = store.put(entry); // put = upsert

    request.onsuccess = () => {
      if (isMessagingDebugEnabled()) {
        console.log("[DedupService] Mensaje registrado:", messageId);
      }
      resolve();
    };

    request.onerror = () => {
      if (isMessagingDebugEnabled()) {
        console.error("[DedupService] Error en register():", request.error);
      }
      resolve(); // No fallar por error de dedup
    };
  });
}

/**
 * Limpia todas las entradas de una conversación específica.
 * Útil al salir de una conversación para liberar espacio.
 */
export async function clearConversation(conversationId: string): Promise<void> {
  const db = await initDB();
  if (!db) return;

  return new Promise((resolve) => {
    const transaction = db.transaction([DEDUP_CONFIG.STORE_NAME], "readwrite");
    const store = transaction.objectStore(DEDUP_CONFIG.STORE_NAME);
    const index = store.index("conversationId");
    const request = index.openCursor(IDBKeyRange.only(conversationId));

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        if (isMessagingDebugEnabled()) {
          console.log("[DedupService] Conversación limpiada:", conversationId);
        }
        resolve();
      }
    };

    request.onerror = () => {
      if (isMessagingDebugEnabled()) {
        console.error("[DedupService] Error en clearConversation():", request.error);
      }
      resolve();
    };
  });
}

/**
 * Elimina entradas antiguas basadas en TTL.
 * Mantiene máximo MAX_ENTRIES para evitar crecimiento ilimitado.
 */
export async function pruneOldEntries(): Promise<number> {
  const db = await initDB();
  if (!db) return 0;

  const cutoff = Date.now() - DEDUP_CONFIG.MAX_TTL_MS;
  let deletedCount = 0;

  // Paso 1: Eliminar por TTL
  await new Promise<void>((resolve) => {
    const transaction = db.transaction([DEDUP_CONFIG.STORE_NAME], "readwrite");
    const store = transaction.objectStore(DEDUP_CONFIG.STORE_NAME);
    const index = store.index("registeredAt");
    const request = index.openCursor(IDBKeyRange.upperBound(cutoff));

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
      if (cursor) {
        cursor.delete();
        deletedCount++;
        cursor.continue();
      } else {
        resolve();
      }
    };

    request.onerror = () => resolve();
  });

  // Paso 2: Si aún hay demasiadas entradas, hacer prune agresivo
  const count = await new Promise<number>((resolve) => {
    const transaction = db.transaction([DEDUP_CONFIG.STORE_NAME], "readonly");
    const store = transaction.objectStore(DEDUP_CONFIG.STORE_NAME);
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(0);
  });

  if (count > DEDUP_CONFIG.MAX_ENTRIES) {
    // Eliminar las entradas más antiguas hasta llegar a PRUNE_TARGET
    const toDelete = count - DEDUP_CONFIG.PRUNE_TARGET;

    await new Promise<void>((resolve) => {
      const transaction = db.transaction([DEDUP_CONFIG.STORE_NAME], "readwrite");
      const store = transaction.objectStore(DEDUP_CONFIG.STORE_NAME);
      const index = store.index("registeredAt");
      const request = index.openCursor();
      let deleted = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
        if (cursor && deleted < toDelete) {
          cursor.delete();
          deleted++;
          deletedCount++;
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => resolve();
    });
  }

  if (isMessagingDebugEnabled() && deletedCount > 0) {
    console.log("[DedupService] Prune completado, eliminados:", deletedCount);
  }

  return deletedCount;
}

/**
 * ============================================================================
 * API DE ALTO NIVEL
 * ============================================================================
 */

/**
 * Procesa un mensaje entrante aplicando deduplicación.
 * Retorna true si el mensaje debe ser procesado (no es duplicado),
 * false si debe ser ignorado.
 *
 * Esta es la función principal para uso en gateways.
 */
export async function processIncomingMessage(
  message: DeduplicatableMessage
): Promise<boolean> {
  const dedupId = resolveDedupId(message);

  // Check O(1) si ya existe
  const isDuplicate = await has(dedupId);

  if (isDuplicate) {
    // Registrar métrica de deduplicación
    messagingCounters.messageDeduplicated();

    if (isMessagingDebugEnabled()) {
      console.log("[DedupService] Mensaje duplicado ignorado:", dedupId);
    }

    return false; // Ignorar duplicado
  }

  // Registrar como procesado
  await register(dedupId, message.conversationId, message.createdAt);

  return true; // Procesar mensaje
}

/**
 * ============================================================================
 * UTILIDADES DE DIAGNÓSTICO
 * ============================================================================
 */

/**
 * Obtiene estadísticas del servicio de deduplicación.
 * Útil para debugging y monitoreo.
 */
export async function getStats(): Promise<{
  totalEntries: number;
  isInitialized: boolean;
  dbName: string;
  storeName: string;
} | null> {
  const db = await initDB();
  if (!db) return null;

  const count = await new Promise<number>((resolve) => {
    const transaction = db.transaction([DEDUP_CONFIG.STORE_NAME], "readonly");
    const store = transaction.objectStore(DEDUP_CONFIG.STORE_NAME);
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(0);
  });

  return {
    totalEntries: count,
    isInitialized: state.isInitialized,
    dbName: DEDUP_CONFIG.DB_NAME,
    storeName: DEDUP_CONFIG.STORE_NAME,
  };
}

/**
 * Limpia completamente la base de datos de deduplicación.
 * Útil para testing o reset completo.
 */
export async function clearAll(): Promise<void> {
  const db = await initDB();
  if (!db) return;

  return new Promise((resolve) => {
    const transaction = db.transaction([DEDUP_CONFIG.STORE_NAME], "readwrite");
    const store = transaction.objectStore(DEDUP_CONFIG.STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      if (isMessagingDebugEnabled()) {
        console.log("[DedupService] Base de datos limpiada completamente");
      }
      resolve();
    };

    request.onerror = () => resolve();
  });
}

/**
 * ============================================================================
 * EXPORTS
 * ============================================================================
 */

export const deduplicationService = {
  has,
  register,
  clearConversation,
  pruneOldEntries,
  processIncomingMessage,
  resolveDedupId,
  getStats,
  clearAll,
} as const;

export default deduplicationService;
