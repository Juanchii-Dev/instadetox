/**
 * ============================================================================
 * FASE 1 - MESSAGE AUDIT SYSTEM (Auditoría de Divergencia)
 * ============================================================================
 * 
 * ⚠️ REGLA CRÍTICA:
 * Este sistema NO corrige automáticamente divergencias.
 * Solo DETECTA y REPORTA diferencias entre Legacy y MessageStore.
 * 
 * PRINCIPIO:
 * - Comparar estado Legacy vs MessageStore periódicamente
 * - Reportar divergencias sin intervenir
 * - Métricas de consistencia para validación de Fase 1
 * 
 * NO MODIFICAR:
 * - Estado de ningún sistema
 * - Lógica de sincronización
 * ============================================================================
 */

import { useEffect } from "react";
import { useMessageStore, type MessageStoreState } from "./messageStore";
import type { Conversation, InboxMessage } from "@/hooks/useMessagesInbox";
import { isMessagingDebugEnabled } from "./featureFlags";

/**
 * ============================================================================
 * TIPOS DE DIVERGENCIA
 * ============================================================================
 */
export type DivergenceType = 
  | "missing_conversation_in_store"
  | "missing_conversation_in_legacy"
  | "missing_message_in_store"
  | "missing_message_in_legacy"
  | "state_mismatch"
  | "unread_count_mismatch";

export interface DivergenceItem {
  type: DivergenceType;
  conversationId?: string;
  messageId?: string;
  legacyValue?: unknown;
  storeValue?: unknown;
  description: string;
}

export interface AuditReport {
  timestamp: string;
  hasDivergence: boolean;
  totalDivergences: number;
  byType: Record<DivergenceType, number>;
  items: DivergenceItem[];
  legacyStats: {
    conversationsCount: number;
    messagesCount: number;
    unreadCounts: Record<string, number>;
  };
  storeStats: {
    conversationsCount: number;
    messagesCount: number;
    unreadCounts: Record<string, number>;
  };
}

/**
 * ============================================================================
 * CONFIGURACIÓN DE AUDITORÍA
 * ============================================================================
 */
const AUDIT_CONFIG = {
  /** Tamaño máximo del historial de reportes */
  MAX_HISTORY: 100,
  /** Intervalo mínimo entre auditorías (ms) */
  MIN_INTERVAL: 5000,
};

/**
 * ============================================================================
 * HISTORIAL DE AUDITORÍA
 * ============================================================================
 */
let auditHistory: AuditReport[] = [];
let lastAuditTime = 0;

/**
 * ============================================================================
 * FUNCIÓN PRINCIPAL DE AUDITORÍA
 * ============================================================================
 */
