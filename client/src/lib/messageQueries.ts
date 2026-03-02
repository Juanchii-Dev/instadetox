/**
 * ============================================================================
 * FASE 2 - MESSAGE QUERIES (Modo SSOT Activo)
 * ============================================================================
 * 
 * ⚠️ REGLA CRÍTICA - MODO ACTIVO:
 * Estas queries AHORA SON la fuente primaria de datos para la UI.
 * Leen del MessageStore (SSOT), NO del servidor directamente.
 * 
 * PRINCIPIO:
 * - Lectura desde MessageStore (SSOT activo)
 * - UI consume datos desde React Query → MessageStore
 * - Sistema legacy opera como fallback (sync adaptadores)
 * 
 * FEATURE FLAG:
 * - enableMessageStoreSSOT() controla si las queries están activas
 * - Si flag = false: vuelve a modo legacy (enabled: false)
 * ============================================================================
 */

import { useQuery, useQueries, type UseQueryOptions } from "@tanstack/react-query";
import { useMessageStore, type MessageStoreState } from "./messageStore";
import type { Conversation, InboxMessage } from "@/hooks/useMessagesInbox";
import { isMessagingDebugEnabled, isNewMessagingEnabled } from "./featureFlags";

/**
 * ============================================================================
 * QUERY KEYS
 * ============================================================================
 */
export const messageQueryKeys = {
  all: ["messages"] as const,
  conversations: () => [...messageQueryKeys.all, "conversations"] as const,
  conversation: (id: string) => [...messageQueryKeys.conversations(), id] as const,
  messages: (conversationId: string) => 
    [...messageQueryKeys.all, "messages", conversationId] as const,
  unread: () => [...messageQueryKeys.all, "unread"] as const,
  stats: () => [...messageQueryKeys.all, "stats"] as const,
};

/**
 * ============================================================================
 * QUERY 1: CONVERSACIONES (Desde MessageStore - SSOT)
 * ============================================================================
 * 
 * FASE 2: Fuente primaria de datos para la UI.
 * Esta query está SIEMPRE activa cuando el feature flag está habilitado.
 */
export function useConversationsQuery(options?: {
  enabled?: boolean;
  compareWithLegacy?: boolean;
}) {
  const featureEnabled = isNewMessagingEnabled();
  const { enabled = true, compareWithLegacy = false } = options || {};
  
  return useQuery({
    queryKey: messageQueryKeys.conversations(),
    queryFn: () => {
      const state = useMessageStore.getState();
      const conversations = Object.values(state.conversationsById).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      
      if (isMessagingDebugEnabled()) {
        console.log("[MessageQueries] Conversaciones desde Store:", conversations.length);
      }
      
      return conversations;
    },
    enabled: enabled && featureEnabled,
    staleTime: Infinity, // Los datos del store siempre son "fresh"
  });
}

/**
 * ============================================================================
 * QUERY 2: MENSAJES POR CONVERSACIÓN (Desde MessageStore - SSOT)
 * ============================================================================
 * 
 * FASE 2: Fuente primaria de mensajes para la UI.
 */
export function useMessagesQuery(
  conversationId: string | null,
  options?: {
    enabled?: boolean;
  }
) {
  const featureEnabled = isNewMessagingEnabled();
  const { enabled = true } = options || {};
  
  return useQuery({
    queryKey: messageQueryKeys.messages(conversationId || "null"),
    queryFn: () => {
      if (!conversationId) return [];
      
      const state = useMessageStore.getState();
      const messages = state.messagesByConversation[conversationId] ?? [];
      
      if (isMessagingDebugEnabled()) {
        console.log(`[MessageQueries] Mensajes desde Store para ${conversationId}:`, messages.length);
      }
      
      return messages;
    },
    enabled: enabled && featureEnabled && !!conversationId,
    staleTime: Infinity,
  });
}

/**
 * ============================================================================
 * QUERY 3: UNREAD COUNTS (Desde MessageStore - SSOT)
 * ============================================================================
 * 
 * FASE 2: Fuente primaria de contadores para la UI.
 */
