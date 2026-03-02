/**
 * ============================================================================
 * FASE 1 - MESSAGE INDEXEDDB LAYER (Shadow Mode)
 * ============================================================================
 * 
 * ⚠️ REGLA CRÍTICA - MODO SHADOW:
 * Esta capa de persistencia funciona en PARALELO al localStorage actual.
 * NO reemplaza localStorage aún.
 * NO cambia flujos actuales.
 * Solo captura snapshots del MessageStore.
 * 
 * PRINCIPIO:
 * - Guardar snapshot del estado normalizado en IndexedDB
 * - NO usar para lectura en producción (aún)
 * - Solo para validación de consistencia y eventual migración
 * 
 * NO MODIFICAR:
 * - Lógica de localStorage existente
 * - Flujo de carga de mensajes
 * ============================================================================
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Conversation, InboxMessage } from "@/hooks/useMessagesInbox";
import { isMessagingDebugEnabled } from "./featureFlags";

/**
 * ============================================================================
 * SCHEMA DE INDEXEDDB
 * ============================================================================
 */
interface MessageDBSchema extends DBSchema {
  conversations: {
    key: string;
    value: Conversation;
    indexes: {
      "by-updated": string;
    };
  };
  messages: {
    key: string;
    value: InboxMessage & { _key: string; _conversationId: string };
    indexes: {
      "by-conversation": string;
      "by-created": string;
    };
  };
  metadata: {
    key: string;
    value: {
      key: string;
      value: unknown;
      updatedAt: string;
    };
  };
  syncLog: {
    key: number;
    value: {
      id?: number;
      operation: "save" | "load" | "clear";
      timestamp: string;
      recordCount: number;
      duration: number;
    };
  };
}

type MessageDB = IDBPDatabase<MessageDBSchema>;

/**
 * ============================================================================
 * CONFIGURACIÓN
 * ============================================================================
 */
const DB_NAME = "instadetox_messages_v1";
const DB_VERSION = 1;
const SYNC_LOG_LIMIT = 100;

/**
 * ============================================================================
 * INICIALIZACIÓN
 * ============================================================================
 */
let dbPromise: Promise<MessageDB> | null = null;

export async function initMessageDB(): Promise<MessageDB> {
  if (dbPromise) return dbPromise;
  
  dbPromise = openDB<MessageDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Conversaciones
      if (!db.objectStoreNames.contains("conversations")) {
        const convStore = db.createObjectStore("conversations", { keyPath: "id" });
        convStore.createIndex("by-updated", "updatedAt", { unique: false });
      }
      
      // Mensajes
      if (!db.objectStoreNames.contains("messages")) {
        const msgStore = db.createObjectStore("messages", { keyPath: "_key" });
        msgStore.createIndex("by-conversation", "_conversationId", { unique: false });
        msgStore.createIndex("by-created", "createdAt", { unique: false });
      }
      
      // Metadata
      if (!db.objectStoreNames.contains("metadata")) {
        db.createObjectStore("metadata", { keyPath: "key" });
      }
      
      // Sync Log
      if (!db.objectStoreNames.contains("syncLog")) {
        db.createObjectStore("syncLog", { keyPath: "id", autoIncrement: true });
      }
    },
  });
  
  return dbPromise;
}

/**
 * ============================================================================
 * OPERACIONES DE CONVERSACIONES
 * ============================================================================
 */

/** Guarda todas las conversaciones (bulk) */
export async function saveConversationsToIDB(
  conversations: Conversation[]
): Promise<void> {
  const db = await initMessageDB();
  const tx = db.transaction("conversations", "readwrite");
  const store = tx.objectStore("conversations");
  
  // Clear and bulk put
  await store.clear();
  
  for (const conv of conversations) {
    await store.put(conv);
  }
  
  await tx.done;
  
  await logSyncOperation("save", conversations.length);
  
  if (isMessagingDebugEnabled()) {
    console.log("[MessageIDB] Conversaciones guardadas:", conversations.length);
  }
}

/** Carga todas las conversaciones */
export async function loadConversationsFromIDB(): Promise<Conversation[]> {
  const db = await initMessageDB();
  const tx = db.transaction("conversations", "readonly");
  const store = tx.objectStore("conversations");
  
  const start = performance.now();
  const conversations = await store.getAll();
  const duration = performance.now() - start;
  
  await logSyncOperation("load", conversations.length, duration);
  
  // Ordenar por updatedAt desc
  conversations.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  
  if (isMessagingDebugEnabled()) {
    console.log("[MessageIDB] Conversaciones cargadas:", conversations.length);
  }
  
  return conversations;
}

