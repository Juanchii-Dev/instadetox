import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useLocation } from "wouter";
import { enqueueMutation } from "@/lib/outbox";

export interface ConversationRow {
  id: string;
  title: string | null;
  is_group: boolean;
  updated_at: string;
}

interface ParticipantRow {
  conversation_id: string;
}

/** Estructura del replyTo persistido en payload.replyTo */
export interface ReplyToPayload {
  id: string;
  body: string;
  senderId: string;
  username?: string | null;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  media_url?: string | null;
  payload?: { replyTo?: ReplyToPayload; mediaUrl?: string | null } | null;
}

export interface Conversation {
  id: string;
  title: string | null;
  isGroup: boolean;
  updatedAt: string;
  preview: string | null;
  previewAt: string | null;
  avatarUrl: string | null;
  username?: string | null;
}

export interface InboxMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  deliveryState: "sending" | "sent" | "failed";
  /** Presente si el mensaje es una respuesta a otro */
  replyTo?: ReplyToPayload;
  /** URL de archivos adjuntos */
  mediaUrl?: string | null;
}

interface UseMessagesInboxParams {
  userId: string | undefined;
}

export interface NewMessageUserSuggestion {
  id: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
}

const PAGE_SIZE = 50;

export const useMessagesInbox = ({ userId }: UseMessagesInboxParams) => {
  const [conversations, setConversationsState] = useState<Conversation[]>(() => {
    if (typeof window !== "undefined" && userId) {
      const cached = localStorage.getItem(`ig_conversations_${userId}`);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          return [];
        }
      }
    }
    return [];
  });

  const setConversations = useCallback((conversations: Conversation[] | ((prev: Conversation[]) => Conversation[])) => {
    setConversationsState((prev) => {
      const next = typeof conversations === "function" ? conversations(prev) : conversations;
      if (typeof window !== "undefined" && userId) {
        localStorage.setItem(`ig_conversations_${userId}`, JSON.stringify(next));
      }
      return next;
    });
  }, [userId]);

  const [location, setLocation] = useLocation();

  // Utilidad universal para generar UUID v4 (Contextos HTTPS y HTTP/Mobile)
  const generateUUID = useCallback(() => {
    if (typeof self !== "undefined" && self.crypto && typeof self.crypto.randomUUID === "function") {
      return self.crypto.randomUUID();
    }
    // Fallback robusto para contextos inseguros (HTTP)
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }, []);

  const urlConversationId = useMemo(() => {
    if (location.startsWith("/direct/t/")) {
      const parts = location.split("/");
      return parts[parts.length - 1];
    }
    return null;
  }, [location]);

  const [selectedConversationId, setLocalSelectedConversationId] = useState<string | null>(urlConversationId);

  // Sync state con URL al navegar directamente
  useEffect(() => {
    if (urlConversationId && urlConversationId !== selectedConversationId) {
      selectedConversationIdRef.current = urlConversationId;
      setLocalSelectedConversationId(urlConversationId);
    } else if (!urlConversationId && selectedConversationId) {
       selectedConversationIdRef.current = null;
       setLocalSelectedConversationId(null);
    }
  }, [urlConversationId]);

  const setSelectedConversationId = useCallback((id: string | null) => {
    selectedConversationIdRef.current = id;
    if (id) {
      setLocation(`/direct/t/${id}`);
    } else {
      setLocation("/direct/inbox");
    }
    setLocalSelectedConversationId(id);
  }, [setLocation]);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [unreadByConversation, setUnreadByConversation] = useState<Record<string, number>>({});
  const [peerSeenAtByConversation, setPeerSeenAtByConversation] = useState<Record<string, string | null>>({});
  const [requestConversationIds, setRequestConversationIds] = useState<string[]>([]);
  const [otherParticipantCountByConversation, setOtherParticipantCountByConversation] = useState<Record<string, number>>({});
  const [seenByCountByConversation, setSeenByCountByConversation] = useState<Record<string, number>>({});
  const hasBootstrappedRef = useRef(false);
  const messagesCacheRef = useRef<Record<string, InboxMessage[]>>({});
  const participantsByConversationRef = useRef<Record<string, string[]>>({});

  // Carga inicial síncrona de cache mensaje para evitar IIFE compleja en useRef
  useEffect(() => {
    if (typeof window !== "undefined" && userId) {
      const cached = localStorage.getItem(`ig_messages_cache_${userId}`);
      if (cached) {
        try {
          messagesCacheRef.current = JSON.parse(cached);
        } catch (e) {
          console.error("Error hidratando cache de mensajes:", e);
        }
      }
    }
  }, [userId]);

  // Efecto persistencia cache mensajes - ACTUALIZADO para guardar inmediatamente
  const persistMessagesCache = useCallback(() => {
    if (typeof window !== "undefined" && userId) {
      localStorage.setItem(`ig_messages_cache_${userId}`, JSON.stringify(messagesCacheRef.current));
    }
  }, [userId]);
  
  // Guardar cuando cambie el estado de mensajes activos
  useEffect(() => {
    persistMessagesCache();
  }, [userId, messages, persistMessagesCache]);
  
  const failedMessagesRef = useRef<Record<string, InboxMessage[]>>({});
  const typingChannelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentAtRef = useRef(0);
  // Ref para selectedConversationId — evita stale closures en handlers de realtime
  const selectedConversationIdRef = useRef<string | null>(null);
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const mergeMessagesById = (items: InboxMessage[]) => {
    const map = new Map<string, InboxMessage>();
    items.forEach((item) => map.set(item.id, item));
    return Array.from(map.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  };

  const moveConversationToTopWithPreview = useCallback((conversationId: string, preview: string, updatedAt: string) => {
    setConversations((prev) => {
      const next = prev.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, preview, previewAt: updatedAt, updatedAt }
          : conversation,
      );
      next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return next;
    });
  }, []);

  const markConversationSeen = useCallback(
    async (conversationId: string) => {
      if (!supabase || !userId) return;
      
      const now = new Date().toISOString();
      
      // 1. Persistencia con manejo de errores
      try {
        const { error } = await supabase.from("conversation_reads").upsert(
          {
            conversation_id: conversationId,
            user_id: userId,
            seen_at: now,
            updated_at: now,
          },
          { onConflict: "conversation_id,user_id" }
        );
        if (error) console.error("Error al marcar como visto:", error);
      } catch (err) {
        console.error("Fallo crítico al marcar como visto:", err);
      }

      // 2. BROADCAST INSTANTÁNEO (con reintento si el canal está conectando)
      const broadcastSeen = () => {
        if (typingChannelRef.current && typingChannelRef.current.state === "joined") {
          void typingChannelRef.current.send({
            type: "broadcast",
            event: "seen",
            payload: { userId, seenAt: now }
          });
          return true;
        }
        return false;
      };

      if (!broadcastSeen()) {
        // Reintentar en 500ms si el canal estaba suscribiéndose
        setTimeout(broadcastSeen, 500);
      }

      setUnreadByConversation((prev) => ({ ...prev, [conversationId]: 0 }));
    },
    [userId],
  );

  const loadConversations = useCallback(async (options?: { silent?: boolean; abortSignal?: AbortSignal }) => {
    if (!supabase || !userId) {
      if (hasBootstrappedRef.current) {
        setConversations([]);
        setSelectedConversationId(null);
        setLoadingConversations(false);
      }
      return;
    }

    const { abortSignal } = options || {};
    const shouldShowLoading = !options?.silent;
    if (shouldShowLoading) {
      setLoadingConversations(true);
    }

    try {
      let participantRows: ParticipantRow[] = [];
      let participantError: any = null;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (abortSignal?.aborted) return;
        const response = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", userId);
        
        participantRows = (response.data ?? []) as ParticipantRow[];
        participantError = response.error;
        if (!participantError) break;
        await sleep(150 * (attempt + 1));
      }

      if (participantError) {
        console.error("M12: loadConversations falló tras reintentos:", participantError);
        // NO limpiamos conversaciones si hay error de red para no romper UX (Resiliencia M12)
        return;
      }
      
      if (abortSignal?.aborted) return;

      const conversationIds = Array.from(new Set(participantRows.map((row) => row.conversation_id)));

      if (conversationIds.length === 0) {
        setConversations([]);
        if (selectedConversationIdRef.current) {
          setLocation("/direct/inbox");
        }
        setSelectedConversationId(null);
        setMessages([]);
        return;
      }

      let conversationRows: ConversationRow[] = [];
      let conversationError: any = null;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (abortSignal?.aborted) return;
        const response = await supabase
          .from("conversations")
          .select("id, title, is_group, updated_at")
          .in("id", conversationIds)
          .order("updated_at", { ascending: false });
        conversationRows = (response.data ?? []) as ConversationRow[];
        conversationError = response.error;
        if (!conversationError) break;
        await sleep(150 * (attempt + 1));
      }

      if (conversationError) {
        console.error("M12: Fallo al cargar detalles de conversaciones:", conversationError);
        return;
      }

      const baseConversations = conversationRows.map((row) => ({
        id: row.id,
        title: row.title?.trim() || "Conversacion",
        isGroup: row.is_group,
        updatedAt: row.updated_at,
        preview: null,
        previewAt: null,
        avatarUrl: null,
        avatar_url: null,
        full_name: null,
        username: null,
      }));

      const { data: participantDetailRows } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", conversationIds);

      const participantRowsByConversation = new Map<string, string[]>();
      ((participantDetailRows ?? []) as Array<{ conversation_id: string; user_id: string }>).forEach((row) => {
        const current = participantRowsByConversation.get(row.conversation_id) ?? [];
        participantRowsByConversation.set(row.conversation_id, [...current, row.user_id]);
      });

      const otherParticipantIds = Array.from(
        new Set(
          Array.from(participantRowsByConversation.values())
            .flatMap((participantIds) => participantIds)
            .filter((participantId) => participantId !== userId),
        ),
      );

      const profileById = new Map<
        string,
        { username: string | null; full_name: string | null; avatar_url: string | null }
      >();
      if (otherParticipantIds.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", otherParticipantIds);
        (
          (profileRows ?? []) as Array<{
            id: string;
            username: string | null;
            full_name: string | null;
            avatar_url: string | null;
          }>
        ).forEach((row) => {
          profileById.set(row.id, {
            username: row.username,
            full_name: row.full_name,
            avatar_url: row.avatar_url,
          });
        });
      }

      let followingSet = new Set<string>();
      if (otherParticipantIds.length > 0) {
        const { data: followingRows } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", userId)
          .in("following_id", otherParticipantIds);

        followingSet = new Set(
          ((followingRows ?? []) as Array<{ following_id: string | null }>)
            .map((row) => row.following_id)
            .filter((id): id is string => typeof id === "string"),
        );
      }

      const { data: recentRows } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body, media_url, created_at, payload")
        .in("conversation_id", conversationIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500);

      const previewByConversationId = new Map<string, MessageRow>();

      ((recentRows ?? []) as MessageRow[]).forEach((row) => {
        if (!previewByConversationId.has(row.conversation_id)) {
          previewByConversationId.set(row.conversation_id, row);
        }
      });

      const nextConversations = baseConversations.map((row) => {
        const latest = previewByConversationId.get(row.id);
        const participantIds = participantRowsByConversation.get(row.id) ?? [];
        const counterpartIds = participantIds.filter((participantId) => participantId !== userId);
        const directCounterpart = !row.isGroup && counterpartIds.length === 1 ? profileById.get(counterpartIds[0]) : null;

        const resolvedTitle =
          directCounterpart?.full_name?.trim() ||
          directCounterpart?.username ||
          row.title;

        return {
          ...row,
          title: resolvedTitle,
          preview: latest?.body ? latest.body : (latest?.media_url || latest?.payload?.mediaUrl ? "Foto 📷" : null),
          previewAt: latest?.created_at ?? null,
          avatarUrl: directCounterpart?.avatar_url ?? null,
          username: directCounterpart?.username ?? null,
        };
      });

      const nextOtherParticipantCountByConversation = nextConversations.reduce<Record<string, number>>((acc, conversation) => {
        const participantIds = participantRowsByConversation.get(conversation.id) ?? [];
        acc[conversation.id] = participantIds.filter((participantId) => participantId !== userId).length;
        return acc;
      }, {});

      const nextRequestConversationIds = nextConversations
        .filter((conversation) => !conversation.isGroup)
        .filter((conversation) => {
          const participantIds = participantRowsByConversation.get(conversation.id) ?? [];
          const counterpartIds = participantIds.filter((participantId) => participantId !== userId);
          if (counterpartIds.length !== 1) return false;
          return !followingSet.has(counterpartIds[0]);
        })
        .map((conversation) => conversation.id);

      setConversations(nextConversations);
      setOtherParticipantCountByConversation(nextOtherParticipantCountByConversation);
      setRequestConversationIds(nextRequestConversationIds);
      
      // Guardar participantes para broadcast de realtime
      const participantIdsMap: Record<string, string[]> = {};
      participantRowsByConversation.forEach((ids, convId) => {
        participantIdsMap[convId] = ids;
      });
      participantsByConversationRef.current = participantIdsMap;

      // Carga asíncrona de no leídos
      if (typeof loadUnreadCounts !== "undefined") {
        void loadUnreadCounts(nextConversations.map((row) => row.id));
      }
    } finally {
      setLoadingConversations(false);
      hasBootstrappedRef.current = true;
    }
  }, [supabase, userId]);
 // Removido loadUnreadCounts de dependencias para evitar circularidad masiva si fuera necesario, pero loadUnreadCounts ya es estable.

  const loadUnreadCounts = useCallback(
    async (conversationIds: string[]) => {
      if (!supabase || !userId || conversationIds.length === 0) {
        setUnreadByConversation({});
        return;
      }

      const { data } = await supabase.rpc("get_unread_counts", {
        p_conversation_ids: conversationIds,
      });

      const next = ((data ?? []) as Array<{ conversation_id: string; unread_count: number }>).reduce<Record<string, number>>(
        (acc, row) => {
          acc[row.conversation_id] = Math.max(0, Number(row.unread_count ?? 0));
          return acc;
        },
        {},
      );

      if (selectedConversationIdRef.current) {
        next[selectedConversationIdRef.current] = 0;
      }

      setUnreadByConversation(next);
    },
    [userId],
  );

  const loadPeerSeenAt = useCallback(
    async (conversationId: string) => {
      if (!supabase || !userId) return;

      const { data } = await supabase
        .from("conversation_reads")
        .select("seen_at")
        .eq("conversation_id", conversationId)
        .neq("user_id", userId)
        .order("seen_at", { ascending: false })
        .limit(1);

      const latestSeenAt =
        Array.isArray(data) && data.length > 0 && typeof data[0]?.seen_at === "string"
          ? data[0].seen_at
          : null;

      setPeerSeenAtByConversation((prev) => ({ ...prev, [conversationId]: latestSeenAt }));
    },
    [userId],
  );

  const loadSeenByCount = useCallback(
    async (conversationId: string, lastOwnSentAt: string | null) => {
      if (!supabase || !userId || !lastOwnSentAt) {
        setSeenByCountByConversation((prev) => ({ ...prev, [conversationId]: 0 }));
        return;
      }

      const { data } = await supabase
        .from("conversation_reads")
        .select("user_id")
        .eq("conversation_id", conversationId)
        .neq("user_id", userId)
        .gte("seen_at", lastOwnSentAt);

      setSeenByCountByConversation((prev) => ({
        ...prev,
        [conversationId]: Array.isArray(data) ? data.length : 0,
      }));
    },
    [userId],
  );

  const processedMessageIdsRef = useRef<Set<string>>(new Set());

  // --- LÓGICA DE ACTUALIZACIÓN UNIVERSAL (SIDEBAR + THREAD) ---
  const handleInboundMessage = useCallback((msg: InboxMessage) => {
    // Deduplicación basada en ID (M12 - Anti-parpadeo)
    if (processedMessageIdsRef.current.has(msg.id)) return;
    processedMessageIdsRef.current.add(msg.id);
    
    // Limpieza periódica del Set para evitar leaks de memoria
    if (processedMessageIdsRef.current.size > 200) {
      const ids = Array.from(processedMessageIdsRef.current);
      processedMessageIdsRef.current = new Set(ids.slice(100)); // Mantener los últimos 100
    }

    // 1. Actualización inmediata del preview del Sidebar (Feel 0ms)
    const previewText = msg.mediaUrl ? "Enviaste una foto" : msg.body?.trim();
    moveConversationToTopWithPreview(msg.conversationId, previewText, msg.createdAt);

    // 2. Actualizar Cache Global (M12 - Persistencia total e inmediata)
    // Siempre actualizamos el cache, aunque la conversación no esté seleccionada,
    // para que al entrar al chat el mensaje ya esté renderizado.
    const currentCached = messagesCacheRef.current[msg.conversationId] ?? [];
    if (!currentCached.some((m) => m.id === msg.id)) {
      const nextCache = [...currentCached, msg].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      messagesCacheRef.current[msg.conversationId] = nextCache;
      // Persistencia en localStorage si es necesario
      if (typeof persistMessagesCache === "function") {
        persistMessagesCache();
      }
    }

    // 3. Si el chat está abierto, hidratar el estado activo (UI)
    if (selectedConversationIdRef.current === msg.conversationId) {
      if (msg.senderId !== userId) {
        void markConversationSeen(msg.conversationId);
      }
      setMessages(messagesCacheRef.current[msg.conversationId]);
    }

    // 3. REFRESH MANDATORIO & OPTIMISTIC BADGE (SSOT M12)
    // Actualizamos localmente para 0ms de respuesta visual
    if (msg.senderId !== userId && selectedConversationIdRef.current !== msg.conversationId) {
      setUnreadByConversation((prev) => ({
        ...prev,
        [msg.conversationId]: (prev[msg.conversationId] ?? 0) + 1,
      }));
    }

    // Forzamos una recarga silenciosa de la DB para garantizar consistencia final
    void loadConversations({ silent: true });
  }, [loadConversations, markConversationSeen, moveConversationToTopWithPreview, userId]);


  const searchNewMessageCandidates = useCallback(
    async (query: string) => {
      if (!supabase || !userId) return [] as NewMessageUserSuggestion[];

      const trimmed = query.trim();
      if (trimmed.length === 0) {
        const { data: followingRows } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", userId)
          .limit(30);

        const followingIds = ((followingRows ?? []) as Array<{ following_id: string | null }>)
          .map((row) => row.following_id)
          .filter((id): id is string => typeof id === "string");

        if (followingIds.length > 0) {
          const { data: profilesRows } = await supabase
            .from("profiles")
            .select("id, username, full_name, avatar_url")
            .in("id", followingIds)
            .limit(25);

          return ((profilesRows ?? []) as Array<{ id: string; username: string | null; full_name: string | null; avatar_url: string | null }>)
            .filter((row) => row.id !== userId && typeof row.username === "string")
            .map((row) => ({
              id: row.id,
              username: row.username ?? "",
              fullName: row.full_name,
              avatarUrl: row.avatar_url,
            }));
        }
      }

      // Búsqueda Enterprise FTS (M12)
      // Generamos un tsquery simple: si hay espacios, los unimos con & (AND) para precisión
      const ftsQuery = trimmed.split(/\s+/).filter(Boolean).join(" & ");
      
      const { data: rows } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .neq("id", userId)
        .textSearch("search_vector", ftsQuery, { 
          config: "simple"
        })
        .limit(25);

      return ((rows ?? []) as Array<{ id: string; username: string | null; full_name: string | null; avatar_url: string | null }>)
        .filter((row) => typeof row.username === "string")
        .map((row) => ({
          id: row.id,
          username: row.username ?? "",
          fullName: row.full_name,
          avatarUrl: row.avatar_url,
        }));
    },
    [userId],
  );

  const findExistingDirectConversation = useCallback(
    async (targetUserId: string) => {
      if (!supabase || !userId) return null;

      const { data: myRows } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", userId);

      const myConversationIds = ((myRows ?? []) as Array<{ conversation_id: string }>).map((row) => row.conversation_id);
      if (myConversationIds.length === 0) return null;

      const { data: targetRows } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", targetUserId)
        .in("conversation_id", myConversationIds);

      const candidateIds = ((targetRows ?? []) as Array<{ conversation_id: string }>).map((row) => row.conversation_id);
      if (candidateIds.length === 0) return null;

      const [{ data: participantRows }, { data: conversationRows }] = await Promise.all([
        supabase.from("conversation_participants").select("conversation_id, user_id").in("conversation_id", candidateIds),
        supabase.from("conversations").select("id, is_group, updated_at").in("id", candidateIds).eq("is_group", false),
      ]);

      const allowedConversationIds = new Set(
        ((conversationRows ?? []) as Array<{ id: string }>).map((row) => row.id),
      );
      if (allowedConversationIds.size === 0) return null;

      const byConversation = new Map<string, Set<string>>();
      ((participantRows ?? []) as Array<{ conversation_id: string; user_id: string }>).forEach((row) => {
        if (!allowedConversationIds.has(row.conversation_id)) return;
        const set = byConversation.get(row.conversation_id) ?? new Set<string>();
        set.add(row.user_id);
        byConversation.set(row.conversation_id, set);
      });

      const directCandidates = ((conversationRows ?? []) as Array<{ id: string; updated_at: string }>).filter((row) => {
        const participants = byConversation.get(row.id);
        if (!participants || participants.size !== 2) return false;
        return participants.has(userId) && participants.has(targetUserId);
      });

      directCandidates.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      return directCandidates[0]?.id ?? null;
    },
    [userId],
  );

  const createOrOpenConversation = useCallback(
    async (participantIds: string[]) => {
      if (!supabase || !userId) return null;

      const uniqueParticipantIds = Array.from(
        new Set(
          participantIds
            .map((id) => id.trim())
            .filter((id) => id.length > 0 && id !== userId),
        ),
      );
      if (uniqueParticipantIds.length === 0) return null;

      if (uniqueParticipantIds.length === 1) {
        const existingId = await findExistingDirectConversation(uniqueParticipantIds[0]);
        if (existingId) {
          setSelectedConversationId(existingId);
          await loadConversations({ silent: true });
          return existingId;
        }
      }

      const isGroup = uniqueParticipantIds.length > 1;
      const { data: conversation, error: conversationError } = await supabase
        .from("conversations")
        .insert({
          created_by: userId,
          is_group: isGroup,
          title: isGroup ? "Grupo" : null,
        })
        .select("id")
        .single();

      if (conversationError || !conversation?.id) {
        return null;
      }

      const rows = [userId, ...uniqueParticipantIds].map((id) => ({
        conversation_id: conversation.id,
        user_id: id,
      }));

      const { error: participantsError } = await supabase
        .from("conversation_participants")
        .insert(rows);

      if (participantsError) {
        return null;
      }

      setSelectedConversationId(conversation.id);
      await loadConversations({ silent: true });
      return conversation.id;
    },
    [findExistingDirectConversation, loadConversations, userId],
  );

  const loadMessages = useCallback(async (conversation_id: string, options?: { silent?: boolean; abortSignal?: AbortSignal }) => {
    if (!supabase) return;

    const { abortSignal } = options || {};
    const shouldShowLoading = !options?.silent;
    const cached = messagesCacheRef.current[conversation_id] ?? [];
    
    // Hidratación instantánea
    if (cached.length > 0) {
      setMessages(cached);
    }
    
    if (shouldShowLoading && cached.length === 0) {
      setLoadingMessages(true);
    }

    try {
      let data: MessageRow[] = [];
      let messageError: any = null;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (abortSignal?.aborted) return;
        const response = await supabase
          .from("messages")
          .select("id, conversation_id, sender_id, body, created_at, payload, media_url")
          .eq("conversation_id", conversation_id)
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
          .limit(PAGE_SIZE);
        data = (response.data ?? []) as MessageRow[];
        messageError = response.error;
        if (!messageError) break;
        await sleep(150 * (attempt + 1));
      }

      if (messageError) {
        console.error("M12: Error al cargar mensajes:", messageError);
        return;
      }

      if (abortSignal?.aborted) return;

      const dbMessages = data.map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        body: row.body,
        createdAt: row.created_at,
        deliveryState: "sent" as const,
        replyTo: row.payload?.replyTo ?? undefined,
        mediaUrl: row.media_url || row.payload?.mediaUrl || null,
      }));

      // Fusión Inteligente (M12 - Anti Race Condition)
      // Combinamos lo que viene de la DB con lo que ya tenemos en cache (RT / Optimista)
      const currentCache = messagesCacheRef.current[conversation_id] ?? [];
      const merged = mergeMessagesById([...dbMessages, ...currentCache]);

      messagesCacheRef.current[conversation_id] = merged;
      if (typeof persistMessagesCache === "function") {
        persistMessagesCache();
      }
      setMessages(merged);
      setHasMoreMessages(dbMessages.length >= PAGE_SIZE);

      // --- FALLBACK DE VISTO (Mobile Stability) ---
      void loadPeerSeenAt(conversation_id);
      const latestOwnSentAt = [...merged]
        .reverse()
        .find((m) => m.senderId === userId && m.deliveryState === "sent")?.createdAt ?? null;
      void loadSeenByCount(conversation_id, latestOwnSentAt);
    } finally {
      if (shouldShowLoading) {
        setLoadingMessages(false);
      }
    }
  }, [loadPeerSeenAt, loadSeenByCount, userId]);

  const loadOlderMessages = useCallback(async () => {
    if (!supabase || !selectedConversationId || loadingOlderMessages || !hasMoreMessages) return;

    const current = messagesCacheRef.current[selectedConversationId] ?? messages;
    const sentMessages = current.filter((message) => !message.id.startsWith("optimistic-"));
    const oldest = sentMessages[0];
    if (!oldest) {
      setHasMoreMessages(false);
      return;
    }

    setLoadingOlderMessages(true);
    try {
      const { data } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body, created_at, payload, media_url")
        .eq("conversation_id", selectedConversationId)
        .lt("created_at", oldest.createdAt)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      const chunk = ((data ?? []) as MessageRow[])
        .map((row) => ({
          id: row.id,
          conversationId: row.conversation_id,
          senderId: row.sender_id,
          body: row.body,
          createdAt: row.created_at,
          deliveryState: "sent" as const,
          replyTo: row.payload?.replyTo ?? undefined,
          mediaUrl: row.media_url || row.payload?.mediaUrl || null,
        }))
        .reverse();

      const merged = mergeMessagesById([...chunk, ...current]);
      messagesCacheRef.current[selectedConversationId] = merged;
      setMessages(merged);
      setHasMoreMessages(chunk.length >= PAGE_SIZE);
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [hasMoreMessages, loadingOlderMessages, messages, selectedConversationId]);

  const sendMessage = useCallback(
    async (body: string, replyTo?: ReplyToPayload, pendingFiles?: Array<{ file: File; previewUrl: string }>) => {
      if (!supabase || !userId || !selectedConversationId) return false;
      const trimmed = body.trim();
      if (!trimmed && (!pendingFiles || pendingFiles.length === 0)) return false;

      const finalId = generateUUID();
      const now = new Date().toISOString();
      
      const message: InboxMessage = {
        id: finalId,
        conversationId: selectedConversationId,
        senderId: userId,
        body: trimmed,
        createdAt: now,
        deliveryState: "sending", // Estado inicial de envío (0ms UX)
        replyTo,
        mediaUrl: pendingFiles && pendingFiles.length > 0 ? pendingFiles[0].previewUrl : null,
      };

      // 1. Actualización Local Instantánea (0ms)
      setMessages((prev) => [...prev, message]);
      const currentHilo = messagesCacheRef.current[selectedConversationId] ?? [];
      messagesCacheRef.current[selectedConversationId] = [...currentHilo, message];
      persistMessagesCache(); // Guardar inmediatamente en localStorage
      // Si hay multimedia, mostrar "Enviaste una foto" para paridad con Instagram
      const previewAt = pendingFiles && pendingFiles.length > 0 ? "Enviaste una foto" : trimmed;
      moveConversationToTopWithPreview(selectedConversationId, previewAt, now);

      // 3. Persistencia y Broadcast en Segundo Plano
      void (async () => {
        if (!supabase) return;
        
        let uploadedUrl: string | null = null;

        // A. Subida de multimedia si existe
        if (pendingFiles && pendingFiles.length > 0) {
          try {
            const fileToUpload = pendingFiles[0].file;
            const fileExt = fileToUpload.name.split('.').pop();
            const fileName = `${userId}/${selectedConversationId}/${generateUUID()}.${fileExt}`;
            const filePath = `chat/${fileName}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('chat_media')
              .upload(filePath, fileToUpload);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
              .from('chat_media')
              .getPublicUrl(filePath);
            
            uploadedUrl = publicUrl;
          } catch (storageError) {
            console.error("Error subiendo multimedia:", storageError);
            const markFailed = (prev: InboxMessage[]) => 
              prev.map(m => m.id === finalId ? { ...m, deliveryState: "failed" as const } : m);
            setMessages(markFailed);
            return;
          }
        }

        // B. BROADCAST MULTI-CANAL (Después de la subida para tener la URL pública)
        const peers = (participantsByConversationRef.current[selectedConversationId] ?? [])
          .filter(id => id !== userId);

        const broadcastMessage = {
          type: "broadcast",
          event: "new_message",
          payload: { ...message, mediaUrl: uploadedUrl, deliveryState: "sent" } 
        } as const;

        // A la conversación activa
        if (typingChannelRef.current && typingChannelRef.current.state === "joined") {
          void typingChannelRef.current.send(broadcastMessage);
        }

        // A los Inbox de los peers
        peers.forEach(peerId => {
          if (!supabase) return;
          const peerInboxChannel = supabase.channel(`inbox:${peerId}`);
          peerInboxChannel.subscribe((status) => {
            if (status === "SUBSCRIBED") {
              void peerInboxChannel.send(broadcastMessage).then(() => {
                if (supabase) void supabase.removeChannel(peerInboxChannel);
              });
            }
          });
        });

        const dbPayload = {
          ...(replyTo ? { replyTo } : {}),
          ...(uploadedUrl ? { mediaUrl: uploadedUrl } : {})
        };
        try {
          const { error } = await supabase.from("messages").insert({
            id: finalId,
            conversation_id: selectedConversationId,
            sender_id: userId,
            body: trimmed,
            created_at: now,
            ...(Object.keys(dbPayload).length > 0 ? { payload: dbPayload } : {}),
          });

          if (error) throw error;

          const markSent = (prev: InboxMessage[]) => 
            prev.map(m => m.id === finalId ? { ...m, deliveryState: "sent" as const, mediaUrl: uploadedUrl } : m);
          
          setMessages(markSent);
          if (messagesCacheRef.current[selectedConversationId]) {
            messagesCacheRef.current[selectedConversationId] = markSent(messagesCacheRef.current[selectedConversationId]);
            persistMessagesCache(); // Guardar inmediatamente
          }

          void supabase.from("conversations").update({ updated_at: now }).eq("id", selectedConversationId);
        } catch (error: any) {
          console.error("Error persistencia mensaje (Background) -> Encolando en Outbox:", error);
          
          // M12 Resiliencia: Si es un error de red o timeout, guardar en el Outbox persistente
          const isNetworkError = !window.navigator.onLine || 
                                error.message?.includes('fetch') || 
                                error.code === 'PGRST301' || 
                                error.status === 0;

          if (isNetworkError) {
             await enqueueMutation({
                id: finalId,
                userId: userId,
                type: 'message',
                payload: {
                  conversationId: selectedConversationId,
                  body: trimmed,
                  dbPayload: {
                    ...(replyTo ? { replyTo } : {}),
                    ...(uploadedUrl ? { mediaUrl: uploadedUrl } : {})
                  }
                },
                createdAt: now
             });
             // El mensaje se queda en "sending" o podemos crear un estado de "queued" 
             // Para esta fase lo mantendremos en la UI para que el retry engine lo maneje.
          } else {
            const markFailed = (prev: InboxMessage[]) => 
              prev.map(m => m.id === finalId ? { ...m, deliveryState: "failed" as const } : m);
            
            setMessages(markFailed);
            if (messagesCacheRef.current[selectedConversationId]) {
              messagesCacheRef.current[selectedConversationId] = markFailed(messagesCacheRef.current[selectedConversationId]);
            }
          }
        }
      })();

      return true;
    },
    [moveConversationToTopWithPreview, selectedConversationId, userId],
  );

  const retryFailedMessage = useCallback(
    async (messageId: string) => {
      if (!selectedConversationId) return false;
      const failedMessages = failedMessagesRef.current[selectedConversationId] ?? [];
      const target = failedMessages.find((message) => message.id === messageId);
      if (!target) return false;

      failedMessagesRef.current[selectedConversationId] = failedMessages.filter((message) => message.id !== messageId);
      setMessages((prev) => prev.filter((message) => message.id !== messageId));
      messagesCacheRef.current[selectedConversationId] = (messagesCacheRef.current[selectedConversationId] ?? []).filter(
        (message) => message.id !== messageId,
      );

      return sendMessage(target.body);
    },
    [selectedConversationId, sendMessage],
  );

  const unsendMessage = useCallback(
    async (messageId: string) => {
      if (!supabase || !selectedConversationId) return false;

      // 1. BROADCAST INSTANTÁNEO (0ms para los demás)
      if (typingChannelRef.current && typingChannelRef.current.state === "joined") {
        void typingChannelRef.current.send({
          type: "broadcast",
          event: "delete_message",
          payload: { messageId, conversationId: selectedConversationId }
        });
      }

      // 2. Actualización Local Instantánea
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      messagesCacheRef.current[selectedConversationId] = (messagesCacheRef.current[selectedConversationId] ?? []).filter(
        (m) => m.id !== messageId
      );

      // 3. Persistencia Silenciosa
      void (async () => {
        const { error } = await supabase.from("messages").delete().eq("id", messageId);
        if (error) {
          console.error("Error al anular envío:", error);
          // Opcional: Podríamos restaurar el mensaje si falla, pero en IG suele ser destructivo
        } else {
          void loadConversations({ silent: true });
        }
      })();

      return true;
    },
    [loadConversations, selectedConversationId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadConversations({ abortSignal: controller.signal });
    return () => controller.abort();
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      setPeerTyping(false);
      return;
    }

    // 1. Limpiar/Resetear estado unreads localmente
    setUnreadByConversation((prev) => {
      if (!prev[selectedConversationId]) return prev;
      return { ...prev, [selectedConversationId]: 0 };
    });
    
    // 2. Hidratación Atómica (M12 - Anti-leak de conversaciones previas)
    // Sincronizamos el estado de mensajes con el cache INMEDIATAMENTE
    const cachedMessages = messagesCacheRef.current[selectedConversationId] ?? [];
    setMessages(cachedMessages);
    
    // 3. Carga en segundo plano (SSOT)
    const controller = new AbortController();
    const isSilent = cachedMessages.length > 0;
    
    void loadMessages(selectedConversationId, { 
      silent: isSilent, 
      abortSignal: controller.signal 
    });
    void loadPeerSeenAt(selectedConversationId);
    
    return () => controller.abort();
  }, [loadMessages, loadPeerSeenAt, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    const latestOwnSentAt =
      [...messages]
        .reverse()
        .find((message) => message.senderId === userId && message.deliveryState === "sent")?.createdAt ?? null;
    void loadSeenByCount(selectedConversationId, latestOwnSentAt);
  }, [loadSeenByCount, messages, selectedConversationId, userId]);

  useEffect(() => {
    if (!supabase || !userId) return;

    const client = supabase;
    // CANAL GLOBAL: PERSISTENTE DURANTE TODA LA SESIÓN
    // Recibe mensajes de CUALQUIER conversación
    const globalChannel = client.channel(`inbox:${userId}`);

    const handleMessageEvent = (payload: RealtimePostgresChangesPayload<MessageRow>) => {
      if (payload.eventType === "INSERT") {
        const row = payload.new as MessageRow;
        const msg: InboxMessage = {
          id: row.id,
          conversationId: row.conversation_id,
          senderId: row.sender_id,
          body: row.body,
          createdAt: row.created_at,
          deliveryState: "sent",
          mediaUrl: (row.payload as any)?.mediaUrl ?? (row as any).media_url ?? null,
          replyTo: (row.payload as any)?.replyTo ?? undefined
        };
        handleInboundMessage(msg);
      } else {
        void loadConversations({ silent: true });
        if (selectedConversationIdRef.current === (payload.old as MessageRow)?.conversation_id) {
          void loadMessages(selectedConversationIdRef.current!, { silent: true });
        }
      }
    };

    globalChannel.on("broadcast", { event: "new_message" }, ({ payload }: { payload: any }) => {
      const msg = payload as InboxMessage | null;
      if (msg && msg.id && msg.conversationId) {
        handleInboundMessage(msg);
      }
    });

    globalChannel.on("broadcast", { event: "delete_message" }, ({ payload }: { payload: any }) => {
      const { messageId, conversationId } = payload || {};
      if (!messageId || !conversationId) return;

      if (selectedConversationIdRef.current === conversationId) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        messagesCacheRef.current[conversationId] = (messagesCacheRef.current[conversationId] ?? []).filter(
          (m) => m.id !== messageId
        );
      }
      void loadConversations({ silent: true });
    });

    globalChannel.on("postgres_changes", { event: "*", schema: "public", table: "messages" }, handleMessageEvent);
    globalChannel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "conversation_participants", filter: `user_id=eq.${userId}` },
      () => { void loadConversations({ silent: true }); },
    );
    globalChannel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "conversations" },
      () => { void loadConversations({ silent: true }); },
    );
    globalChannel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "conversation_reads" },
      (payload: RealtimePostgresChangesPayload<any>) => {
        const row = payload.eventType === "DELETE" ? payload.old : payload.new;
        const rawConversationId = row?.conversation_id;
        if (typeof rawConversationId !== "string") return;
        const currentConversationId = selectedConversationIdRef.current;
        if (currentConversationId === rawConversationId) {
          void loadPeerSeenAt(rawConversationId);
          // Actualizar contador "Visto por n"
          const currentMessages = messagesCacheRef.current[rawConversationId] ?? [];
          const latestOwnSentAt = [...currentMessages]
            .reverse()
            .find((m) => m.senderId === userId && m.deliveryState === "sent")?.createdAt ?? null;
          void loadSeenByCount(rawConversationId, latestOwnSentAt);
        }
      },
    );

    globalChannel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        console.log("Canal Global (Inbox): SUBSCRIBED");
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("Error en Canal Global:", status);
      }
    });

    return () => {
      if (globalChannel) void client.removeChannel(globalChannel);
    };
  }, [handleInboundMessage, loadConversations, loadMessages, loadPeerSeenAt, markConversationSeen, moveConversationToTopWithPreview, userId]);

  useEffect(() => {
    if (!supabase || !selectedConversationId || !userId) return;
    const client = supabase;

    if (typingChannelRef.current) {
      void client.removeChannel(typingChannelRef.current);
      typingChannelRef.current = null;
    }

    const channel = client.channel(`conversation:${selectedConversationId}`);
    typingChannelRef.current = channel;

    channel.on("broadcast", { event: "typing" }, ({ payload }) => {
      const senderId = payload?.senderId;
      if (typeof senderId !== "string" || senderId === userId) return;

      setPeerTyping(Boolean(payload?.isTyping));
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setPeerTyping(false);
      }, 2400);
    });

    channel.on("broadcast", { event: "seen" }, ({ payload }) => {
      const { userId: peerId, seenAt } = payload || {};
      if (!peerId || peerId === userId || !seenAt) return;
      
      setPeerSeenAtByConversation(prev => ({
        ...prev,
        [selectedConversationId]: seenAt
      }));
    });



    channel.on("broadcast", { event: "delete_message" }, ({ payload }) => {
      const { messageId } = payload || {};
      if (!messageId) return;
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      messagesCacheRef.current[selectedConversationId] = (messagesCacheRef.current[selectedConversationId] ?? []).filter(
        (m) => m.id !== messageId
      );
    });

    // 3. Evento Mensaje Nuevo (Entrega 0ms si el chat está abierto)
    channel.on("broadcast", { event: "new_message" }, ({ payload }) => {
      const msg = payload as InboxMessage | null;
      if (!msg || !msg.id || !msg.conversationId) return;
      if (msg.senderId === userId) return;

      // Actualizar el preview del sidebar
      // Si hay multimedia, mostrar "Enviaste una foto" independientemente del texto
      const previewText = msg.mediaUrl ? "Enviaste una foto" : msg.body?.trim();
      moveConversationToTopWithPreview(msg.conversationId, previewText, msg.createdAt);

      // Si la conversación está abierta, agregar el mensaje al hilo
      void markConversationSeen(msg.conversationId);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        const next = [...prev, msg].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        messagesCacheRef.current[msg.conversationId] = next;
        return next;
      });
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void markConversationSeen(selectedConversationId);
      }
    });

    return () => {
      void client.removeChannel(channel);
    };
  }, [markConversationSeen, selectedConversationId, userId]);

  useEffect(() => {
    const onResume = () => {
      void loadConversations({ silent: true });
      if (selectedConversationId) {
        void loadMessages(selectedConversationId, { silent: true });
      }
    };
    const onVisibility = () => {
      if (!document.hidden) onResume();
    };
    window.addEventListener("focus", onResume);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onResume);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadConversations, loadMessages, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    void markConversationSeen(selectedConversationId);
    // Asegurar carga de vistos al cambiar de conversación
    void loadPeerSeenAt(selectedConversationId);
    const currentMessages = messagesCacheRef.current[selectedConversationId] ?? [];
    const latestOwnSentAt = [...currentMessages]
      .reverse()
      .find((m) => m.senderId === userId && m.deliveryState === "sent")?.createdAt ?? null;
    void loadSeenByCount(selectedConversationId, latestOwnSentAt);
  }, [loadPeerSeenAt, loadSeenByCount, markConversationSeen, selectedConversationId, userId]);


  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const notifyTyping = useCallback(
    (isTyping: boolean) => {
      if (!typingChannelRef.current || !userId || typingChannelRef.current.state !== "joined") return;
      const now = Date.now();
      if (isTyping && now - lastTypingSentAtRef.current < 800) return;
      lastTypingSentAtRef.current = now;
      void typingChannelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { senderId: userId, isTyping },
      });
    },
    [userId],
  );

  return {
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
    peerSeenAt: selectedConversationId ? (peerSeenAtByConversation[selectedConversationId] ?? null) : null,
    seenByCount: selectedConversationId ? (seenByCountByConversation[selectedConversationId] ?? 0) : 0,
    otherParticipantCount: selectedConversationId ? (otherParticipantCountByConversation[selectedConversationId] ?? 1) : 1,
    hasMoreMessages,
    loadingOlderMessages,
    loadConversations,
    sendMessage,
    retryFailedMessage,
    notifyTyping,
    loadOlderMessages,
    unsendMessage,
    searchNewMessageCandidates,
    createOrOpenConversation,
  };
};
