/**
 * ============================================================================
 * FASE 2 - MESSAGE STORE ADAPTER (Legacy Sync Bridge)
 * ============================================================================
 * 
 * ⚠️ REGLA CRÍTICA - MODO BRIDGE:
 * Este archivo MANTIENE sincronización desde legacy al store.
 * En FASE 2, este es un bridge de compatibilidad hacia atrás.
 * 
 * ARQUITECTURA FASE 2:
 * - UI → MessageStore (directo, modo activo)
 * - Legacy → Adaptador → MessageStore (modo pasivo, backup)
 * 
 * CUANDO EL FEATURE FLAG ESTÁ ACTIVO:
 * - La UI lee desde MessageStore vía React Query
 * - El legacy sigue escribiendo al store via estos adaptadores
 * - Esto permite rollback instantáneo (UI vuelve a leer legacy directamente)
 * 
 * DEPRECACIÓN:
 * - Estas funciones están marcadas @deprecated
 * - Serán removidas cuando la migración sea 100% exitosa
 * ============================================================================
 */

import { useMessageStore } from "./messageStore";
import type { Conversation, InboxMessage } from "@/hooks/useMessagesInbox";
import { isMessagingDebugEnabled } from "./featureFlags";

/**
 * ============================================================================
 * ADAPTADOR 1: CONVERSACIONES (Desde loadConversations)
 * ============================================================================
 * Llamado cuando:
 * - Se carga el inbox inicial
 * - Se refresca el inbox (silencioso o explícito)
 * - Cambios de focus/visibility
 */
export function syncConversationsFromLegacy(conversations: Conversation[]): void {
  const store = useMessageStore.getState();
  
  store.markSyncStart();
  
  try {
    store.syncConversations(conversations);
    store.markSyncComplete();
    
    if (isMessagingDebugEnabled()) {
      console.log("[MessageStoreAdapter] Conversaciones sincronizadas:", conversations.length);
    }
  } catch (error) {
    store.logSyncError(`syncConversations: ${String(error)}`);
  }
}

/**
 * ============================================================================
 * ADAPTADOR 2: MENSAJES (Desde loadMessages)
 * ============================================================================
 * Llamado cuando:
 * - Se carga una conversación
 * - Se cargan mensajes antiguos (pagination)
 * - Se refresca una conversación activa
 */
export function syncMessagesFromLegacy(
  conversationId: string,
  messages: InboxMessage[]
): void {
  const store = useMessageStore.getState();
  
  try {
    store.syncMessages(conversationId, messages);
    
    if (isMessagingDebugEnabled()) {
      console.log(`[MessageStoreAdapter] Mensajes sincronizados para ${conversationId}:`, messages.length);
    }
  } catch (error) {
    store.logSyncError(`syncMessages(${conversationId}): ${String(error)}`);
  }
}

/**
 * ============================================================================
 * ADAPTADOR 3: MENSAJE INDIVIDUAL (Desde realtime / sendMessage)
 * ============================================================================
 * Llamado cuando:
 * - Llega un mensaje nuevo vía realtime
 * - Se envía un mensaje optimista
 * - Se actualiza estado de un mensaje (sending → sent)
 */
export function syncMessageFromLegacy(message: InboxMessage): void {
  const store = useMessageStore.getState();
  
  try {
    store.syncIncomingMessage(message);
    
    // También sincronizar la conversación para actualizar preview
    const existingConv = store.conversationsById[message.conversationId];
    if (existingConv) {
      store.syncConversation({
        ...existingConv,
        preview: message.body || (message.mediaUrl ? "Foto 📷" : null),
        previewAt: message.createdAt,
        updatedAt: message.createdAt,
      });
    }
    
    if (isMessagingDebugEnabled()) {
      console.log("[MessageStoreAdapter] Mensaje sincronizado:", message.id);
    }
  } catch (error) {
    store.logSyncError(`syncMessage(${message.id}): ${String(error)}`);
  }
}

