import { type Conversation } from "@/hooks/useMessagesInbox";

interface MessagesSidebarProps {
  username: string;
  conversations: Conversation[];
  selectedConversationId: string | null;
  unreadByConversation: Record<string, number>;
  requestConversationIds: string[];
  activeTab: "primary" | "requests";
  searchValue: string;
  onSearchChange: (value: string) => void;
  onTabChange: (tab: "primary" | "requests") => void;
  onSelectConversation: (conversationId: string) => void;
  onCreateMessage: () => void;
  loadingConversations: boolean;
}

/** Fallback tipo Instagram cuando no hay avatar de conversación. */
const AVATAR_FALLBACK_URL = "/avatar_fallback.jpg";

const formatRelativeTime = (isoDate: string) => {
  const now = Date.now();
  const value = new Date(isoDate).getTime();
  const deltaMs = Math.max(0, now - value);
  const deltaSeconds = Math.floor(deltaMs / 1000);
  const deltaMinutes = Math.floor(deltaSeconds / 60);
  const deltaHours = Math.floor(deltaMinutes / 60);
  const deltaDays = Math.floor(deltaHours / 24);

  if (deltaMinutes < 1) return "ahora";
  if (deltaMinutes < 60) return `${deltaMinutes} min`;
  if (deltaHours < 24) return `${deltaHours} h`;
  if (deltaDays < 7) return `${deltaDays} dias`;
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(new Date(isoDate));
};