export function useUnreadCountsQuery(options?: { enabled?: boolean }) {
  const featureEnabled = isNewMessagingEnabled();
  const { enabled = true } = options || {};
  
  return useQuery({
    queryKey: messageQueryKeys.unread(),
    queryFn: () => {
      const state = useMessageStore.getState();
      const counts = state.unreadCounts;
      const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
      
      return {
        byConversation: counts,
        total,
      };
    },
    enabled: enabled && featureEnabled,
    staleTime: Infinity,
  });
}

/**
 * ============================================================================
 * QUERY 4: ESTADÍSTICAS DEL STORE (Para auditoría - SSOT)
 * ============================================================================
 */
export function useMessageStoreStats(options?: { enabled?: boolean }) {
  const featureEnabled = isNewMessagingEnabled();
  const { enabled = true } = options || {};
  
  return useQuery({
    queryKey: messageQueryKeys.stats(),
    queryFn: () => {
      const state = useMessageStore.getState();
      
      const conversationsCount = Object.keys(state.conversationsById).length;
      const messagesCount = Object.values(state.messagesByConversation)
        .reduce((sum, msgs) => sum + msgs.length, 0);
      const totalUnread = Object.values(state.unreadCounts)
        .reduce((sum, c) => sum + c, 0);
      
      return {
        conversationsCount,
        messagesCount,
        totalUnread,
        lastSyncAt: state.lastSyncAt,
        isSyncing: state.isSyncing,
        syncErrorsCount: state.syncErrors.length,
        selectedConversationId: state.selectedConversationId,
      };
    },
    enabled: enabled && featureEnabled,
    staleTime: 1000, // Refrescar cada segundo para debugging
  });
}

/**
 * ============================================================================
 * QUERY 5: BATCH DE MENSAJES (Múltiples conversaciones - SSOT)
 * ============================================================================
 */
export function useBatchMessagesQuery(
  conversationIds: string[],
  options?: { enabled?: boolean }
) {
  const featureEnabled = isNewMessagingEnabled();
  const { enabled = true } = options || {};
  
  return useQueries({
    queries: conversationIds.map((id) => ({
      queryKey: messageQueryKeys.messages(id),
      queryFn: () => {
        const state = useMessageStore.getState();
        return state.messagesByConversation[id] ?? [];
      },
      enabled: enabled && featureEnabled && !!id,
      staleTime: Infinity,
    })),
  });
}

/**
 * ============================================================================
 * COMPARADORES DE CONSISTENCIA (para auditoría)
 * ============================================================================
 */

export interface DivergenceReport {
  hasDivergence: boolean;
  conversations: {
    legacyCount: number;
    storeCount: number;
    missingInStore: string[];
    missingInLegacy: string[];
  };
  messages: Record<string, {
    legacyCount: number;
    storeCount: number;
    missingInStore: string[];
    missingInLegacy: string[];
  }>;
  timestamp: string;
}

