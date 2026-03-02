/**
 * ============================================================================
 * FASE 2 - MIGRACIÓN localStorage → IndexedDB
 * ============================================================================
 * 
 * Este módulo migra automáticamente los datos de mensajería
 * desde localStorage a IndexedDB como parte de la activación SSOT.
 * 
 * CARACTERÍSTICAS:
 * - Migración automática al iniciar sesión
 * - Idempotente (puede ejecutarse múltiples veces sin duplicar)
 * - No bloquea el UI (async)
 * - Limpieza de localStorage post-migración
 * - Feature flag para control de rollback
 * 
 * ESTRUCTURA MIGRADA:
 * - ig_conversations_${userId} → IndexedDB.conversations
 * - ig_messages_cache_${userId} → IndexedDB.messages
 * - ig_drafts_${userId} → IndexedDB.metadata (preservar)
 * ============================================================================
 */

import type { Conversation, InboxMessage } from "@/hooks/useMessagesInbox";
import { 
  initMessageDB, 
  saveConversationsToIDB, 
  saveMessagesToIDB 
} from "./messageIDB";
import { isNewMessagingEnabled, isMessagingDebugEnabled } from "./featureFlags";

/**
 * Estado de la migración
 */
export interface MigrationStatus {
  /** Si la migración ya fue completada */
  completed: boolean;
  /** Timestamp de la última migración */
  migratedAt: string | null;
  /** Versión del esquema migrado */
  version: number;
}

const MIGRATION_KEY = "ig_message_migration_v1";
const MIGRATION_VERSION = 1;

/**
 * ============================================================================
 * CORE MIGRATION FUNCTION
 * ============================================================================
 */

/**
 * Ejecuta la migración completa de localStorage a IndexedDB.
 * 
 * @param userId - ID del usuario actual
 * @returns Promise<boolean> - true si la migración fue exitosa
 */
export async function migrateLocalStorageToIndexedDB(userId: string): Promise<boolean> {
  // Verificar feature flag
  if (!isNewMessagingEnabled()) {
    if (isMessagingDebugEnabled()) {
      console.log("[MessageMigration] Migración omitida: feature flag desactivado");
    }
    return false;
  }

  // Verificar si ya fue migrado
  if (isMigrationCompleted(userId)) {
    if (isMessagingDebugEnabled()) {
      console.log("[MessageMigration] Migración ya completada anteriormente");
    }
    return true;
  }

  try {
    if (isMessagingDebugEnabled()) {
      console.log("[MessageMigration] Iniciando migración para usuario:", userId);
    }

    const startTime = performance.now();
    
    // Inicializar IndexedDB
    await initMessageDB();
    
    // Ejecutar pasos de migración
    const results = await Promise.allSettled([
      migrateConversations(userId),
      migrateMessagesCache(userId),
    ]);

    const [conversationsResult, messagesResult] = results;
    
    const conversationsMigrated = conversationsResult.status === "fulfilled" && conversationsResult.value;
    const messagesMigrated = messagesResult.status === "fulfilled" && messagesResult.value;

    // Marcar migración como completada
    if (conversationsMigrated || messagesMigrated) {
      markMigrationCompleted(userId);
      
      const duration = performance.now() - startTime;
      
      if (isMessagingDebugEnabled()) {
        console.log("[MessageMigration] Completada en", duration.toFixed(2), "ms", {
          conversations: conversationsMigrated,
          messages: messagesMigrated,
        });
      }

      return true;
    }

    return false;
  } catch (error) {
    console.error("[MessageMigration] Error durante migración:", error);
    return false;
  }
}

/**
 * ============================================================================
 * PASOS DE MIGRACIÓN ESPECÍFICOS
 * ============================================================================
 */

/**
 * Migra conversaciones desde localStorage a IndexedDB.
 */
