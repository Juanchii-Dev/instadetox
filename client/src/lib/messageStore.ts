/**
 * ============================================================================
 * FASE 2 - MESSAGE STORE (SSOT Activo)
 * ============================================================================
 * 
 * ⚠️ REGLA CRÍTICA - MODO ACTIVO:
 * Este store AHORA ES la fuente de verdad primaria.
 * La UI consume directamente desde este store vía React Query.
 * 
 * ARQUITECTURA:
 * - UI → React Query → MessageStore (lectura)
 * - UI → MessageStore → Supabase (escritura/optimistic)
 * - Legacy → MessageStore (sync adapter, modo pasivo)
 * 
 * FEATURE FLAG:
 * - isNewMessagingEnabled() controla si UI lee desde store
 * - Si flag = false: UI lee desde legacy (fallback)
 * 
 * GARANTÍAS:
 * - Deduplicación mantiene funcionando
 * - Realtime sin cambios
 * - Unread counts correctos
 * ============================================================================
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { devtools } from "zustand/middleware";
import type { Conversation, InboxMessage } from "@/hooks/useMessagesInbox";
import { isMessagingDebugEnabled } from "./featureFlags";

/**
 * ============================================================================
 * ESTADO DEL STORE (SSOT Activo)
 * ============================================================================
 * Estructura normalizada que es la fuente de verdad primaria.
 * FASE 2: UI consume directamente desde aquí.
 */
export interface MessageStoreState {
  // Datos normalizados
  conversationsById: Record<string, Conversation>;
  messagesByConversation: Record<string, InboxMessage[]>;
  unreadCounts: Record<string, number>;
  
  // Metadatos
  lastSyncAt: string | null;
  isSyncing: boolean;
  syncErrors: string[];
  
  // Estados de UI (reflejo del legacy)
  selectedConversationId: string | null;
  peerTypingByConversation: Record<string, boolean>;
  peerSeenAtByConversation: Record<string, string | null>;
}

/**
 * ============================================================================
 * ACCIONES DEL STORE (FASE 2 - SSOT Activo)
 * ============================================================================
 * 
 * DOS TIPOS DE ACCIONES:
 * 1. SYNC_* - Llamadas por adaptadores legacy (modo pasivo/backup)
 * 2. UI_* - Llamadas directamente por la UI (modo activo)
 */
interface MessageStoreActions {
  // === SINCRONIZACIÓN DESDE LEGACY (MODO PASIVO - MANTENIDO PARA COMPATIBILIDAD) ===
  
  /** @deprecated Usar setConversations para modo activo */
  syncConversations(conversations: Conversation[]): void;
  
  /** @deprecated Usar updateConversation para modo activo */
  syncConversation(conversation: Conversation): void;
  
  /** @deprecated Usar setMessages para modo activo */
  syncMessages(conversationId: string, messages: InboxMessage[]): void;
  
  /** @deprecated Usar addMessage para modo activo */
  syncIncomingMessage(message: InboxMessage): void;
  
  /** @deprecated Usar updateMessageStatus para modo activo */
  syncMessageStatus(messageId: string, status: InboxMessage["deliveryState"]): void;
  
  /** @deprecated Usar setUnreadCount para modo activo */
  syncUnreadCount(conversationId: string, count: number): void;
  
  /** @deprecated Usar setSelectedConversationId para modo activo */
  syncSelectedConversation(id: string | null): void;
  
  /** @deprecated Usar setPeerTyping para modo activo */
  syncPeerTyping(conversationId: string, isTyping: boolean): void;
  
  /** @deprecated Usar setPeerSeenAt para modo activo */
  syncPeerSeenAt(conversationId: string, seenAt: string | null): void;
  
  // === ACCIONES UI (MODO ACTIVO - SSOT) ===
  
  /** Establece todas las conversaciones (desde carga inicial) */
  setConversations(conversations: Conversation[]): void;
  
  /** Actualiza o agrega una conversación */
  updateConversation(conversation: Conversation): void;
  
  /** Establece mensajes de una conversación */
  setMessages(conversationId: string, messages: InboxMessage[]): void;
  
  /** Agrega un mensaje (optimistic o incoming) */
  addMessage(message: InboxMessage): void;
  
  /** Actualiza estado de entrega de un mensaje */
  updateMessageStatus(messageId: string, status: InboxMessage["deliveryState"]): void;
  
  /** Elimina un mensaje (unsend) */
  removeMessage(messageId: string, conversationId: string): void;
  
  /** Establece contador de no leídos */
  setUnreadCount(conversationId: string, count: number): void;
  
  /** Incrementa contador de no leídos */
  incrementUnreadCount(conversationId: string): void;
  
  /** Resetea contador de no leídos */
  resetUnreadCount(conversationId: string): void;
  