/**
 * ============================================================================
 * OPERACIONES DE MENSAJES
 * ============================================================================
 */

/** Guarda mensajes de una conversación (bulk) */
export async function saveMessagesToIDB(
  conversationId: string,
  messages: InboxMessage[]
): Promise<void> {
  const db = await initMessageDB();
  const tx = db.transaction("messages", "readwrite");
  const store = tx.objectStore("messages");
  
  // Borrar mensajes existentes de esta conversación
  const index = store.index("by-conversation");
  const existingKeys = await index.getAllKeys(IDBKeyRange.only(conversationId));
  
  for (const key of existingKeys) {
    await store.delete(key);
  }
  
  // Guardar nuevos mensajes
  for (const msg of messages) {
    await store.put({
      ...msg,
      _key: `${conversationId}:${msg.id}`,
      _conversationId: conversationId,
    });
  }
  
  await tx.done;
  
  if (isMessagingDebugEnabled()) {
    console.log(`[MessageIDB] Mensajes guardados para ${conversationId}:`, messages.length);
  }
}

/** Carga mensajes de una conversación */
export async function loadMessagesFromIDB(
  conversationId: string
): Promise<InboxMessage[]> {
  const db = await initMessageDB();
  const tx = db.transaction("messages", "readonly");
  const store = tx.objectStore("messages");
  const index = store.index("by-conversation");
  
  const results = await index.getAll(IDBKeyRange.only(conversationId));
  
  // Remover campos internos
  const messages = results.map(({ _key, _conversationId, ...msg }) => msg as InboxMessage);
  
  // Ordenar por createdAt
  messages.sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  
  if (isMessagingDebugEnabled()) {
    console.log(`[MessageIDB] Mensajes cargados para ${conversationId}:`, messages.length);
  }
  
  return messages;
}

/**
 * ============================================================================
 * SNAPSHOT COMPLETO (para auditoría)
 * ============================================================================
 */

export interface MessageDBSnapshot {
  conversations: Conversation[];
  messagesByConversation: Record<string, InboxMessage[]>;
  metadata: {
    lastSyncAt: string | null;
    savedAt: string;
  };
}