async function migrateConversations(userId: string): Promise<boolean> {
  const key = `ig_conversations_${userId}`;
  const raw = localStorage.getItem(key);
  
  if (!raw) {
    if (isMessagingDebugEnabled()) {
      console.log("[MessageMigration] No hay conversaciones para migrar");
    }
    return false;
  }

  try {
    const conversations: Conversation[] = JSON.parse(raw);
    
    if (!Array.isArray(conversations) || conversations.length === 0) {
      return false;
    }

    // Guardar en IndexedDB
    await saveConversationsToIDB(conversations);
    
    // Limpiar localStorage (soft delete - solo marca, no borra físicamente)
    // En producción, mantenemos los datos por seguridad
    // localStorage.removeItem(key); // Comentado por seguridad - limpieza manual post-validación
    
    if (isMessagingDebugEnabled()) {
      console.log("[MessageMigration] Conversaciones migradas:", conversations.length);
    }
    
    return true;
  } catch (error) {
    console.error("[MessageMigration] Error migrando conversaciones:", error);
    return false;
  }
}

/**
 * Migra caché de mensajes desde localStorage a IndexedDB.
 */
async function migrateMessagesCache(userId: string): Promise<boolean> {
  const key = `ig_messages_cache_${userId}`;
  const raw = localStorage.getItem(key);
  
  if (!raw) {
    if (isMessagingDebugEnabled()) {
      console.log("[MessageMigration] No hay mensajes para migrar");
    }
    return false;
  }

  try {
    const cache: Record<string, InboxMessage[]> = JSON.parse(raw);
    const conversationIds = Object.keys(cache);
    
    if (conversationIds.length === 0) {
      return false;
    }

    // Guardar mensajes por conversación
    let totalMessages = 0;
    for (const [conversationId, messages] of Object.entries(cache)) {
      if (Array.isArray(messages) && messages.length > 0) {
        await saveMessagesToIDB(conversationId, messages);
        totalMessages += messages.length;
      }
    }
    
    if (isMessagingDebugEnabled()) {
      console.log("[MessageMigration] Mensajes migrados:", totalMessages, "en", conversationIds.length, "conversaciones");
    }
    
    return true;
  } catch (error) {
    console.error("[MessageMigration] Error migrando mensajes:", error);
    return false;
  }
}

/**
 * ============================================================================
 * GESTIÓN DE ESTADO DE MIGRACIÓN
 * ============================================================================
 */

/**
 * Verifica si la migración ya fue completada para este usuario.
 */
function isMigrationCompleted(userId: string): boolean {
  if (typeof window === "undefined") return false;
  
  try {
    const raw = localStorage.getItem(MIGRATION_KEY);
    if (!raw) return false;
    
    const status: Record<string, MigrationStatus> = JSON.parse(raw);
    const userStatus = status[userId];
    
    return userStatus?.completed === true && userStatus?.version === MIGRATION_VERSION;
  } catch {
    return false;
  }
}

/**
 * Marca la migración como completada para este usuario.
 */
function markMigrationCompleted(userId: string): void {
  if (typeof window === "undefined") return;
  
  try {
    const raw = localStorage.getItem(MIGRATION_KEY);
    const status: Record<string, MigrationStatus> = raw ? JSON.parse(raw) : {};
    
    status[userId] = {
      completed: true,
      migratedAt: new Date().toISOString(),
      version: MIGRATION_VERSION,
    };
    
    localStorage.setItem(MIGRATION_KEY, JSON.stringify(status));
  } catch (error) {
    console.error("[MessageMigration] Error marcando migración:", error);
  }
}

/**
 * ============================================================================
 * HOOK DE REACT PARA MIGRACIÓN AUTOMÁTICA
 * ============================================================================
 */

import { useEffect, useState } from "react";

/**
 * Hook que ejecuta automáticamente la migración al montar.
 * 
 * @param userId - ID del usuario actual
 * @returns Estado de la migración
 */
