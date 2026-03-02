import React, { useRef, useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { type Conversation, type InboxMessage, type ReplyToPayload } from "@/hooks/useMessagesInbox";
import { TypingIndicatorBubble } from "./TypingIndicator";

interface MessagesThreadViewProps {
  currentUserId: string | null;
  selectedConversation: Conversation;
  messages: InboxMessage[];
  loadingMessages: boolean;
  hasMoreMessages: boolean;
  loadingOlderMessages: boolean;
  peerTyping: boolean;
  peerSeenAt: string | null;
  seenByCount: number;
  otherParticipantCount: number;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onRetryFailedMessage: (messageId: string) => void;
  onUnsend: (messageId: string) => void;
  onLoadOlderMessages: () => void;
  /** Mensaje al que se está respondiendo actualmente */
  replyingTo: ReplyToPayload | null;
  /** Callback cuando el usuario hace click en Responder en un mensaje */
  onReply: (message: InboxMessage) => void;
  /** Callback para cancelar el reply activo */
  onCancelReply: () => void;
  /** Archivos multimedia pendientes de enviar */
  pendingFiles: Array<{ file: File; preview: string }>;
  /** Callback para añadir archivos */
  onFilesAdded: (files: FileList) => void;
  /** Callback para remover un archivo */
  onRemoveFile: (index: number) => void;
}

/** Fallback tipo Instagram cuando no hay avatar. */
const AVATAR_FALLBACK_URL = "/avatar_fallback.jpg";

/** Umbral en px desde el bottom para considerar "cerca del bottom" */
const NEAR_BOTTOM_THRESHOLD = 120;

const formatMessageTime = (isoDate: string) =>
  new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(new Date(isoDate));

const formatSeenTime = (isoDate: string) => {
  const now = Date.now();
  const value = new Date(isoDate).getTime();
  const deltaMs = Math.max(0, now - value);
  const deltaSeconds = Math.floor(deltaMs / 1000);
  const deltaMinutes = Math.floor(deltaSeconds / 60);
  const deltaHours = Math.floor(deltaMinutes / 60);

  if (deltaMinutes < 1) return "Visto hace un momento";
  if (deltaMinutes < 60) return `Visto Hace ${deltaMinutes} min`;
  if (deltaHours < 24) return `Visto Hace ${deltaHours} h`;
  return `Visto el ${new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(new Date(isoDate))}`;
};

const MessagesThreadView = ({
  currentUserId,
  selectedConversation,
  messages,
  loadingMessages,
  hasMoreMessages,
  loadingOlderMessages,
  peerTyping,
  peerSeenAt,
  seenByCount,
  otherParticipantCount,
  draft,
  onDraftChange,
  onSend,
  onRetryFailedMessage,
  onUnsend,
  onLoadOlderMessages,
  replyingTo,
  onReply,
  onCancelReply,
  pendingFiles,
  onFilesAdded,
  onRemoveFile,
}: MessagesThreadViewProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const latestPeerMsgIdRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** ID del mensaje que tiene el menú "Más" abierto */
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Cerrar menú al hacer click fuera
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    if (activeMenuId) {
      window.addEventListener("click", handleClickOutside);
    }
    return () => window.removeEventListener("click", handleClickOutside);
  }, [activeMenuId]);

  // Autofocus en el textarea al activar el modo reply
  useEffect(() => {
    if (replyingTo) {
      textareaRef.current?.focus();
    }
  }, [replyingTo]);

  /** Mensajes nuevos del peer que el user no ha visto (está scrolleado arriba) */
  const [unreadPeerCount, setUnreadPeerCount] = useState(0);
  /** ID del último mensaje del peer para hacer scroll hacia él */
  const [latestPeerMsgId, setLatestPeerMsgId] = useState<string | null>(null);

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomAnchorRef.current?.scrollIntoView({ behavior });
    setUnreadPeerCount(0);
    setLatestPeerMsgId(null);
  }, []);

  const scrollToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`dm-msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      scrollToBottom("smooth");
    }
    setUnreadPeerCount(0);
    setLatestPeerMsgId(null);
  }, [scrollToBottom]);

  // Autoscroll al final cuando aparece el indicador de typing del peer
  useEffect(() => {
    if (peerTyping && isNearBottom()) {
      scrollToBottom("smooth");
    }
  }, [peerTyping, isNearBottom, scrollToBottom]);

  // Scroll instantáneo al cargar la conversación (primera vez)
  useEffect(() => {
    if (!loadingMessages && messages.length > 0) {
      scrollToBottom("instant");
    }
  // Solo cuando cambia la conversación (se resetea loadingMessages)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation.id, loadingMessages]);

  // Detectar mensajes nuevos y decisión de auto-scroll vs botón
  useEffect(() => {
    const prevLen = prevMessagesLengthRef.current;
    const currentLen = messages.length;
    prevMessagesLengthRef.current = currentLen;

    if (currentLen <= prevLen || loadingMessages) return;

    // Mensajes nuevos detectados
    const newMessages = messages.slice(prevLen);
    const newPeerMessages = newMessages.filter((m) => m.senderId !== currentUserId);
    const newOwnMessages = newMessages.filter((m) => m.senderId === currentUserId);

    if (newOwnMessages.length > 0) {
      // Propio mensaje enviado → siempre scroll to bottom
      scrollToBottom("smooth");
      return;
    }

    if (newPeerMessages.length > 0) {
      const lastPeerMsg = newPeerMessages[newPeerMessages.length - 1];
      if (isNearBottom()) {
        // Usuario cerca del bottom → auto-scroll
        scrollToBottom("smooth");
      } else {
        // Usuario scrolleado arriba → mostrar botón
        latestPeerMsgIdRef.current = lastPeerMsg.id;
        setLatestPeerMsgId(lastPeerMsg.id);
        setUnreadPeerCount((prev) => prev + newPeerMessages.length);
      }
    }
  }, [messages, currentUserId, isNearBottom, scrollToBottom, loadingMessages]);

  // Reset del estado de nuevos mensajes cuando el usuario scrollea manualmente al bottom
  const handleScroll = useCallback(() => {
    if (isNearBottom() && unreadPeerCount > 0) {
      setUnreadPeerCount(0);
      setLatestPeerMsgId(null);
    }
  }, [isNearBottom, unreadPeerCount]);

  const latestOwnSentMessageId = [...messages]
    .reverse()
    .find((message) => message.senderId === currentUserId && message.deliveryState === "sent")?.id;

  return (
    <section className="ig-dm-thread">
      <header className="ig-dm-thread-head">
        <div className="ig-dm-thread-head-left">
          <Link href="/direct/inbox">
            <button type="button" className="ig-dm-mobile-back-btn" aria-label="Atrás">
              <svg aria-label="Atrás" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
                <line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="2.909" x2="22.001" y1="12.004" y2="12.004"></line>
                <polyline fill="none" points="9.276 4.726 2.001 12.004 9.276 19.274" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></polyline>
              </svg>
            </button>
          </Link>
          <img
            src={selectedConversation.avatarUrl ?? AVATAR_FALLBACK_URL}
            alt="user-profile-picture"
            className="ig-dm-avatar-44"
          />
          <div className="ig-dm-thread-head-info">
            <strong>{selectedConversation.title || ""}</strong>
            <span>{selectedConversation.username ? `${selectedConversation.username} · Instadetox` : "Instadetox"}</span>
          </div>
        </div>
        <div className="ig-dm-thread-head-actions">
          <button type="button" aria-label="Llamada de audio">
            <svg aria-label="Llamada de audio" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
              <path d="M18.227 22.912c-4.913 0-9.286-3.627-11.486-5.828C4.486 14.83.731 10.291.921 5.231a3.289 3.289 0 0 1 .908-2.138 17.116 17.116 0 0 1 1.865-1.71 2.307 2.307 0 0 1 3.004.174 13.283 13.283 0 0 1 3.658 5.325 2.551 2.551 0 0 1-.19 1.941l-.455.853a.463.463 0 0 0-.024.387 7.57 7.57 0 0 0 4.077 4.075.455.455 0 0 0 .386-.024l.853-.455a2.548 2.548 0 0 1 1.94-.19 13.278 13.278 0 0 1 5.326 3.658 2.309 2.309 0 0 1 .174 3.003 17.319 17.319 0 0 1-1.71 1.866 3.29 3.29 0 0 1-2.138.91 10.27 10.27 0 0 1-.368.006Zm-13.144-20a.27.27 0 0 0-.167.054A15.121 15.121 0 0 0 3.28 4.47a1.289 1.289 0 0 0-.36.836c-.161 4.301 3.21 8.34 5.235 10.364s6.06 5.403 10.366 5.236a1.284 1.284 0 0 0 .835-.36 15.217 15.217 0 0 0 1.504-1.637.324.324 0 0 0-.047-.41 11.62 11.62 0 0 0-4.457-3.119.545.545 0 0 0-.411.044l-.854.455a2.452 2.452 0 0 1-2.071.116 9.571 9.571 0 0 1-5.189-5.188 2.457 2.457 0 0 1 .115-2.071l.456-.855a.544.544 0 0 0 .043-.41 11.629 11.629 0 0 0-3.118-4.458.36.36 0 0 0-.244-.1Z"></path>
            </svg>
          </button>
          <button type="button" aria-label="Videollamada">
            <svg aria-label="Videollamada" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
              <rect fill="none" height="18" rx="3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" width="16.999" x="1" y="3"></rect>
              <path d="m17.999 9.146 2.495-2.256A1.5 1.5 0 0 1 23 8.003v7.994a1.5 1.5 0 0 1-2.506 1.113L18 14.854" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
          </button>
          <button type="button" aria-label="Información de la conversación">
            <svg aria-label="Información de la conversación" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
              <circle cx="12.001" cy="12.005" fill="none" r="10.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></circle>
              <circle cx="11.819" cy="7.709" r="1.25"></circle>
              <line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="10.569" x2="13.432" y1="16.777" y2="16.777"></line>
              <polyline fill="none" points="10.569 11.05 12 11.05 12 16.777" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></polyline>
            </svg>
          </button>
        </div>
      </header>

      {/* Contenedor de scroll del hilo */}
      <div className="ig-dm-thread-body" ref={scrollRef} onScroll={handleScroll}>
        {hasMoreMessages ? (
          <button
            type="button"
            className="ig-dm-load-older-btn"
            onClick={onLoadOlderMessages}
            disabled={loadingOlderMessages}
          >
            {loadingOlderMessages ? "Cargando..." : "Cargar anteriores"}
          </button>
        ) : null}
        {loadingMessages ? (
          <p className="ig-dm-empty-list">Cargando conversacion...</p>
        ) : messages.length === 0 ? (
          <div className="ig-dm-empty-thread">
            <img
              src={selectedConversation.avatarUrl ?? AVATAR_FALLBACK_URL}
              alt="user-profile-picture"
              className="ig-dm-empty-avatar"
            />
            <h2 className="ig-dm-empty-name">{selectedConversation.title}</h2>
            <p className="ig-dm-empty-username">
              {selectedConversation.username ? `${selectedConversation.username} · Instadetox` : "Instadetox"}
            </p>
            <button type="button" className="ig-dm-empty-profile-btn" aria-label="Ver perfil">
              Ver perfil
            </button>
          </div>
        ) : (
          messages.map((message, index) => {
            const mine = message.senderId === currentUserId;
            // Lógica de agrupación (First, Middle, Last)
            const prevMessage = messages[index - 1];
            const nextMessage = messages[index + 1];
            const isFirstInGroup = !prevMessage || prevMessage.senderId !== message.senderId;
            const isLastInGroup = !nextMessage || nextMessage.senderId !== message.senderId;
            const isMiddleInGroup = !isFirstInGroup && !isLastInGroup;
            const isSingle = isFirstInGroup && isLastInGroup;

            // Clases de grupo prioritarias para border-radius
            const groupClass = isSingle ? "is-single" : isFirstInGroup ? "is-first" : isLastInGroup ? "is-last" : isMiddleInGroup ? "is-middle" : "";

            // Mostrar timestamp separador solo si: mensaje tiene reply Y hay 15+ min respecto al anterior (o es el primero)
            const showTimestampSep = Boolean(message.replyTo) && (
              !prevMessage ||
              (new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime()) > 15 * 60 * 1000
            );

            return (
              <React.Fragment key={message.id}>

                {/* TIMESTAMP SEPARADOR — Centrado en TODO el ancho del chat, como en IG */}
                {showTimestampSep ? (
                  <div className="ig-dm-timestamp-separator">
                    <div className="ig-dm-timestamp-separator-wrap">
                      <span
                        className="ig-dm-timestamp-separator-label"
                        dir="auto"
                        style={{ "--x---base-line-clamp-line-height": "16px", "--x-lineHeight": "16px" } as React.CSSProperties}
                      >
                        {formatMessageTime(message.createdAt)}
                      </span>
                    </div>
                  </div>
                ) : null}

                <div
                  id={`dm-msg-${message.id}`}
                  className={`ig-dm-bubble-row${mine ? " is-mine" : ""}${isLastInGroup ? " last-in-group" : ""}`}
                >
                {/* Avatar del otro usuario — solo en el último mensaje del grupo */}
                {!mine ? (
                  <div className="ig-dm-msg-avatar-wrap" aria-hidden="true">
                    {isLastInGroup ? (
                      <img
                        src={selectedConversation.avatarUrl ?? AVATAR_FALLBACK_URL}
                        alt=""
                        className="ig-dm-msg-avatar"
                      />
                    ) : null}
                  </div>
                ) : null}

                <div className={`ig-dm-bubble-wrapper${mine ? " is-mine" : ""}`}>

                  {/* REPLY: Label contextual "Respondiste a X" / "X respondió" */}
                  {message.replyTo ? (
                    <div className="ig-dm-reply-context-row">
                      <span
                        className="ig-dm-reply-context-label"
                        dir="auto"
                        style={{ "--x---base-line-clamp-line-height": "16px", "--x-lineHeight": "16px" } as React.CSSProperties}
                      >
                        {mine
                          ? `Respondiste a ${message.replyTo.username ?? "usuario"}`
                          : `${message.replyTo.username ?? "Usuario"} te respondió`}
                      </span>
                    </div>
                  ) : null}

                  {/* REPLY: Burbuja-fantasma del mensaje citado + borde sutil IG-style */}
                  {message.replyTo ? (
                    <div className={`ig-dm-reply-quoted-row${mine ? " is-mine" : ""}`}>
                      <div className={`ig-dm-reply-quoted-bubble${mine ? " is-mine" : ""}`}>
                        <p className="ig-dm-reply-quoted-body">{message.replyTo.body}</p>
                      </div>
                      {/* Borde sutil — hermano de la burbuja, replica x19g9edo xr9e8f9 x1e4oeot... del DOM de IG */}
                      <div className="ig-dm-reply-quoted-border" />
                    </div>
                  ) : null}

                  {/* BURBUJA PRINCIPAL + HOVER ACTIONS */}
                  <div className={`ig-dm-message-line ${mine ? "is-mine" : ""} ${message.mediaUrl && message.body ? "has-separated-media" : ""}`}>
                    {message.mediaUrl && message.body ? (
                      /* Layout separado: Burbuja arriba, multimedia con botones abajo */
                      <>
                        {/* Fila 1: Burbuja con texto */}
                        <article className={`ig-dm-bubble ${mine ? "is-mine" : ""} ${groupClass} ${message.deliveryState === "sending" ? "is-sending" : ""}`}>
                          <p>{message.body}</p>
                          {mine && (
                            <div className="ig-dm-message-status-container">
                              {message.deliveryState === "sending" && (
                                <span className="ig-dm-status-label is-sending">Enviando...</span>
                              )}
                              {message.deliveryState === "failed" && (
                                <button
                                  type="button"
                                  className="ig-dm-retry-btn-v2"
                                  onClick={() => onRetryFailedMessage(message.id)}
                                >
                                  Reintentar
                                </button>
                              )}
                            </div>
                          )}
                        </article>
                        {/* Fila 2: Multimedia + Botones hover */}
                        <div className="ig-dm-media-row-wrapper">
                          <div className="ig-dm-separated-media">
                            <img
                              src={message.mediaUrl}
                              alt="Multimedia adjunta"
                              className="ig-dm-separated-media-img"
                              onLoad={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (target.complete) window.dispatchEvent(new Event('resize'));
                              }}
                            />
                          </div>
                          {/* BOTONES DE HOVER - al lado de la multimedia */}
                          <div className="ig-dm-hover-actions">
                            <button type="button" className="ig-dm-hover-btn" aria-label="Reaccionar">
                              <svg aria-label="Reaccionar al mensaje" fill="currentColor" height="16" role="img" viewBox="0 0 24 24" width="16">
                                <title>Reaccionar</title>
                                <path d="M15.83 10.997a1.167 1.167 0 1 0 1.167 1.167 1.167 1.167 0 0 0-1.167-1.167Zm-6.5 1.167a1.167 1.167 0 1 0-1.166 1.167 1.167 1.167 0 0 0 1.166-1.167Zm5.163 3.24a3.406 3.406 0 0 1-4.982.007 1 1 0 1 0-1.557 1.256 5.397 5.397 0 0 0 8.09 0 1 1 0 0 0-1.55-1.263ZM12 .503a11.5 11.5 0 1 0 11.5 11.5A11.513 11.513 0 0 0 12 .503Zm0 21a9.5 9.5 0 1 1 9.5-9.5 9.51 9.51 0 0 1-9.5 9.5Z"></path>
                              </svg>
                            </button>
                            <button type="button" className="ig-dm-hover-btn" aria-label="Responder"
                              onClick={(e) => {
                                e.stopPropagation();
                                onReply(message);
                              }}
                            >
                              <svg aria-label="Responder mensaje" fill="currentColor" height="16" role="img" viewBox="0 0 24 24" width="16">
                                <title>Responder</title>
                                <path d="M14 8.999H4.413l5.294-5.292a1 1 0 1 0-1.414-1.414l-7 6.998c-.014.014-.019.033-.032.048A.933.933 0 0 0 1 9.998V10c0 .027.013.05.015.076a.907.907 0 0 0 .282.634l6.996 6.998a1 1 0 0 0 1.414-1.414L4.415 11H14a7.008 7.008 0 0 1 7 7v3.006a1 1 0 0 0 2 0V18a9.01 9.01 0 0 0-9-9Z"></path>
                              </svg>
                            </button>
                            <button
                              type="button"
                              className="ig-dm-hover-btn"
                              aria-label="Más"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === message.id ? null : message.id);
                              }}
                            >
                              <svg aria-label="Ver más opciones" fill="currentColor" height="16" role="img" viewBox="0 0 24 24" width="16">
                                <title>Más</title>
                                <circle cx="12" cy="12" r="1.5"></circle>
                                <circle cx="12" cy="6" r="1.5"></circle>
                                <circle cx="12" cy="18" r="1.5"></circle>
                              </svg>
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      /* Layout normal: Todo dentro de la burbuja */
                      <article className={`ig-dm-bubble ${mine ? "is-mine" : ""} ${message.mediaUrl ? "has-media" : ""} ${message.mediaUrl && !message.body ? "is-media-only" : ""} ${message.deliveryState === "sending" ? "is-sending" : ""} ${groupClass}`}>
                        {message.mediaUrl && (
                          <div className="ig-dm-bubble-media">
                            <img
                              src={message.mediaUrl}
                              alt="Multimedia adjunta"
                              className="ig-dm-message-img"
                              onLoad={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (target.complete) window.dispatchEvent(new Event('resize'));
                              }}
                            />
                          </div>
                        )}
                        {message.body && <p>{message.body}</p>}
                        
                        {/* M12 Feedback de Estado */}
                        {mine && (
                          <div className="ig-dm-message-status-container">
                            {message.deliveryState === "sending" && (
                              <span className="ig-dm-status-label is-sending">Enviando...</span>
                            )}
                            {message.deliveryState === "failed" && (
                              <div className="flex items-center gap-2">
                                <span className="ig-dm-status-label is-failed">Fallo de red</span>
                                <button
                                  type="button"
                                  className="ig-dm-retry-btn-v2"
                                  onClick={() => onRetryFailedMessage(message.id)}
                                >
                                  Reintentar
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    )}

                    {/* BOTONES DE HOVER */}
                    <div className="ig-dm-hover-actions">
                      <button type="button" className="ig-dm-hover-btn" aria-label="Reaccionar">
                        <svg aria-label="Reaccionar al mensaje" fill="currentColor" height="16" role="img" viewBox="0 0 24 24" width="16">
                          <title>Reaccionar</title>
                          <path d="M15.83 10.997a1.167 1.167 0 1 0 1.167 1.167 1.167 1.167 0 0 0-1.167-1.167Zm-6.5 1.167a1.167 1.167 0 1 0-1.166 1.167 1.167 1.167 0 0 0 1.166-1.167Zm5.163 3.24a3.406 3.406 0 0 1-4.982.007 1 1 0 1 0-1.557 1.256 5.397 5.397 0 0 0 8.09 0 1 1 0 0 0-1.55-1.263ZM12 .503a11.5 11.5 0 1 0 11.5 11.5A11.513 11.513 0 0 0 12 .503Zm0 21a9.5 9.5 0 1 1 9.5-9.5 9.51 9.51 0 0 1-9.5 9.5Z"></path>
                        </svg>
                      </button>
                      <button type="button" className="ig-dm-hover-btn" aria-label="Responder"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReply(message);
                        }}
                      >
                        <svg aria-label="Responder mensaje" fill="currentColor" height="16" role="img" viewBox="0 0 24 24" width="16">
                          <title>Responder</title>
                          <path d="M14 8.999H4.413l5.294-5.292a1 1 0 1 0-1.414-1.414l-7 6.998c-.014.014-.019.033-.032.048A.933.933 0 0 0 1 9.998V10c0 .027.013.05.015.076a.907.907 0 0 0 .282.634l6.996 6.998a1 1 0 0 0 1.414-1.414L4.415 11H14a7.008 7.008 0 0 1 7 7v3.006a1 1 0 0 0 2 0V18a9.01 9.01 0 0 0-9-9Z"></path>
                        </svg>
                      </button>
                      <button 
                        type="button" 
                        className="ig-dm-hover-btn" 
                        aria-label="Más" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === message.id ? null : message.id);
                        }}
                      >
                        <svg aria-label="Ver más opciones" fill="currentColor" height="16" role="img" viewBox="0 0 24 24" width="16">
                          <title>Más</title>
                          <circle cx="12" cy="12" r="1.5"></circle>
                          <circle cx="12" cy="6" r="1.5"></circle>
                          <circle cx="12" cy="18" r="1.5"></circle>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* MENÚ "MÁS" DESPLEGABLE */}
                  {activeMenuId === message.id && (
                    <div 
                      className="ig-dm-more-menu-container" 
                      style={{ 
                        bottom: 'calc(100% + 4px)', 
                        right: mine ? '0' : 'auto',
                        left: mine ? 'auto' : '0'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="ig-dm-menu-header">
                        <h3>{new Date(message.createdAt).toLocaleDateString('es-AR', { weekday: 'long' })}</h3>
                        <span>{formatMessageTime(message.createdAt)}</span>
                      </div>
                      
                      <button type="button" className="ig-dm-menu-item">
                        <span>Reenviar</span>
                        <svg aria-label="Reenviar" className="ig-dm-menu-icon" fill="currentColor" height="18" role="img" viewBox="0 0 24 24" width="18">
                          <path d="M13.973 20.046 21.77 6.928C22.8 5.195 21.55 3 19.535 3H4.466C2.138 3 .984 5.825 2.646 7.456l4.842 4.752 1.723 7.121c.548 2.266 3.571 2.721 4.762.717Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2"></path>
                          <line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="7.488" x2="15.515" y1="12.208" y2="7.641"></line>
                        </svg>
                      </button>

                      <button 
                        type="button" 
                        className="ig-dm-menu-item"
                        onClick={() => {
                          navigator.clipboard.writeText(message.body);
                          setActiveMenuId(null);
                        }}
                      >
                        <span>Copiar</span>
                        <svg aria-label="Copiar" className="ig-dm-menu-icon" fill="currentColor" height="18" role="img" viewBox="0 0 24 24" width="18">
                          <path d="m20.12 4.707-2.826-2.828A3.026 3.026 0 0 0 15.17 1h-5.167A3.007 3.007 0 0 0 7 4.004V5h-.996A3.007 3.007 0 0 0 3 8.004v11.992A3.007 3.007 0 0 0 6.004 23h7.992A3.007 3.007 0 0 0 17 19.996V19h.996A3.007 3.007 0 0 0 21 15.996V6.83a2.98 2.98 0 0 0-.88-2.123ZM18.586 6 16 6.001V3.414L18.586 6ZM15 19.996C15 20.55 14.55 21 13.996 21H6.004C5.45 21 5 20.55 5 19.996V8.004C5 7.45 5.45 7 6.004 7H7v8.996A3.007 3.007 0 0 0 10.004 19H15v.996ZM17.996 17h-7.992C9.45 17 9 16.55 9 15.996V4.004C9 3.45 9.45 3 10.004 3H14v3.001A2 2 0 0 0 15.999 8H19v7.996C19 16.55 18.55 17 17.996 17Z"></path>
                        </svg>
                      </button>

                      {mine && (
                        <button 
                          type="button" 
                          className="ig-dm-menu-item is-danger"
                          onClick={() => {
                            onUnsend(message.id);
                            setActiveMenuId(null);
                          }}
                        >
                          <span>Anular envío</span>
                          <svg aria-label="Anular envío" className="ig-dm-menu-icon" fill="currentColor" height="18" role="img" viewBox="0 0 24 24" width="18">
                            <path d="M12 .5C5.659.5.5 5.66.5 12S5.659 23.5 12 23.5c6.34 0 11.5-5.16 11.5-11.5S18.34.5 12 .5Zm0 21c-5.238 0-9.5-4.262-9.5-9.5S6.762 2.5 12 2.5s9.5 4.262 9.5 9.5-4.262 9.5-9.5 9.5Z"></path>
                            <path d="M14.5 10H9.414l1.293-1.293a1 1 0 1 0-1.414-1.414l-3 2.999a1 1 0 0 0 0 1.414l3 3.001a.997.997 0 0 0 1.414 0 1 1 0 0 0 0-1.414L9.415 12H14.5c.827 0 1.5.674 1.5 1.501 0 .395-.157.794-.431 1.096-.227.249-.508.403-.735.403L14 14.999a1 1 0 0 0-.001 2l.833.001h.002c.796 0 1.604-.386 2.215-1.059a3.625 3.625 0 0 0 .951-2.44C18 11.571 16.43 10 14.5 10Z"></path>
                          </svg>
                        </button>
                      )}
                    </div>
                  )}

                  {mine && 
                   messages[messages.length - 1]?.id === message.id && 
                   peerSeenAt && 
                   new Date(peerSeenAt).getTime() >= new Date(message.createdAt).getTime() && (
                    <span 
                      className="x1lliihq x1plvlek xryxfnj x1n2onr6 xyejjpt x15dsfln x193iq5w xeuugli x1fj9vlw x13faqbe x1vvkbs x1s928wv xhkezso x1gmr53x x1cpjm7i x1fgarty x1943h6x x1i0vuye x1fhwpqd xo1l8bm x1roi4f4 x1s3etm8 x676frb x10wh9bi xpm28yp x8viiok x1o7cslx ig-dm-seen-status" 
                      dir="auto"
                      style={{ 
                        "--x---base-line-clamp-line-height": "16px", 
                        "--x-lineHeight": "16px" 
                      } as React.CSSProperties}
                    >
                      {formatSeenTime(peerSeenAt)}
                    </span>
                  )}
                </div>{/* /ig-dm-bubble-wrapper */}
                </div>{/* /ig-dm-bubble-row */}
              </React.Fragment>
            );
          })
        )}
        {/* Typing Indicator - Burbuja animada cuando el peer está escribiendo */}
        {peerTyping && (
          <TypingIndicatorBubble
            avatarUrl={selectedConversation.avatarUrl}
            username={selectedConversation.username ?? "Usuario"}
            size="medium"
            variant="dark"
          />
        )}
        {/* Anchor invisible al final para scrollToBottom */}
        <div ref={bottomAnchorRef} aria-hidden="true" style={{ height: 1 }} />
      </div>

      {/* Botón flotante "Nuevos mensajes" — aparece cuando el user está scrolleado arriba */}
      {unreadPeerCount > 0 && latestPeerMsgId ? (
        <div className="ig-dm-new-msgs-banner-wrap" aria-live="polite">
          <button
            type="button"
            className="ig-dm-new-msgs-banner"
            onClick={() => scrollToMessage(latestPeerMsgId)}
            aria-label={`${unreadPeerCount} mensajes nuevos`}
          >
            <svg className="ig-dm-new-msgs-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            <span>
              {unreadPeerCount === 1
                ? "1 mensaje nuevo"
                : `${unreadPeerCount} mensajes nuevos`}
            </span>
          </button>
        </div>
      ) : null}

      <footer className="ig-dm-thread-composer">
        {/* MEDIA PREVIEW AREA */}
        {pendingFiles.length > 0 && (
          <div className="ig-dm-media-preview-container">
            {/* Botón de añadir más (estética Instagram) */}
            <div className="ig-dm-media-add-more-wrapper">
              <label htmlFor="ig-dm-media-upload-more" className="ig-dm-media-add-more" aria-label="Subir otra foto o video">
                <svg aria-label="Subir otra foto o video" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
                  <path d="M6.549 5.013A1.557 1.557 0 1 0 8.106 6.57a1.557 1.557 0 0 0-1.557-1.557Z" fillRule="evenodd"></path>
                  <path d="m2 18.605 3.901-3.9a.908.908 0 0 1 1.284 0l2.807 2.806a.908.908 0 0 0 1.283 0l5.534-5.534a.908.908 0 0 1 1.283 0l3.905 3.905" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2"></path>
                  <path d="M18.44 2.004A3.56 3.56 0 0 1 22 5.564h0v12.873a3.56 3.56 0 0 1-3.56 3.56H5.568a3.56 3.56 0 0 1-3.56-3.56V5.563a3.56 3.56 0 0 1 3.56-3.56Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                </svg>
                <input
                  id="ig-dm-media-upload-more"
                  type="file"
                  accept="audio/*,.mp4,.mov,.png,.jpg,.jpeg"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files && onFilesAdded(e.target.files)}
                />
              </label>
            </div>

            {/* Lista de Previews */}
            {pendingFiles.map((file, index) => (
              <div key={file.preview} className="ig-dm-media-item">
                <img src={file.preview} alt="adjunto" />
                <button
                  type="button"
                  className="ig-dm-media-remove-btn"
                  onClick={() => onRemoveFile(index)}
                  aria-label="Eliminar archivo adjunto"
                >
                  <svg aria-label="Eliminar archivo adjunto" fill="currentColor" height="10" role="img" viewBox="0 0 24 24" width="10">
                    <polyline fill="none" points="20.643 3.357 12 12 3.353 20.647" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></polyline>
                    <line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" x1="20.649" x2="3.354" y1="20.649" y2="3.354"></line>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* REPLY BANNER — encima del input, sin fondo, paridad IG */}
        {replyingTo ? (
          <div className="ig-dm-reply-banner">
            <div className="ig-dm-reply-banner-content">
              <span
                className="ig-dm-reply-banner-label"
                dir="auto"
                style={{ "--x---base-line-clamp-line-height": "19.9995px", "--x-lineHeight": "19.9995px" } as React.CSSProperties}
              >
                <span style={{ lineHeight: "18px" }}>
                  Respondiendo a{" "}
                  <span className="ig-dm-reply-banner-username" style={{ lineHeight: "18px" }}>
                    {replyingTo.username ?? "Usuario"}
                  </span>
                </span>
              </span>
              <span
                className="ig-dm-reply-banner-body"
                dir="auto"
                style={{ "--x---base-line-clamp-line-height": "16px", "--x-lineHeight": "16px" } as React.CSSProperties}
              >
                {replyingTo.body}
              </span>
            </div>
            <button
              type="button"
              className="ig-dm-reply-cancel-btn"
              onClick={onCancelReply}
              aria-label="Cancelar respuesta"
            >
              <div className="ig-dm-reply-cancel-icon">
                <svg aria-label="Cancelar respuesta" fill="currentColor" height="12" role="img" viewBox="0 0 24 24" width="12">
                  <title>Cancelar respuesta</title>
                  <polyline fill="none" points="20.643 3.357 12 12 3.353 20.647" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                  <line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" x1="20.649" x2="3.354" y1="20.649" y2="3.354" />
                </svg>
              </div>
            </button>
          </div>
        ) : null}

        <div className="ig-dm-composer-wrap">
          <div className="ig-dm-composer-left">
            <button type="button" aria-label="Elegir un emoji">
              <svg aria-label="Elegir un emoji" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
                <path d="M15.83 10.997a1.167 1.167 0 1 0 1.167 1.167 1.167 1.167 0 0 0-1.167-1.167Zm-6.5 1.167a1.167 1.167 0 1 0-1.166 1.167 1.167 1.167 0 0 0 1.166-1.167Zm5.163 3.24a3.406 3.406 0 0 1-4.982.007 1 1 0 1 0-1.557 1.256 5.397 5.397 0 0 0 8.09 0 1 1 0 0 0-1.55-1.263ZM12 .503a11.5 11.5 0 1 0 11.5 11.5A11.513 11.513 0 0 0 12 .503Zm0 21a9.5 9.5 0 1 1 9.5-9.5 9.51 9.51 0 0 1-9.5 9.5Z"></path>
              </svg>
            </button>
          </div>
          <div className="ig-dm-composer-input">
            <textarea
              ref={textareaRef}
              rows={1}
              value={draft}
              onChange={(event) => {
                onDraftChange(event.target.value);
                event.target.style.height = "auto";
                event.target.style.height = `${Math.min(event.target.scrollHeight, 100)}px`;
              }}
              placeholder="Enviar mensaje..."
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (draft.trim().length > 0 || pendingFiles.length > 0) {
                    onSend();
                    const target = event.target as HTMLTextAreaElement;
                    setTimeout(() => { target.style.height = "auto"; }, 0);
                  }
                }
              }}
            />
          </div>
          {(draft.trim().length > 0 || (pendingFiles && pendingFiles.length > 0)) ? (
            <button type="button" className="ig-dm-send-text-btn" onClick={onSend}>
              Enviar
            </button>
          ) : (
            <div className="ig-dm-composer-right">
              <button type="button" aria-label="Clip de voz">
                <svg aria-label="Clip de voz" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
                  <path d="M19.5 10.671v.897a7.5 7.5 0 0 1-15 0v-.897" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                  <line fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" x1="12" x2="12" y1="19.068" y2="22"></line>
                  <line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="8.706" x2="15.104" y1="22" y2="22"></line>
                  <path d="M12 15.745a4 4 0 0 1-4-4V6a4 4 0 0 1 8 0v5.745a4 4 0 0 1-4 4Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                </svg>
              </button>

              <input
                id="ig-dm-media-upload"
                accept="audio/*,.mp4,.mov,.png,.jpg,.jpeg"
                multiple
                type="file"
                style={{ display: "none" }}
                onChange={(e) => e.target.files && onFilesAdded(e.target.files)}
              />
              <label htmlFor="ig-dm-media-upload" className="ig-dm-icon-label" aria-label="Agregar foto o video">
                <svg aria-label="Agregar foto o video" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
                  <path d="M6.549 5.013A1.557 1.557 0 1 0 8.106 6.57a1.557 1.557 0 0 0-1.557-1.557Z" fillRule="evenodd"></path>
                  <path d="m2 18.605 3.901-3.9a.908.908 0 0 1 1.284 0l2.807 2.806a.908.908 0 0 0 1.283 0l5.534-5.534a.908.908 0 0 1 1.283 0l3.905 3.905" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2"></path>
                  <path d="M18.44 2.004A3.56 3.56 0 0 1 22 5.564h0v12.873a3.56 3.56 0 0 1-3.56 3.56H5.568a3.56 3.56 0 0 1-3.56-3.56V5.563a3.56 3.56 0 0 1 3.56-3.56Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                </svg>
              </label>

              <button type="button" aria-label="Elige un GIF o sticker">
                <svg aria-label="Elige un GIF o sticker" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
                  <path d="M13.11 22H7.416A5.417 5.417 0 0 1 2 16.583V7.417A5.417 5.417 0 0 1 7.417 2h9.166A5.417 5.417 0 0 1 22 7.417v5.836a2.083 2.083 0 0 1-.626 1.488l-6.808 6.664A2.083 2.083 0 0 1 13.11 22Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                  <circle cx="8.238" cy="9.943" r="1.335"></circle>
                  <circle cx="15.762" cy="9.943" r="1.335"></circle>
                  <path d="M15.174 15.23a4.887 4.887 0 0 1-6.937-.301" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                  <path d="M22 10.833v1.629a1.25 1.25 0 0 1-1.25 1.25h-1.79a5.417 5.417 0 0 0-5.417 5.417v1.62a1.25 1.25 0 0 1-1.25 1.25H9.897" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                </svg>
              </button>
            </div>
          )}
        </div>
      </footer>
    </section>
  );
};

export default MessagesThreadView;