  /** Establece conversación seleccionada */
  setSelectedConversationId(id: string | null): void;
  
  /** Establece estado de typing del peer */
  setPeerTyping(conversationId: string, isTyping: boolean): void;
  
  /** Establece timestamp de visto del peer */
  setPeerSeenAt(conversationId: string, seenAt: string | null): void;
  
  // === MARCADORES DE SYNC ===
  
  /** Marca inicio de sincronización */
  markSyncStart(): void;
  
  /** Marca fin de sincronización exitosa */
  markSyncComplete(): void;
  
  /** Registra error de sincronización */
  logSyncError(error: string): void;
  
  // === RESET ===
  
  /** Limpia todo el estado (logout) */
  reset(): void;
}

type MessageStore = MessageStoreState & MessageStoreActions;

/**
 * ============================================================================
 * ESTADO INICIAL
 * ============================================================================
 */
const initialState: MessageStoreState = {
  conversationsById: {},
  messagesByConversation: {},
  unreadCounts: {},
  lastSyncAt: null,
  isSyncing: false,
  syncErrors: [],
  selectedConversationId: null,
  peerTypingByConversation: {},
  peerSeenAtByConversation: {},
};

/**
 * ============================================================================
 * STORE CREATION (Zustand + Immer + Devtools)
 * ============================================================================
 */
export const useMessageStore = create<MessageStore>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      // === SINCRONIZACIÓN DESDE LEGACY ===
      
      syncConversations: (conversations) => {
        set((state) => {
          const byId: Record<string, Conversation> = {};
          conversations.forEach((conv) => {
            byId[conv.id] = conv;
          });
          state.conversationsById = byId;
        });
        
        if (isMessagingDebugEnabled()) {
          console.log("[MessageStore] Conversaciones sincronizadas:", conversations.length);
        }
      },

      syncConversation: (conversation) => {
        set((state) => {
          state.conversationsById[conversation.id] = conversation;
        });
      },

      syncMessages: (conversationId, messages) => {
        set((state) => {
          state.messagesByConversation[conversationId] = messages;
        });
        
        if (isMessagingDebugEnabled()) {
          console.log(`[MessageStore] Mensajes sincronizados para ${conversationId}:`, messages.length);
        }
      },

      syncIncomingMessage: (message) => {
        set((state) => {
          const existing = state.messagesByConversation[message.conversationId] ?? [];
          
          // Evitar duplicados en el store
          const exists = existing.some((m) => m.id === message.id);
          if (exists) return;
          
          state.messagesByConversation[message.conversationId] = [...existing, message].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
        
        if (isMessagingDebugEnabled()) {
          console.log("[MessageStore] Mensaje entrante sincronizado:", message.id);
        }
      },

      syncMessageStatus: (messageId, status) => {
        set((state) => {
          // Buscar en todas las conversaciones
          Object.keys(state.messagesByConversation).forEach((convId) => {
            const messages = state.messagesByConversation[convId];
            const message = messages.find((m) => m.id === messageId);
            if (message) {
              message.deliveryState = status;
            }
          });
        });
      },

      syncUnreadCount: (conversationId, count) => {
        set((state) => {
          state.unreadCounts[conversationId] = count;
        });
      },

      syncSelectedConversation: (id) => {
        set((state) => {
          state.selectedConversationId = id;
        });
      },

      syncPeerTyping: (conversationId, isTyping) => {
        set((state) => {
          state.peerTypingByConversation[conversationId] = isTyping;
        });
      },

      syncPeerSeenAt: (conversationId, seenAt) => {
        set((state) => {
          state.peerSeenAtByConversation[conversationId] = seenAt;
        });
      },

      // === ACCIONES UI (MODO ACTIVO - SSOT) ===
      // Estas acciones son usadas directamente por la UI cuando el feature flag está activo
      
      setConversations: (conversations) => {
        set((state) => {
          const byId: Record<string, Conversation> = {};
          conversations.forEach((conv) => {
            byId[conv.id] = conv;
          });
          state.conversationsById = byId;
        });
        
        if (isMessagingDebugEnabled()) {
          console.log("[MessageStore] Conversaciones establecidas:", conversations.length);
        }
      },
      
      updateConversation: (conversation) => {
        set((state) => {
          state.conversationsById[conversation.id] = conversation;
        });
      },
      
      setMessages: (conversationId, messages) => {
        set((state) => {
          state.messagesByConversation[conversationId] = messages;
        });
        
        if (isMessagingDebugEnabled()) {
          console.log(`[MessageStore] Mensajes establecidos para ${conversationId}:`, messages.length);
        }
      },
      
      addMessage: (message) => {
        set((state) => {
          const existing = state.messagesByConversation[message.conversationId] ?? [];
          
          // Evitar duplicados
          const exists = existing.some((m) => m.id === message.id);
          if (exists) return;
          
          state.messagesByConversation[message.conversationId] = [...existing, message].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
        
        if (isMessagingDebugEnabled()) {
          console.log("[MessageStore] Mensaje agregado:", message.id);
        }
      },
      
      updateMessageStatus: (messageId, status) => {
        set((state) => {
          Object.keys(state.messagesByConversation).forEach((convId) => {
            const messages = state.messagesByConversation[convId];
            const message = messages.find((m) => m.id === messageId);
            if (message) {
              message.deliveryState = status;
            }
          });
        });
        
        if (isMessagingDebugEnabled()) {
          console.log(`[MessageStore] Estado actualizado para ${messageId}:`, status);
        }
      },
      
      removeMessage: (messageId, conversationId) => {
        set((state) => {
          const messages = state.messagesByConversation[conversationId] ?? [];
          state.messagesByConversation[conversationId] = messages.filter((m) => m.id !== messageId);
        });
        
        if (isMessagingDebugEnabled()) {
          console.log("[MessageStore] Mensaje eliminado:", messageId);
        }
      },
      
      setUnreadCount: (conversationId, count) => {
        set((state) => {
          state.unreadCounts[conversationId] = count;
        });
      },
      
      incrementUnreadCount: (conversationId) => {
        set((state) => {
          const current = state.unreadCounts[conversationId] ?? 0;
          state.unreadCounts[conversationId] = current + 1;
        });
      },
      
      resetUnreadCount: (conversationId) => {
        set((state) => {
          state.unreadCounts[conversationId] = 0;
        });
      },
      
      setSelectedConversationId: (id) => {
        set((state) => {
          state.selectedConversationId = id;
        });
      },
      
      setPeerTyping: (conversationId, isTyping) => {
        set((state) => {
          state.peerTypingByConversation[conversationId] = isTyping;
        });
      },
      
      setPeerSeenAt: (conversationId, seenAt) => {
        set((state) => {
          state.peerSeenAtByConversation[conversationId] = seenAt;
        });
      },

      // === MARCADORES DE SYNC ===
      
      markSyncStart: () => {
        set((state) => {
          state.isSyncing = true;
        });
      },

      markSyncComplete: () => {
        set((state) => {
          state.isSyncing = false;
          state.lastSyncAt = new Date().toISOString();
        });
      },

      logSyncError: (error) => {
        set((state) => {
          state.syncErrors.push(`${new Date().toISOString()}: ${error}`);
          // Mantener solo últimos 50 errores
          if (state.syncErrors.length > 50) {
            state.syncErrors = state.syncErrors.slice(-50);
          }
        });
      },

      // === RESET ===
      
      reset: () => {
        set(initialState);
      },
    })),
    { name: "MessageStore" }
  )
);