/** Guarda snapshot completo del estado */
export async function saveSnapshotToIDB(params: {
  conversations: Conversation[];
  messagesByConversation: Record<string, InboxMessage[]>;
  lastSyncAt: string | null;
}): Promise<void> {
  const start = performance.now();
  
  // Guardar conversaciones
  await saveConversationsToIDB(params.conversations);
  
  // Guardar mensajes por conversación
  for (const [convId, messages] of Object.entries(params.messagesByConversation)) {
    await saveMessagesToIDB(convId, messages);
  }
  
  // Guardar metadata
  const db = await initMessageDB();
  const tx = db.transaction("metadata", "readwrite");
  const store = tx.objectStore("metadata");
  
  await store.put({
    key: "lastSnapshotAt",
    value: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  
  await store.put({
    key: "lastSyncAt",
    value: params.lastSyncAt,
    updatedAt: new Date().toISOString(),
  });
  
  await tx.done;
  
  const duration = performance.now() - start;
  
  if (isMessagingDebugEnabled()) {
    console.log("[MessageIDB] Snapshot guardado en", duration.toFixed(2), "ms");
  }
}

/** Carga snapshot completo (para comparación/auditoría) */
export async function loadSnapshotFromIDB(): Promise<MessageDBSnapshot | null> {
  const db = await initMessageDB();
  
  // Verificar si hay datos
  const tx = db.transaction("metadata", "readonly");
  const metaStore = tx.objectStore("metadata");
  const lastSnapshot = await metaStore.get("lastSnapshotAt");
  
  if (!lastSnapshot) {
    return null;
  }
  
  // Cargar conversaciones
  const conversations = await loadConversationsFromIDB();
  
  // Cargar mensajes para cada conversación
  const messagesByConversation: Record<string, InboxMessage[]> = {};
  for (const conv of conversations) {
    messagesByConversation[conv.id] = await loadMessagesFromIDB(conv.id);
  }
  
  // Cargar metadata
  const lastSyncMeta = await metaStore.get("lastSyncAt");
  
  return {
    conversations,
    messagesByConversation,
    metadata: {
      lastSyncAt: lastSyncMeta?.value as string | null,
      savedAt: lastSnapshot.value as string,
    },
  };
}

/**
 * ============================================================================
 * SYNC LOG (para auditoría y debugging)
 * ============================================================================
 */

async function logSyncOperation(
  operation: "save" | "load" | "clear",
  recordCount: number,
  duration: number = 0
): Promise<void> {
  const db = await initMessageDB();
  const tx = db.transaction("syncLog", "readwrite");
  const store = tx.objectStore("syncLog");
  
  await store.put({
    operation,
    timestamp: new Date().toISOString(),
    recordCount,
    duration,
  });
  
  // Prune old logs
  const allLogs = await store.getAll();
  if (allLogs.length > SYNC_LOG_LIMIT) {
    const toDelete = allLogs.slice(0, allLogs.length - SYNC_LOG_LIMIT);
    for (const log of toDelete) {
      if (log.id != null) {
        await store.delete(log.id!);
      }
    }
  }
  
  await tx.done;
}

/** Obtiene logs de sincronización para debugging */
export async function getSyncLogs(
  limit: number = 50
): Promise<Array<{
  id?: number;
  operation: string;
  timestamp: string;
  recordCount: number;
  duration: number;
}>> {
  const db = await initMessageDB();
  const tx = db.transaction("syncLog", "readonly");
  const store = tx.objectStore("syncLog");
  
  const logs = await store.getAll();
  
  return logs
    .filter((log) => log.id != null)
    .sort((a, b) => b.id! - a.id!)
    .slice(0, limit) as Array<{
    id: number;
    operation: string;
    timestamp: string;
    recordCount: number;
    duration: number;
  }>;
}

/**
 * ============================================================================
 * LIMPIEZA
 * ============================================================================
 */

/** Limpia toda la base de datos (logout/reset) */
export async function clearMessageDB(): Promise<void> {
  const db = await initMessageDB();
  
  const tx = db.transaction(
    ["conversations", "messages", "metadata", "syncLog"],
    "readwrite"
  );
  
  await tx.objectStore("conversations").clear();
  await tx.objectStore("messages").clear();
  await tx.objectStore("metadata").clear();
  await tx.objectStore("syncLog").clear();
  
  await tx.done;
  
  await logSyncOperation("clear", 0);
  
  if (isMessagingDebugEnabled()) {
    console.log("[MessageIDB] Base de datos limpiada");
  }
}

/** Limpia datos de una conversación específica */
export async function clearConversationFromIDB(
  conversationId: string
): Promise<void> {
  const db = await initMessageDB();
  const tx = db.transaction(["conversations", "messages"], "readwrite");
  
  // Eliminar conversación
  await tx.objectStore("conversations").delete(conversationId);
  
  // Eliminar mensajes
  const msgStore = tx.objectStore("messages");
  const index = msgStore.index("by-conversation");
  const keys = await index.getAllKeys(IDBKeyRange.only(conversationId));
  
  for (const key of keys) {
    await msgStore.delete(key);
  }
  
  await tx.done;
  
  if (isMessagingDebugEnabled()) {
    console.log(`[MessageIDB] Conversación limpiada: ${conversationId}`);
  }
}

/**
 * ============================================================================
 * ESTADÍSTICAS
 * ============================================================================
 */

export interface MessageDBStats {
  conversationsCount: number;
  messagesCount: number;
  lastSyncAt: string | null;
  lastSnapshotAt: string | null;
  dbSize: number; // Aproximado
}

/** Obtiene estadísticas de la base de datos */
export async function getMessageDBStats(): Promise<MessageDBStats> {
  const db = await initMessageDB();
  
  const tx = db.transaction(
    ["conversations", "messages", "metadata"],
    "readonly"
  );
  
  const [conversations, messages, lastSyncMeta, lastSnapshotMeta] = await Promise.all([
    tx.objectStore("conversations").count(),
    tx.objectStore("messages").count(),
    tx.objectStore("metadata").get("lastSyncAt"),
    tx.objectStore("metadata").get("lastSnapshotAt"),
  ]);
  
  // Estimación aproximada del tamaño
  const convSize = conversations * 500; // ~500 bytes por conversación
  const msgSize = messages * 2000; // ~2KB por mensaje
  
  return {
    conversationsCount: conversations,
    messagesCount: messages,
    lastSyncAt: lastSyncMeta?.value as string | null,
    lastSnapshotAt: lastSnapshotMeta?.value as string | null,
    dbSize: convSize + msgSize,
  };
}