/**
 * ============================================================================
 * ADAPTADOR 4: ESTADO DE MENSAJE (Desde sendMessage/retry)
 * ============================================================================
 * Llamado cuando:
 * - Un mensaje cambia de "sending" a "sent"
 * - Un mensaje cambia de "sending" a "failed"
 * - Un mensaje se reintenta
 */
export function syncMessageStatusFromLegacy(
  messageId: string,
  status: InboxMessage["deliveryState"]
): void {
  const store = useMessageStore.getState();
  
  try {
    store.syncMessageStatus(messageId, status);
    
    if (isMessagingDebugEnabled()) {
      console.log(`[MessageStoreAdapter] Estado sincronizado para ${messageId}:`, status);
    }
  } catch (error) {
    store.logSyncError(`syncMessageStatus(${messageId}): ${String(error)}`);
  }
}

/**
 * ============================================================================
 * ADAPTADOR 5: CONTADOR NO LEÍDOS (Desde loadConversations/markConversationSeen)
 * ============================================================================
 * Llamado cuando:
 * - Se cargan conversaciones con unread_count
 * - Se marca una conversación como vista
 * - Llega un mensaje nuevo en conversación no activa
 */
export function syncUnreadCountFromLegacy(
  conversationId: string,
  count: number
): void {
  const store = useMessageStore.getState();
  
  try {
    store.syncUnreadCount(conversationId, count);
    
    if (isMessagingDebugEnabled()) {
      console.log(`[MessageStoreAdapter] Unread sincronizado para ${conversationId}:`, count);
    }
  } catch (error) {
    store.logSyncError(`syncUnreadCount(${conversationId}): ${String(error)}`);
  }
}

/**
 * ============================================================================
 * ADAPTADOR 6: CONVERSACIÓN SELECCIONADA (Desde setSelectedConversationId)
 * ============================================================================
 * Llamado cuando:
 * - El usuario selecciona una conversación
 * - Se navega directamente a una conversación vía URL
 * - Se crea una nueva conversación
 */
export function syncSelectedConversationFromLegacy(id: string | null): void {
  const store = useMessageStore.getState();
  
  try {
    store.syncSelectedConversation(id);
    
    if (isMessagingDebugEnabled()) {
      console.log("[MessageStoreAdapter] Conversación seleccionada sincronizada:", id);
    }
  } catch (error) {
    store.logSyncError(`syncSelectedConversation: ${String(error)}`);
  }
}

/**
 * ============================================================================
 * ADAPTADOR 7: TYPING INDICATOR (Desde realtime)
 * ============================================================================
 * Llamado cuando:
 * - Llega evento de typing vía broadcast
 * - Expira el timeout de typing
 */
export function syncPeerTypingFromLegacy(
  conversationId: string,
  isTyping: boolean
): void {
  const store = useMessageStore.getState();
  
  try {
    store.syncPeerTyping(conversationId, isTyping);
  } catch (error) {
    store.logSyncError(`syncPeerTyping(${conversationId}): ${String(error)}`);
  }
}

/**
 * ============================================================================
 * ADAPTADOR 8: SEEN TIMESTAMP (Desde realtime/loadPeerSeenAt)
 * ============================================================================
 * Llamado cuando:
 * - Llega evento de seen vía broadcast
 * - Se carga peerSeenAt explícitamente
 */
export function syncPeerSeenAtFromLegacy(
  conversationId: string,
  seenAt: string | null
): void {
  const store = useMessageStore.getState();
  
  try {
    store.syncPeerSeenAt(conversationId, seenAt);
  } catch (error) {
    store.logSyncError(`syncPeerSeenAt(${conversationId}): ${String(error)}`);
  }
}

/**
 * ============================================================================
 * ADAPTADOR 9: MENSAJE ELIMINADO (Desde unsendMessage/realtime)
 * ============================================================================
 * Llamado cuando:
 * - Se elimina un mensaje localmente
 * - Llega evento de delete_message vía realtime
 */
