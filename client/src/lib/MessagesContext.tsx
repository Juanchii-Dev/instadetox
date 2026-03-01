import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { generateUUID } from "@/lib/profileUtils";
import { MessageRow, InboxMessage, Conversation, ReplyToPayload, useMessagesInbox } from "@/hooks/useMessagesInbox";

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