/**
 * ============================================================================
 * SELECTORES (para uso en componentes/hooks)
 * ============================================================================
 * FASE 2: Estos selectores permiten suscribirse a partes específicas del estado.
 * Son usados por React Query y componentes para lectura eficiente.
 */

/** Selector de conversaciones como array ordenado */
export const selectConversations = (state: MessageStoreState): Conversation[] => {
  return Object.values(state.conversationsById).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
};

/** Selector de mensajes por conversación */
export const selectMessagesByConversation = (
  state: MessageStoreState,
  conversationId: string
): InboxMessage[] => {
  return state.messagesByConversation[conversationId] ?? [];
};

/** Selector de conversación seleccionada */
export const selectSelectedConversation = (state: MessageStoreState): Conversation | null => {
  if (!state.selectedConversationId) return null;
  return state.conversationsById[state.selectedConversationId] ?? null;
};

/** Selector de total de no leídos */
export const selectTotalUnreadCount = (state: MessageStoreState): number => {
  return Object.values(state.unreadCounts).reduce((sum, count) => sum + count, 0);
};

/**
 * ============================================================================
 * UTILIDADES DE DEBUG
 * ============================================================================
 */
export function getMessageStoreSnapshot(): {
  conversationsCount: number;
  messagesCount: number;
  unreadCounts: Record<string, number>;
  selectedConversationId: string | null;
  lastSyncAt: string | null;
  isSyncing: boolean;
  syncErrorsCount: number;
} {
  const state = useMessageStore.getState();
  return {
    conversationsCount: Object.keys(state.conversationsById).length,
    messagesCount: Object.values(state.messagesByConversation).flat().length,
    unreadCounts: state.unreadCounts,
    selectedConversationId: state.selectedConversationId,
    lastSyncAt: state.lastSyncAt,
    isSyncing: state.isSyncing,
    syncErrorsCount: state.syncErrors.length,
  };
}