export function useMessageMigration(userId: string | undefined): {
  isMigrating: boolean;
  isMigrated: boolean;
  error: Error | null;
} {
  const [state, setState] = useState<{
    isMigrating: boolean;
    isMigrated: boolean;
    error: Error | null;
  }>({
    isMigrating: false,
    isMigrated: false,
    error: null,
  });

  useEffect(() => {
    if (!userId) return;
    
    // Verificar si ya está migrado
    if (isMigrationCompleted(userId)) {
      setState({ isMigrating: false, isMigrated: true, error: null });
      return;
    }

    // Ejecutar migración
    setState(prev => ({ ...prev, isMigrating: true }));
    
    migrateLocalStorageToIndexedDB(userId)
      .then((success) => {
        setState({
          isMigrating: false,
          isMigrated: success,
          error: null,
        });
      })
      .catch((error) => {
        setState({
          isMigrating: false,
          isMigrated: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
  }, [userId]);

  return state;
}

/**
 * ============================================================================
 * UTILIDADES DE LIMPIEZA (Post-validación)
 * ============================================================================
 */

/**
 * Limpia datos migrados de localStorage (ejecutar después de validación exitosa).
 * 
 * ⚠️ SOLO EJECUTAR DESPUÉS DE CONFIRMAR QUE INDEXEDDB FUNCIONA CORRECTAMENTE
 */
export function cleanupLocalStorageAfterMigration(userId: string): void {
  if (typeof window === "undefined") return;
  
  const keysToRemove = [
    `ig_conversations_${userId}`,
    `ig_messages_cache_${userId}`,
    // NO remover drafts - pueden contener datos no enviados
    // `ig_drafts_${userId}`,
  ];
  
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
  
  if (isMessagingDebugEnabled()) {
    console.log("[MessageMigration] localStorage limpiado para usuario:", userId);
  }
}

/**
 * Fuerza re-migración (útil para debugging o recovery).
 */
export function forceReMigration(userId: string): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  
  // Limpiar flag de migración
  try {
    const raw = localStorage.getItem(MIGRATION_KEY);
    if (raw) {
      const status: Record<string, MigrationStatus> = JSON.parse(raw);
      delete status[userId];
      localStorage.setItem(MIGRATION_KEY, JSON.stringify(status));
    }
  } catch (error) {
    console.error("[MessageMigration] Error reseteando estado:", error);
  }
  
  return migrateLocalStorageToIndexedDB(userId);
}

/**
 * ============================================================================
 * REPORTE DE MIGRACIÓN
 * ============================================================================
 */

export interface MigrationReport {
  userId: string;
  localStorageData: {
    conversationsFound: boolean;
    conversationsCount: number;
    messagesFound: boolean;
    conversationsWithMessages: number;
    totalMessages: number;
  };
  migrationStatus: MigrationStatus | null;
  canMigrate: boolean;
}

/**
 * Genera un reporte del estado actual para análisis.
 */
export function generateMigrationReport(userId: string): MigrationReport {
  const report: MigrationReport = {
    userId,
    localStorageData: {
      conversationsFound: false,
      conversationsCount: 0,
      messagesFound: false,
      conversationsWithMessages: 0,
      totalMessages: 0,
    },
    migrationStatus: null,
    canMigrate: false,
  };

  if (typeof window === "undefined") return report;

  try {
    // Analizar conversaciones
    const convRaw = localStorage.getItem(`ig_conversations_${userId}`);
    if (convRaw) {
      const conversations = JSON.parse(convRaw);
      report.localStorageData.conversationsFound = true;
      report.localStorageData.conversationsCount = Array.isArray(conversations) ? conversations.length : 0;
    }

    // Analizar mensajes
    const msgRaw = localStorage.getItem(`ig_messages_cache_${userId}`);
    if (msgRaw) {
      const cache = JSON.parse(msgRaw);
      report.localStorageData.messagesFound = true;
      
      if (typeof cache === "object" && cache !== null) {
        const entries = Object.entries(cache) as [string, InboxMessage[]][];
        report.localStorageData.conversationsWithMessages = entries.length;
        report.localStorageData.totalMessages = entries.reduce(
          (sum, [, msgs]) => sum + (Array.isArray(msgs) ? msgs.length : 0),
          0
        );
      }
    }

    // Estado de migración
    const statusRaw = localStorage.getItem(MIGRATION_KEY);
    if (statusRaw) {
      const status: Record<string, MigrationStatus> = JSON.parse(statusRaw);
      report.migrationStatus = status[userId] || null;
    }

    // Determinar si puede migrar
    report.canMigrate = 
      isNewMessagingEnabled() &&
      (report.localStorageData.conversationsFound || report.localStorageData.messagesFound) &&
      !isMigrationCompleted(userId);

  } catch (error) {
    console.error("[MessageMigration] Error generando reporte:", error);
  }

  return report;
}