export function auditMessageStoreDivergence(params: {
  legacyConversations: Conversation[];
  legacyMessagesByConversation: Record<string, InboxMessage[]>;
  legacyUnreadCounts: Record<string, number>;
}): AuditReport {
  const now = Date.now();
  
  // Throttling
  if (now - lastAuditTime < AUDIT_CONFIG.MIN_INTERVAL) {
    return auditHistory[auditHistory.length - 1] ?? createEmptyReport();
  }
  
  lastAuditTime = now;
  
  const store = useMessageStore.getState();
  const divergences: DivergenceItem[] = [];
  
  // === AUDIT 1: CONVERSACIONES ===
  const legacyConvIdsForAudit = params.legacyConversations.map(c => c.id);
  const storeConvIdsForAudit = Object.keys(store.conversationsById);
  const legacyConvSet = new Set(legacyConvIdsForAudit);
  const storeConvSet = new Set(storeConvIdsForAudit);
  
  // Conversaciones en legacy pero no en store
  for (const conv of params.legacyConversations) {
    if (!storeConvSet.has(conv.id)) {
      divergences.push({
        type: "missing_conversation_in_store",
        conversationId: conv.id,
        legacyValue: conv,
        description: `Conversación ${conv.id} existe en legacy pero no en MessageStore`,
      });
    }
  }
  
  // Conversaciones en store pero no en legacy
  for (const id of storeConvIdsForAudit) {
    if (!legacyConvSet.has(id)) {
      divergences.push({
        type: "missing_conversation_in_legacy",
        conversationId: id,
        storeValue: store.conversationsById[id],
        description: `Conversación ${id} existe en MessageStore pero no en legacy`,
      });
    }
  }
  
  // === AUDIT 2: MENSAJES ===
  const legacyMsgConvIds = Object.keys(params.legacyMessagesByConversation);
  const storeMsgConvIds = Object.keys(store.messagesByConversation);
  const allConvIds = Array.from(new Set(legacyMsgConvIds.concat(storeMsgConvIds)));
  
  for (const convId of allConvIds) {
    const legacyMsgs = params.legacyMessagesByConversation[convId] ?? [];
    const storeMsgs = store.messagesByConversation[convId] ?? [];
    
    const legacyMsgIds = legacyMsgs.map(m => m.id);
    const storeMsgIds = storeMsgs.map(m => m.id);
    const legacyMsgSet = new Set(legacyMsgIds);
    const storeMsgSet = new Set(storeMsgIds);
    
    // Mensajes en legacy pero no en store
    for (const msg of legacyMsgs) {
      if (!storeMsgSet.has(msg.id)) {
        divergences.push({
          type: "missing_message_in_store",
          conversationId: convId,
          messageId: msg.id,
          legacyValue: msg,
          description: `Mensaje ${msg.id} en conversación ${convId} existe en legacy pero no en MessageStore`,
        });
      }
    }
    
    // Mensajes en store pero no en legacy
    for (const msg of storeMsgs) {
      if (!legacyMsgSet.has(msg.id)) {
        divergences.push({
          type: "missing_message_in_legacy",
          conversationId: convId,
          messageId: msg.id,
          storeValue: msg,
          description: `Mensaje ${msg.id} en conversación ${convId} existe en MessageStore pero no en legacy`,
        });
      }
    }
  }
  
  // === AUDIT 3: UNREAD COUNTS ===
  const legacyUnreadIds = Object.keys(params.legacyUnreadCounts);
  const storeUnreadIds = Object.keys(store.unreadCounts);
  const allUnreadIds = Array.from(new Set(legacyUnreadIds.concat(storeUnreadIds)));
  
  for (const convId of allUnreadIds) {
    const legacyCount = params.legacyUnreadCounts[convId] ?? 0;
    const storeCount = store.unreadCounts[convId] ?? 0;
    
    if (legacyCount !== storeCount) {
      divergences.push({
        type: "unread_count_mismatch",
        conversationId: convId,
        legacyValue: legacyCount,
        storeValue: storeCount,
        description: `Unread count mismatch en conversación ${convId}: legacy=${legacyCount}, store=${storeCount}`,
      });
    }
  }
  
  // === CONSTRUIR REPORTE ===
  const byType: Record<DivergenceType, number> = {
    missing_conversation_in_store: 0,
    missing_conversation_in_legacy: 0,
    missing_message_in_store: 0,
    missing_message_in_legacy: 0,
    state_mismatch: 0,
    unread_count_mismatch: 0,
  };
  
  for (const item of divergences) {
    byType[item.type] = (byType[item.type] || 0) + 1;
  }
  
  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    hasDivergence: divergences.length > 0,
    totalDivergences: divergences.length,
    byType,
    items: divergences,
    legacyStats: {
      conversationsCount: params.legacyConversations.length,
      messagesCount: Object.values(params.legacyMessagesByConversation)
        .reduce((sum, msgs) => sum + msgs.length, 0),
      unreadCounts: params.legacyUnreadCounts,
    },
    storeStats: {
      conversationsCount: Object.keys(store.conversationsById).length,
      messagesCount: Object.values(store.messagesByConversation)
        .reduce((sum, msgs) => sum + msgs.length, 0),
      unreadCounts: store.unreadCounts,
    },
  };
  
  // Guardar en historial
  auditHistory.push(report);
  if (auditHistory.length > AUDIT_CONFIG.MAX_HISTORY) {
    auditHistory = auditHistory.slice(-AUDIT_CONFIG.MAX_HISTORY);
  }
  
  // Log si hay divergencias
  if (report.hasDivergence && isMessagingDebugEnabled()) {
    console.warn("[MessageAudit] Divergencias detectadas:", report);
  }
  
  return report;
}

