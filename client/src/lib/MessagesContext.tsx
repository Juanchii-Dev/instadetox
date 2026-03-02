import React, { createContext, useContext } from "react";
import { MessageRow, InboxMessage, Conversation, ReplyToPayload, useMessagesInbox } from "@/hooks/useMessagesInbox";

/**
 * ============================================================================
 * FASE 2 – MessagesContext (Legacy Bridge)
 * ============================================================================
 * 
 * @deprecated Este contexto es el puente legacy hacia el MessageStore.
 * En FASE 3 será reemplazado por consumo directo desde MessageStore.
 * 
 * ACTUAL (FASE 2):
 * - UI consume desde useInbox() → MessagesContext → useMessagesInbox
 * - useMessagesInbox sincroniza al MessageStore (backup)
 * 
 * FUTURO (FASE 3):
 * - UI consume desde React Query → MessageStore directamente
 * - Este contexto será eliminado
 * ============================================================================
 */

interface MessagesContextType {
  conversations: Conversation[];
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;
  selectedConversation: Conversation | null;
  messages: InboxMessage[];
  loadingConversations: boolean;
  loadingMessages: boolean;
  peerTyping: boolean;
  unreadByConversation: Record<string, number>;
  requestConversationIds: string[];
  peerSeenAt: string | null;
  seenByCount: number;
  otherParticipantCount: number;
  hasMoreMessages: boolean;
  loadingOlderMessages: boolean;
  sendMessage: (body: string, replyTo?: ReplyToPayload, pendingFiles?: Array<{ file: File; previewUrl: string }>) => Promise<boolean>;
  retryFailedMessage: (messageId: string) => Promise<boolean>;
  notifyTyping: (isTyping: boolean) => void;
  loadOlderMessages: () => Promise<void>;
  unsendMessage: (messageId: string) => Promise<boolean>;
  searchNewMessageCandidates: (query: string) => Promise<any[]>;
  createOrOpenConversation: (participantIds: string[]) => Promise<string | null>;
  loadConversations: (options?: { silent?: boolean; abortSignal?: AbortSignal }) => Promise<void>;
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

export const MessagesProvider: React.FC<{ children: React.ReactNode; userId: string | undefined }> = ({ children, userId }) => {
  const inbox = useMessagesInbox({ userId });

  return (
    <MessagesContext.Provider value={inbox}>
      {children}
    </MessagesContext.Provider>
  );
};

export const useInbox = () => {
  const context = useContext(MessagesContext);
  if (context === undefined) {
    throw new Error("useInbox must be used within a MessagesProvider");
  }
  return context;
};