/** Compara estado legacy con MessageStore */
export function compareWithMessageStore(params: {
  legacyConversations: Conversation[];
  legacyMessagesByConversation: Record<string, InboxMessage[]>;
}): DivergenceReport {
  const state = useMessageStore.getState();
  const timestamp = new Date().toISOString();
  
  // Comparar conversaciones
  const legacyConvIds = params.legacyConversations.map(c => c.id);
  const storeConvIds = Object.keys(state.conversationsById);
  const storeConvIdSet = new Set(storeConvIds);
  const legacyConvIdSet = new Set(legacyConvIds);
  
  const missingInStore = params.legacyConversations
    .filter(c => !storeConvIdSet.has(c.id))
    .map(c => c.id);
  
  const missingInLegacy = storeConvIds
    .filter(id => !legacyConvIdSet.has(id));
  
  // Comparar mensajes por conversación
  const messages: DivergenceReport["messages"] = {};
  
  const allConvIdsSet = new Set(legacyConvIds.concat(storeConvIds));
  const allConvIds = Array.from(allConvIdsSet);
  
  for (const convId of allConvIds) {
    const legacyMsgs = params.legacyMessagesByConversation[convId] ?? [];
    const storeMsgs = state.messagesByConversation[convId] ?? [];
    
    const legacyMsgIds = new Set(legacyMsgs.map(m => m.id));
    const storeMsgIds = new Set(storeMsgs.map(m => m.id));
    
    const missingMsgsInStore = legacyMsgs
      .filter(m => !storeMsgIds.has(m.id))
      .map(m => m.id);
    
    const missingMsgsInLegacy = storeMsgs
      .filter(m => !legacyMsgIds.has(m.id))
      .map(m => m.id);
    
    if (missingMsgsInStore.length > 0 || missingMsgsInLegacy.length > 0) {
      messages[convId] = {
        legacyCount: legacyMsgs.length,
        storeCount: storeMsgs.length,
        missingInStore: missingMsgsInStore,
        missingInLegacy: missingMsgsInLegacy,
      };
    }
  }
  
  const hasDivergence = 
    missingInStore.length > 0 ||
    missingInLegacy.length > 0 ||
    Object.keys(messages).length > 0;
  
  return {
    hasDivergence,
    conversations: {
      legacyCount: params.legacyConversations.length,
      storeCount: Object.keys(state.conversationsById).length,
      missingInStore,
      missingInLegacy,
    },
    messages,
    timestamp,
  };
}

/**
 * ============================================================================
 * HOOK DE VALIDACIÓN (para debugging - SSOT)
 * ============================================================================
 * 
 * FASE 2: Valida consistencia entre legacy y store durante transición.
 */
export function useMessageStoreValidation(
  legacyState: {
    legacyConversations: Conversation[];
    legacyMessagesByConversation: Record<string, InboxMessage[]>;
  },
  options?: { enabled?: boolean; interval?: number }
) {
  const featureEnabled = isNewMessagingEnabled();
  const { enabled = false, interval = 5000 } = options || {};
  
  return useQuery({
    queryKey: ["messageStore", "validation", legacyState],
    queryFn: () => {
      const report = compareWithMessageStore(legacyState);
      
      if (report.hasDivergence && isMessagingDebugEnabled()) {
        console.warn("[MessageQueries] Divergencia detectada:", report);
      }
      
      return report;
    },
    enabled: enabled && featureEnabled,
    refetchInterval: interval,
  });
}

/**
 * ============================================================================
 * UTILIDADES PARA DEBUGGING
 * ============================================================================
 */

/** Exporta estado completo del store para análisis */
export function exportMessageStoreState(): {
  conversations: Conversation[];
  messagesByConversation: Record<string, InboxMessage[]>;
  unreadCounts: Record<string, number>;
  metadata: {
    lastSyncAt: string | null;
    isSyncing: boolean;
    syncErrors: string[];
  };
} {
  const state = useMessageStore.getState();
  
  return {
    conversations: Object.values(state.conversationsById),
    messagesByConversation: state.messagesByConversation,
    unreadCounts: state.unreadCounts,
    metadata: {
      lastSyncAt: state.lastSyncAt,
      isSyncing: state.isSyncing,
      syncErrors: state.syncErrors,
    },
  };
}

/** Verifica integridad del store */
export function verifyMessageStoreIntegrity(): {
  valid: boolean;
  errors: string[];
} {
  const state = useMessageStore.getState();
  const errors: string[] = [];
  
  // Verificar que todos los mensajes tengan conversationId válido
  for (const [convId, messages] of Object.entries(state.messagesByConversation)) {
    for (const msg of messages) {
      if (msg.conversationId !== convId) {
        errors.push(`Mensaje ${msg.id} tiene conversationId inconsistente: ${msg.conversationId} vs ${convId}`);
      }
    }
  }
  
  // Verificar que conversaciones referenciadas existan
  for (const convId of Object.keys(state.messagesByConversation)) {
    if (!state.conversationsById[convId]) {
      errors.push(`Mensajes existen para conversación inexistente: ${convId}`);
    }
  }
  
  // Verificar unread counts
  for (const convId of Object.keys(state.unreadCounts)) {
    if (!state.conversationsById[convId]) {
      errors.push(`Unread count para conversación inexistente: ${convId}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