const MessagesSidebar = ({
  username,
  conversations,
  selectedConversationId,
  unreadByConversation,
  requestConversationIds,
  activeTab,
  searchValue,
  onSearchChange,
  onTabChange,
  onSelectConversation,
  onCreateMessage,
  loadingConversations,
}: MessagesSidebarProps) => {
  const requestSet = new Set(requestConversationIds);

  const filteredConversations = conversations.filter((conversation) => {
    // Regla Instadetox/Instagram: no renderizar el chat en la lista hasta no enviar primer mensaje
    if (!conversation.preview) return false;

    const term = searchValue.trim().toLowerCase();
    if (!term) return true;
    return (
      (conversation.title?.toLowerCase().includes(term) ?? false) ||
      (conversation.preview?.toLowerCase().includes(term) ?? false)
    );
  });

  const sortByRecentActivity = (a: Conversation, b: Conversation) => {
    const aTime = new Date(a.previewAt ?? a.updatedAt).getTime();
    const bTime = new Date(b.previewAt ?? b.updatedAt).getTime();
    return bTime - aTime;
  };

  const requestConversations = filteredConversations
    .filter((conversation) => requestSet.has(conversation.id))
    .sort(sortByRecentActivity);

  const unreadConversations = filteredConversations
    .filter((conversation) => !requestSet.has(conversation.id))
    .filter((conversation) => (unreadByConversation[conversation.id] ?? 0) > 0)
    .sort((a, b) => {
      const unreadDelta = (unreadByConversation[b.id] ?? 0) - (unreadByConversation[a.id] ?? 0);
      if (unreadDelta !== 0) return unreadDelta;
      return sortByRecentActivity(a, b);
    });

  const primaryConversations = filteredConversations
    .filter((conversation) => !requestSet.has(conversation.id))
    .filter((conversation) => (unreadByConversation[conversation.id] ?? 0) === 0)
    .sort(sortByRecentActivity);

  const quickItems = filteredConversations.slice(0, 8);

  return (
    <aside className="ig-dm-sidebar">
      <header className="ig-dm-sidebar-header">
        <button className="ig-dm-username-btn" type="button" aria-label="Cuenta activa">
          <span className="ig-dm-username">{username}</span>
          <svg
            aria-label="Icono de comilla angular abajo"
            className="ig-dm-chevron-icon"
            fill="currentColor"
            height="12"
            role="img"
            viewBox="0 0 24 24"
            width="12"
          >
            <title>Icono de comilla angular abajo</title>
            <path d="M12 17.502a1 1 0 0 1-.707-.293l-9-9.004a1 1 0 0 1 1.414-1.414L12 15.087l8.293-8.296a1 1 0 0 1 1.414 1.414l-9 9.004a1 1 0 0 1-.707.293Z" />
          </svg>
        </button>

        <button className="ig-dm-icon-btn" type="button" aria-label="Nuevo mensaje" onClick={onCreateMessage}>
          <svg aria-label="Nuevo mensaje" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
            <title>Nuevo mensaje</title>
            <path
              d="M12.202 3.203H5.25a3 3 0 0 0-3 3V18.75a3 3 0 0 0 3 3h12.547a3 3 0 0 0 3-3v-6.952"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
            <path
              d="M10.002 17.226H6.774v-3.228L18.607 2.165a1.417 1.417 0 0 1 2.004 0l1.224 1.225a1.417 1.417 0 0 1 0 2.004Z"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
            <line
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              x1="16.848"
              x2="20.076"
              y1="3.924"
              y2="7.153"
            />
          </svg>
        </button>
      </header>

      <div className="ig-dm-search-wrap">
        <label className="ig-dm-search">
          <div className="ig-dm-search-icon">
            <svg aria-label="Buscar" fill="currentColor" height="16" role="img" viewBox="0 0 24 24" width="16">
              <title>Buscar</title>
              <path d="M19 10.5A8.5 8.5 0 1 1 10.5 2a8.5 8.5 0 0 1 8.5 8.5Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              <line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="16.511" x2="22" y1="16.511" y2="22" />
            </svg>
          </div>
          <input
            autoCapitalize="none"
            autoComplete="off"
            type="text"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar"
            spellCheck
            name="searchInput"
            aria-label="Buscar conversaciones"
          />
        </label>
      </div>

      {/* "Quick Items/Stories" removal requested by user */}

      <div className="ig-dm-sidebar-list-header">
        <h1 className="ig-dm-sidebar-h1">Mensajes</h1>
        <button 
          type="button" 
          className="ig-dm-requests-link"
          onClick={() => onTabChange(activeTab === "requests" ? "primary" : "requests")}
        >
          {activeTab === "requests" 
            ? "Bandeja de entrada" 
            : `Solicitudes${requestConversationIds.length > 0 ? ` (${requestConversationIds.length})` : ""}`}
        </button>
      </div>

      <div className="ig-dm-conversations">
            {activeTab === "requests" && requestConversations.length === 0 ? (
              <p className="ig-dm-empty-list">No hay solicitudes de mensajes.</p>
            ) : null}
            {activeTab === "requests" ? (
              requestConversations.map((conversation) => {
            const selected = selectedConversationId === conversation.id;
            return (
              <button
                key={conversation.id}
                type="button"
                className={`ig-dm-conversation-item${selected ? " is-active" : ""}`}
                onClick={() => onSelectConversation(conversation.id)}
              >
                <div className="ig-dm-conversation-inner-wrap">
                  <div className="ig-dm-conversation-avatar-box">
                    <span className="ig-dm-conversation-avatar-span">
                      <img
                        src={conversation.avatarUrl ?? AVATAR_FALLBACK_URL}
                        alt=""
                        width={56}
                        height={56}
                        className="ig-dm-avatar"
                        referrerPolicy="origin-when-cross-origin"
                      />
                    </span>
                  </div>
                  <div className="ig-dm-conversation-body">
                    <div className="ig-dm-conversation-title-row">
                      <span className="ig-dm-conversation-title" title={conversation.title || undefined}>
                        {conversation.title}
                      </span>
                    </div>
                    <div className="ig-dm-conversation-preview-row">
                      <div className="ig-dm-conversation-preview-text">
                        <span>{conversation.preview ?? "Solicitud de mensaje."}</span>
                        <div className="ig-dm-conversation-time-wrap">
                          <span className="ig-dm-conversation-dot"> · </span>
                          <span className="ig-dm-conversation-time">
                            <abbr>{formatRelativeTime(conversation.previewAt ?? conversation.updatedAt)}</abbr>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
            ) : null}
            {activeTab === "primary" ? (
          <>
            {unreadConversations.length > 0 ? (
              <section className="ig-dm-section">
                <h2 className="ig-dm-section-title">No leidos</h2>
                {unreadConversations.map((conversation) => {
                  const selected = selectedConversationId === conversation.id;
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      className={`ig-dm-conversation-item${selected ? " is-active" : ""}`}
                      onClick={() => onSelectConversation(conversation.id)}
                    >
                      <div className="ig-dm-conversation-inner-wrap">
                        <div className="ig-dm-conversation-avatar-box">
                          <span className="ig-dm-conversation-avatar-span">
                            <img
                              src={conversation.avatarUrl ?? AVATAR_FALLBACK_URL}
                              alt=""
                              width={56}
                              height={56}
                              className="ig-dm-avatar"
                              referrerPolicy="origin-when-cross-origin"
                            />
                          </span>
                        </div>
                        <div className="ig-dm-conversation-body">
                          <div className="ig-dm-conversation-title-row">
                            <span 
                              className="ig-dm-conversation-title is-unread" 
                              title={conversation.title || undefined}
                            >
                              {conversation.title}
                            </span>
                          </div>
                          <div className="ig-dm-conversation-preview-row">
                            <div className="ig-dm-conversation-preview-text is-unread">
                              <span>{conversation.preview ?? "Envia un mensaje para iniciar la charla."}</span>
                              <div className="ig-dm-conversation-time-wrap">
                                <span className="ig-dm-conversation-dot"> · </span>
                                <span className="ig-dm-conversation-time">
                                  <abbr>{formatRelativeTime(conversation.previewAt ?? conversation.updatedAt)}</abbr>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      {(unreadByConversation[conversation.id] ?? 0) > 0 ? (
                        <span className="ig-dm-unread-dot-wrapper" data-visualcompletion="ignore">
                          <div className="ig-dm-unread-dot" title="Unread" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </section>
            ) : null}

            {unreadConversations.length === 0 && primaryConversations.length === 0 ? (
              <p className="ig-dm-empty-list">No hay conversaciones.</p>
            ) : null}

            {primaryConversations.map((conversation) => {
              const selected = selectedConversationId === conversation.id;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={`ig-dm-conversation-item${selected ? " is-active" : ""}`}
                  onClick={() => onSelectConversation(conversation.id)}
                >
                  <div className="ig-dm-conversation-inner-wrap">
                    <div className="ig-dm-conversation-avatar-box">
                      <span className="ig-dm-conversation-avatar-span">
                        <img
                          src={conversation.avatarUrl ?? AVATAR_FALLBACK_URL}
                          alt=""
                          width={56}
                          height={56}
                          className="ig-dm-avatar"
                          referrerPolicy="origin-when-cross-origin"
                        />
                      </span>
                    </div>
                    <div className="ig-dm-conversation-body">
                      <div className="ig-dm-conversation-title-row">
                        <span 
                          className={`ig-dm-conversation-title${(unreadByConversation[conversation.id] ?? 0) > 0 ? " is-unread" : ""}`} 
                          title={conversation.title || undefined}
                        >
                          {conversation.title}
                        </span>
                      </div>
                      <div className="ig-dm-conversation-preview-row">
                        <div className={`ig-dm-conversation-preview-text${(unreadByConversation[conversation.id] ?? 0) > 0 ? " is-unread" : ""}`}>
                          <span>{conversation.preview ?? "Envia un mensaje para iniciar la charla."}</span>
                          <div className="ig-dm-conversation-time-wrap">
                            <span className="ig-dm-conversation-dot"> · </span>
                            <span className="ig-dm-conversation-time">
                              <abbr>{formatRelativeTime(conversation.previewAt ?? conversation.updatedAt)}</abbr>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {(unreadByConversation[conversation.id] ?? 0) > 0 ? (
                    <span className="ig-dm-unread-dot-wrapper" data-visualcompletion="ignore">
                      <div className="ig-dm-unread-dot" title="Unread" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </>
        ) : null}
      </div>
    </aside>
  );
};

export default MessagesSidebar;