/**
 * ============================================================================
 * FUNCIÓN DE AUDITORÍA RÁPIDA
 * ============================================================================
 */
export function quickAudit(): {
  hasDivergence: boolean;
  summary: string;
} {
  const store = useMessageStore.getState();
  
  // Verificaciones básicas de integridad
  const checks: string[] = [];
  
  // 1. Verificar consistencia de mensajes
  for (const convId of Object.keys(store.messagesByConversation)) {
    if (!store.conversationsById[convId]) {
      checks.push(`Orfan: mensajes sin conversación para ${convId}`);
    }
  }
  
  // 2. Verificar unread counts
  for (const convId of Object.keys(store.unreadCounts)) {
    if (!store.conversationsById[convId]) {
      checks.push(`Orfan: unread count sin conversación para ${convId}`);
    }
  }
  
  const hasDivergence = checks.length > 0;
  
  return {
    hasDivergence,
    summary: hasDivergence 
      ? `Problemas detectados: ${checks.join("; ")}`
      : "Integridad verificada",
  };
}

/**
 * ============================================================================
 * OBTENER HISTORIAL DE AUDITORÍA
 * ============================================================================
 */
export function getAuditHistory(
  limit: number = 10
): AuditReport[] {
  return auditHistory.slice(-limit);
}

/**
 * ============================================================================
 * LIMPIAR HISTORIAL
 * ============================================================================
 */
export function clearAuditHistory(): void {
  auditHistory = [];
  lastAuditTime = 0;
}

/**
 * ============================================================================
 * EXPORTAR REPORTE PARA ANÁLISIS
 * ============================================================================
 */
export function exportAuditReport(report: AuditReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * ============================================================================
 * UTILIDADES INTERNAS
 * ============================================================================
 */
function createEmptyReport(): AuditReport {
  return {
    timestamp: new Date().toISOString(),
    hasDivergence: false,
    totalDivergences: 0,
    byType: {
      missing_conversation_in_store: 0,
      missing_conversation_in_legacy: 0,
      missing_message_in_store: 0,
      missing_message_in_legacy: 0,
      state_mismatch: 0,
      unread_count_mismatch: 0,
    },
    items: [],
    legacyStats: {
      conversationsCount: 0,
      messagesCount: 0,
      unreadCounts: {},
    },
    storeStats: {
      conversationsCount: 0,
      messagesCount: 0,
      unreadCounts: {},
    },
  };
}

/**
 * ============================================================================
 * HOOK DE AUDITORÍA (para debugging)
 * ============================================================================
 */
export function useMessageAudit(
  legacyState: {
    conversations: Conversation[];
    messagesByConversation: Record<string, InboxMessage[]>;
    unreadCounts: Record<string, number>;
  },
  options?: { 
    enabled?: boolean; 
    interval?: number;
    onDivergence?: (report: AuditReport) => void;
  }
) {
  const { enabled = false, interval = 10000, onDivergence } = options || {};
  
  useEffect(() => {
    if (!enabled) return;
    
    const runAudit = () => {
      const report = auditMessageStoreDivergence({
        legacyConversations: legacyState.conversations,
        legacyMessagesByConversation: legacyState.messagesByConversation,
        legacyUnreadCounts: legacyState.unreadCounts,
      });
      
      if (report.hasDivergence && onDivergence) {
        onDivergence(report);
      }
    };
    
    // Ejecutar inmediatamente y luego en intervalo
    runAudit();
    const timer = setInterval(runAudit, interval);
    
    return () => clearInterval(timer);
  }, [enabled, interval, onDivergence, legacyState]);
  
  return {
    getHistory: getAuditHistory,
    quickAudit,
    clearHistory: clearAuditHistory,
  };
}