export function syncMessageDeletedFromLegacy(
  conversationId: string,
  messageId: string
): void {
  const store = useMessageStore.getState();
  
  try {
    const messages = store.messagesByConversation[conversationId] ?? [];
    const filtered = messages.filter((m) => m.id !== messageId);
    store.syncMessages(conversationId, filtered);
    
    if (isMessagingDebugEnabled()) {
      console.log(`[MessageStoreAdapter] Mensaje eliminado sincronizado: ${messageId}`);
    }
  } catch (error) {
    store.logSyncError(`syncMessageDeleted(${messageId}): ${String(error)}`);
  }
}

/**
 * ============================================================================
 * ADAPTADOR 10: CONVERSACIÓN ACTUALIZADA (Desde moveConversationToTopWithPreview)
 * ============================================================================
 * Llamado cuando:
 * - Se recibe/envía un mensaje (actualiza preview y orden)
 * - Se actualiza metadata de conversación
 */
export function syncConversationUpdatedFromLegacy(
  conversationId: string,
  updates: Partial<Conversation>
): void {
  const store = useMessageStore.getState();
  
  try {
    const existing = store.conversationsById[conversationId];
    if (!existing) return;
    
    store.syncConversation({
      ...existing,
      ...updates,
    });
    
    if (isMessagingDebugEnabled()) {
      console.log(`[MessageStoreAdapter] Conversación actualizada: ${conversationId}`, updates);
    }
  } catch (error) {
    store.logSyncError(`syncConversationUpdated(${conversationId}): ${String(error)}`);
  }
}

/**
 * ============================================================================
 * HOOKS DE SINCRONIZACIÓN (Para usar en useMessagesInbox)
 * ============================================================================
 * Estos hooks se llaman desde useMessagesInbox para mantener el store sincronizado.
 */

/**
 * Hook de sincronización completa - llamado en puntos clave
 */
export function useMessageStoreSync() {
  return {
    syncConversations: syncConversationsFromLegacy,
    syncMessages: syncMessagesFromLegacy,
    syncMessage: syncMessageFromLegacy,
    syncMessageStatus: syncMessageStatusFromLegacy,
    syncUnreadCount: syncUnreadCountFromLegacy,
    syncSelectedConversation: syncSelectedConversationFromLegacy,
    syncPeerTyping: syncPeerTypingFromLegacy,
    syncPeerSeenAt: syncPeerSeenAtFromLegacy,
    syncMessageDeleted: syncMessageDeletedFromLegacy,
    syncConversationUpdated: syncConversationUpdatedFromLegacy,
  };
}

/**
 * ============================================================================
 * UTILIDADES DE BULK SYNC
 * ============================================================================
 */

/**
 * Sincroniza todo el estado legacy al store de una vez.
 * Útil para migración gradual o recovery.
 */
export function performFullSync(params: {
  conversations: Conversation[];
  messagesByConversation: Record<string, InboxMessage[]>;
  unreadCounts: Record<string, number>;
  selectedConversationId: string | null;
}): void {
  const store = useMessageStore.getState();
  
  store.markSyncStart();
  
  try {
    // 1. Sincronizar conversaciones
    store.syncConversations(params.conversations);
    
    // 2. Sincronizar mensajes
    Object.entries(params.messagesByConversation).forEach(([convId, messages]) => {
      store.syncMessages(convId, messages);
    });
    
    // 3. Sincronizar unread counts
    Object.entries(params.unreadCounts).forEach(([convId, count]) => {
      store.syncUnreadCount(convId, count);
    });
    
    // 4. Sincronizar selección
    store.syncSelectedConversation(params.selectedConversationId);
    
    store.markSyncComplete();
    
    if (isMessagingDebugEnabled()) {
      console.log("[MessageStoreAdapter] Full sync completado");
    }
  } catch (error) {
    store.logSyncError(`performFullSync: ${String(error)}`);
  }
}
