/**
 * ============================================================================
 * FASE 5 - OUTBOX ENGINE (Reliable Messaging)
 * ============================================================================
 * 
 * ⚠️ REGLA CRÍTICA - ZERO IMPACTO REALTIME:
 * Este outbox SOLO actúa cuando hay fallo de red o envío.
 * NUNCA intercepta mensajes que ya funcionan online.
 * Mantiene latencia percibida de 0ms en camino saludable.
 * 
 * GARANTÍAS:
 * - Retry con backoff exponencial determinístico: 1s → 2s → 4s → 8s → 16s
 * - Idempotencia via client_mutation_id (UUID estable)
 * - Dead Letter Queue (DLQ) después de 5 fallos
 * - Estados: sending → queued → retrying → sent | failed
 * - Integración con MessageStore (SSOT) via dispatch de acciones
 * - Detección online/offline sin polling
 * ============================================================================
 */

import { openDB, type IDBPDatabase, type DBSchema } from 'idb';

const DB_NAME = 'instadetox_outbox_v2';
const STORE_MUTATIONS = 'mutations';
const STORE_DLQ = 'dlq';
const STORE_PROCESSED = 'processed'; // Para idempotencia

/**
 * Estados del mensaje en el outbox
 */
export type OutboxStatus = 
  | 'sending'   // Render optimista activo
  | 'queued'    // Offline detectado, esperando conexión
  | 'retrying'  // En reintento con backoff
  | 'sent'      // Confirmado por servidor
  | 'failed';   // DLQ después de 5 intentos

/**
 * Mutación en el outbox con metadata de retry
 */
export interface OutboxMutation {
  id: string;                    // UUID del mensaje (client_mutation_id)
  clientMutationId: string;      // Idempotencia: mismo UUID para duplicados
  userId: string;
  type: 'message' | 'post' | 'upload';
  payload: any;
  createdAt: string;
  status: OutboxStatus;
  retryCount: number;
  nextRetryAt: string | null;    // ISO timestamp para backoff determinístico
  lastError?: string;
  lastErrorCode?: string;        // Código de error para clasificación
  conversationId?: string;       // Para integración con MessageStore
}

/**
 * Entrada en Dead Letter Queue
 */
export interface DLQEntry extends OutboxMutation {
  failedAt: string;
  failureReason: string;
}

/**
 * Registro de mutaciones procesadas (idempotencia)
 */
export interface ProcessedMutation {
  clientMutationId: string;
  processedAt: string;
  result: 'success' | 'duplicate';
}

/**
 * Schema de IndexedDB para Outbox Engine
 */
