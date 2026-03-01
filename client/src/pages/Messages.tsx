import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import MessagesEmptyState from "@/components/messages/MessagesEmptyState";
import MessagesSidebar from "@/components/messages/MessagesSidebar";
import MessagesThreadView from "@/components/messages/MessagesThreadView";
import MessagesNewChatModal from "@/components/messages/MessagesNewChatModal";
import { useInbox } from "@/lib/MessagesContext";
import type { ReplyToPayload } from "@/hooks/useMessagesInbox";

interface PendingFile {
  file: File;
  preview: string;
}

const Messages = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [replyingTo, setReplyingTo] = useState<ReplyToPayload | null>(null);
  const [inboxTab, setInboxTab] = useState<"primary" | "requests">("primary");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const username = user?.username ?? "usuario";

  const {
    conversations,
    selectedConversationId,
    setSelectedConversationId,
    selectedConversation,
    messages,
    loadingConversations,
    loadingMessages,
    peerTyping,
    unreadByConversation,
    requestConversationIds,
    peerSeenAt,
    seenByCount,
    otherParticipantCount,
    hasMoreMessages,
    loadingOlderMessages,
    sendMessage,
    retryFailedMessage,
    notifyTyping,
    loadOlderMessages,
    unsendMessage,
    searchNewMessageCandidates,
    createOrOpenConversation,
  } = useInbox();

  const showMobileThread = Boolean(selectedConversationId);

  return (
    <div className="ig-dm-page">
      <div className="ig-dm-shell">
        <div className={`ig-dm-shell-grid${showMobileThread ? " is-thread-open" : ""}`}>
          <div className="ig-dm-sidebar-col">
            <MessagesSidebar
              username={username}
              conversations={conversations}
              selectedConversationId={selectedConversationId}
              unreadByConversation={unreadByConversation}
              requestConversationIds={requestConversationIds}
              activeTab={inboxTab}
              searchValue={search}
              onSearchChange={setSearch}
              onTabChange={setInboxTab}
              onSelectConversation={setSelectedConversationId}
              onCreateMessage={() => setNewChatOpen(true)}
              loadingConversations={loadingConversations}
            />
          </div>

          <div className="ig-dm-main-col">
            {selectedConversation ? (
              <MessagesThreadView
                currentUserId={user?.id ?? null}
                selectedConversation={selectedConversation}
                messages={messages}
                loadingMessages={loadingMessages}
                hasMoreMessages={hasMoreMessages}
                loadingOlderMessages={loadingOlderMessages}
                peerTyping={peerTyping}
                peerSeenAt={peerSeenAt}
                seenByCount={seenByCount}
                otherParticipantCount={otherParticipantCount}
                draft={draft}
                onDraftChange={(value) => {
                  setDraft(value);
                  notifyTyping(value.trim().length > 0);
                }}
                onSend={() => {
                  const current = draft;
                  const currentReply = replyingTo;
                  const currentFiles = [...pendingFiles]; // Capturamos los archivos actuales
                  setDraft("");
                  setReplyingTo(null);
                  setPendingFiles([]); // Limpiamos archivos pendientes
                  notifyTyping(false);
                  
                  // Pasamos los archivos al hook
                  void sendMessage(current, currentReply ?? undefined, currentFiles.map(f => ({ file: f.file, previewUrl: f.preview }))).then((success) => {
                    if (!success) {
                      setDraft(current);
                      setReplyingTo(currentReply);
                      setPendingFiles(currentFiles);
                      notifyTyping(current.trim().length > 0);
                    }
                  });
                }}
                onRetryFailedMessage={(messageId) => {
                  void retryFailedMessage(messageId);
                }}
                onUnsend={(messageId) => {
                  void unsendMessage(messageId);
                }}
                onLoadOlderMessages={() => {
                  void loadOlderMessages();
                }}
                replyingTo={replyingTo}
              onReply={(msg) => setReplyingTo({ id: msg.id, body: msg.body, senderId: msg.senderId, username: selectedConversation.username ?? null })}
                onCancelReply={() => setReplyingTo(null)}
                pendingFiles={pendingFiles}
                onFilesAdded={(files: FileList) => {
                  const newFiles = Array.from(files).map((file) => ({
                    file,
                    preview: URL.createObjectURL(file),
                  }));
                  setPendingFiles((prev) => [...prev, ...newFiles]);
                }}
                onRemoveFile={(index: number) => {
                  setPendingFiles((prev) => {
                    const next = [...prev];
                    URL.revokeObjectURL(next[index].preview);
                    next.splice(index, 1);
                    return next;
                  });
                }}
              />
            ) : loadingConversations ? null : (
              <MessagesEmptyState onStartMessage={() => setNewChatOpen(true)} />
            )}
          </div>
        </div>
      </div>
      <MessagesNewChatModal
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        searchUsers={searchNewMessageCandidates}
        onCreateConversation={async (participantIds) => {
          const conversationId = await createOrOpenConversation(participantIds);
          return Boolean(conversationId);
        }}
      />
    </div>
  );
};

export default Messages;