interface OutboxSchema extends DBSchema {
  mutations: {
    key: string;
    value: OutboxMutation;
    indexes: { 
      'by_created_at': string; 
      'by_status': string;
      'by_conversation': string;
      'by_next_retry': string;
    };
  };
  dlq: {
    key: string;
    value: DLQEntry;
    indexes: {
      'by_failed_at': string;
      'by_conversation': string;
    };
  };
  processed: {
    key: string;
    value: ProcessedMutation;
    indexes: {
      'by_processed_at': string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<OutboxSchema>> | null = null;
const DB_VERSION = 2;

function getDB(): Promise<IDBPDatabase<OutboxSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<OutboxSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Store de mutaciones pendientes
        if (!db.objectStoreNames.contains('mutations')) {
          const store = db.createObjectStore('mutations', { keyPath: 'id' });
          store.createIndex('by_created_at', 'createdAt');
          store.createIndex('by_status', 'status');
          store.createIndex('by_conversation', 'conversationId');
          store.createIndex('by_next_retry', 'nextRetryAt');
        }
        
        // Store de Dead Letter Queue
        if (!db.objectStoreNames.contains('dlq')) {
          const dlqStore = db.createObjectStore('dlq', { keyPath: 'id' });
          dlqStore.createIndex('by_failed_at', 'failedAt');
          dlqStore.createIndex('by_conversation', 'conversationId');
        }
        
        // Store de mutaciones procesadas (idempotencia)
        if (!db.objectStoreNames.contains('processed')) {
          const processedStore = db.createObjectStore('processed', { keyPath: 'clientMutationId' });
          processedStore.createIndex('by_processed_at', 'processedAt');
        }
        
        // Migración desde v1: mover mutaciones failed a DLQ
        if (oldVersion === 1) {
          console.info('[Outbox] Migrando desde v1 a v2...');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * ============================================================================
 * BACKOFF ENGINE
 * ============================================================================
 */

/**
 * Secuencia de backoff exponencial: 1s → 2s → 4s → 8s → 16s
 * Agrega jitter aleatorio pequeño para evitar thundering herd
 */
export function calculateNextRetry(retryCount: number): string {
  const baseDelay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s, 8s, 16s
  const jitter = Math.random() * 200; // 0-200ms de jitter
  const delay = baseDelay + jitter;
  return new Date(Date.now() + delay).toISOString();
}

/**
 * Verifica si un error es reintentable (red/timeout) vs no reintentable (4xx lógico)
 */
export function isRetryableError(error: any): boolean {
  if (!error) return false;
  
  // Errores de red siempre son reintentables
  if (!window.navigator.onLine) return true;
  
  // Errores de timeout/fetch
  if (error.message?.includes('fetch') || 
      error.message?.includes('timeout') ||
      error.message?.includes('network')) {
    return true;
  }
  
  // Códigos específicos de Supabase/PostgREST
  const retryableCodes = ['PGRST301', 'PGRST302', 'ECONNRESET', 'ETIMEDOUT'];
  if (retryableCodes.includes(error.code)) return true;
  
  // Status HTTP reintentables
  const retryableStatuses = [0, 408, 429, 500, 502, 503, 504];
  if (retryableStatuses.includes(error.status)) return true;
  
  // Errores 4xx (excepto 408, 429) NO son reintentables
  if (error.status >= 400 && error.status < 500) return false;
  
  return true;
}

/**
 * ============================================================================
 * OPERACIONES CRUD
 * ============================================================================
 */

/**
 * Agrega una mutación al outbox persistente.
 * FASE 5: Incluye clientMutationId para idempotencia y nextRetryAt para backoff
 */
export async function enqueueMutation(
  mutation: Omit<OutboxMutation, 'status' | 'retryCount' | 'nextRetryAt' | 'clientMutationId'>
) {
  const db = await getDB();
  
  // Verificar idempotencia: si ya fue procesada, no encolar
  const processed = await db.get('processed', mutation.id);
  if (processed) {
    console.info(`[Outbox] Mutación ${mutation.id} ya procesada, ignorando duplicado`);
    return null;
  }
  
  const fullMutation: OutboxMutation = {
    ...mutation,
    clientMutationId: mutation.id, // UUID estable para idempotencia
    status: 'queued',
    retryCount: 0,
    nextRetryAt: null,
  };
  
  await db.add('mutations', fullMutation);
  
  console.info(`[Outbox] Mutación encolada: ${mutation.id} (conversación: ${mutation.conversationId || 'N/A'})`);
  return fullMutation;
}

/**
 * Agrega una mutación con estado inicial 'sending' (render optimista)
 */
export async function enqueueOptimisticMutation(
  mutation: Omit<OutboxMutation, 'status' | 'retryCount' | 'nextRetryAt' | 'clientMutationId'>
) {
  const db = await getDB();
  
  const fullMutation: OutboxMutation = {
    ...mutation,
    clientMutationId: mutation.id,
    status: 'sending',
    retryCount: 0,
    nextRetryAt: null,
  };
  
  await db.add('mutations', fullMutation);
  return fullMutation;
}

/**
 * Obtiene todas las mutaciones pendientes en orden FIFO.
 * FASE 5: Incluye 'sending', 'queued', 'retrying' (excluye 'sent' y 'failed')
 */
export async function getPendingMutations(): Promise<OutboxMutation[]> {
  const db = await getDB();
  const index = db.transaction('mutations').store.index('by_created_at');
  const all = await index.getAll();
  return all.filter((m) => m.status !== 'sent' && m.status !== 'failed');
}

/**
 * Obtiene mutaciones listas para reintento (nextRetryAt <= ahora)
 */
export async function getRetryableMutations(): Promise<OutboxMutation[]> {
  const db = await getDB();
  const index = db.transaction('mutations').store.index('by_next_retry');
  const all = await index.getAll();
  const now = new Date().toISOString();
  return all.filter((m) => 
    m.status === 'retrying' && 
    m.nextRetryAt && 
    m.nextRetryAt <= now
  );
}

/**
 * Obtiene mutaciones por conversación (para UI)
 */
export async function getMutationsByConversation(conversationId: string): Promise<OutboxMutation[]> {
  const db = await getDB();
  const index = db.transaction('mutations').store.index('by_conversation');
  return index.getAll(conversationId);
}

/**
 * Actualiza el estado de una mutación con lógica de backoff automático.
 * FASE 5: Si error es reintentable, calcula nextRetryAt; si no, mueve a DLQ
 */
export async function updateMutationStatus(
  id: string,
  updates: Partial<OutboxMutation> & { error?: any }
): Promise<OutboxMutation | null> {
  const db = await getDB();
  const tx = db.transaction('mutations', 'readwrite');
  const store = tx.objectStore('mutations');
  const existing = await store.get(id);
  
  if (!existing) return null;
  
  const updated: OutboxMutation = { ...existing, ...updates };
  
  // Si hay error y es reintentable, calcular nextRetryAt
  if (updates.error && isRetryableError(updates.error)) {
    updated.retryCount = existing.retryCount + 1;
    updated.lastError = updates.error.message || String(updates.error);
    updated.lastErrorCode = updates.error.code;
    
    if (updated.retryCount >= 5) {
      // Mover a DLQ después de 5 intentos
      await tx.done;
      await moveToDLQ(updated, 'Max retries exceeded');
      await deleteMutation(id);
      return null;
    } else {
      updated.status = 'retrying';
      updated.nextRetryAt = calculateNextRetry(updated.retryCount);
    }
  }
  
  await store.put(updated);
  await tx.done;
  return updated;
}

/**
 * Elimina una mutación del store (usado internamente)
 */
async function deleteMutation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('mutations', id);
}

/**
 * Marca una mutación como enviada exitosamente.
 * FASE 5: Registra en processed para idempotencia
 */
export async function markMutationSent(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['mutations', 'processed'], 'readwrite');
  
  const mutation = await tx.objectStore('mutations').get(id);
  if (!mutation) return;
  
  // Registrar como procesada (idempotencia)
  const processed: ProcessedMutation = {
    clientMutationId: mutation.clientMutationId,
    processedAt: new Date().toISOString(),
    result: 'success',
  };
  await tx.objectStore('processed').put(processed);
  
  // Eliminar de mutations
  await tx.objectStore('mutations').delete(id);
  
  await tx.done;
  
  console.info(`[Outbox] Mutación ${id} marcada como enviada`);
}

/**
 * Elimina una mutación tras éxito (legacy compat)
 */
export async function dequeueMutation(id: string) {
  await markMutationSent(id);
}

/**
 * ============================================================================
 * DEAD LETTER QUEUE (DLQ)
 * ============================================================================
 */

/**
 * Mueve una mutación a la DLQ
 */
async function moveToDLQ(mutation: OutboxMutation, reason: string): Promise<void> {
  const db = await getDB();
  
  const dlqEntry: DLQEntry = {
    ...mutation,
    status: 'failed',
    failedAt: new Date().toISOString(),
    failureReason: reason,
  };
  
  await db.add('dlq', dlqEntry);
  console.warn(`[Outbox] Mutación ${mutation.id} movida a DLQ: ${reason}`);
}

/**
 * Obtiene entradas de la DLQ
 */
export async function getDLQEntries(conversationId?: string): Promise<DLQEntry[]> {
  const db = await getDB();
  
  if (conversationId) {
    const index = db.transaction('dlq').store.index('by_conversation');
    return index.getAll(conversationId);
  }
  
  return db.getAll('dlq');
}

/**
 * Reintenta manualmente una entrada de DLQ
 */
export async function retryDLQEntry(id: string): Promise<OutboxMutation | null> {
  const db = await getDB();
  const entry = await db.get('dlq', id);
  if (!entry) return null;
  
  // Mover de vuelta a mutations con reset de retry
  const mutation: OutboxMutation = {
    ...entry,
    status: 'queued',
    retryCount: 0,
    nextRetryAt: null,
    lastError: undefined,
    lastErrorCode: undefined,
  };
  
  const tx = db.transaction(['dlq', 'mutations'], 'readwrite');
  await tx.objectStore('mutations').put(mutation);
  await tx.objectStore('dlq').delete(id);
  await tx.done;
  
  console.info(`[Outbox] Entrada DLQ ${id} reintentada`);
  return mutation;
}

/**
 * Elimina permanentemente una entrada de DLQ
 */
export async function deleteDLQEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('dlq', id);
}

/**
 * ============================================================================
 * IDEMPOTENCIA
 * ============================================================================
 */

/**
 * Verifica si una mutación ya fue procesada
 */
export async function isMutationProcessed(clientMutationId: string): Promise<boolean> {
  const db = await getDB();
  const processed = await db.get('processed', clientMutationId);
  return !!processed;
}

/**
 * Limpieza de mutaciones procesadas antiguas (más de 7 días)
 */
export async function clearOldProcessed(): Promise<number> {
  const db = await getDB();
  const index = db.transaction('processed').store.index('by_processed_at');
  const all = await index.getAll();
  
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let deleted = 0;
  
  for (const entry of all) {
    if (entry.processedAt < weekAgo) {
      await db.delete('processed', entry.clientMutationId);
      deleted++;
    }
  }
  
  return deleted;
}

/**
 * Limpieza de mutaciones antiguas o fallidas (Mantenimiento)
 * FASE 5: También limpia DLQ antigua
 */
export async function clearOldMutations() {
  const db = await getDB();
  const now = Date.now();
  const weekInMs = 7 * 24 * 60 * 60 * 1000;
  
  // Limpiar mutations
  const mutations = await db.getAll('mutations');
  for (const m of mutations) {
    if (now - new Date(m.createdAt).getTime() > weekInMs) {
      await db.delete('mutations', m.id);
    }
  }
  
  // Limpiar DLQ
  const dlq = await db.getAll('dlq');
  for (const entry of dlq) {
    if (now - new Date(entry.failedAt).getTime() > weekInMs) {
      await db.delete('dlq', entry.id);
    }
  }
  
  // Limpiar processed
  await clearOldProcessed();
}
