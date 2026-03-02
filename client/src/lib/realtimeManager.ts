/**
 * ============================================================================
 * FASE 4 - REALTIME MANAGER (Optimized Subscriptions)
 * ============================================================================
 *
 * Objetivo: Reducir tráfico innecesario mediante filtros server-side y
 * canales por conversación activa.
 *
 * ARQUITECTURA:
 * - Canal global filtrado por conversaciones del usuario (server-side)
 * - Canal específico por conversación activa
 * - Heartbeat cada 30s
 * - Reconexión exponencial
 * - Single-flight subscription (no duplicadas)
 *
 * FEATURE FLAG:
 * - ff_realtime_filtered: false = sistema actual, true = optimizado
 *
 * SEGURIDAD:
 * - Zero regresión: Sistema actual intacto cuando flag = false
 * - No polling, no delays, latencia 0ms preservada
 * - No duplicación de eventos
 * - No pérdida de mensajes
 * ============================================================================
 */

import { supabase } from "./supabase";
import { isRealtimeFilteredEnabled, isMessagingDebugEnabled } from "./featureFlags";
import { messagingCounters, messagingTimers } from "./messagingMetrics";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { InboxMessage, Conversation, MessageRow } from "@/hooks/useMessagesInbox";

/**
 * ============================================================================
 * TIPOS Y CONFIGURACIÓN
 * ============================================================================
 */

export type RealtimeEventType =
  | "new_message"
  | "delete_message"
  | "typing"
  | "seen"
  | "conversation_updated";

export interface RealtimeEvent {
  type: RealtimeEventType;
  payload: unknown;
  timestamp: string;
  conversationId?: string;
  senderId?: string;
}

export type RealtimeEventHandler = (event: RealtimeEvent) => void;

interface ChannelConfig {
  name: string;
  filter?: string;
  events: RealtimeEventType[];
  handlers: Set<RealtimeEventHandler>;
  channel: RealtimeChannel | null;
  status: "idle" | "connecting" | "connected" | "error" | "closed";
  lastConnectedAt: number | null;
  reconnectAttempt: number;
}

interface RealtimeManagerState {
  // Canales gestionados
  globalChannel: ChannelConfig | null;
  conversationChannels: Map<string, ChannelConfig>;

  // IDs de conversaciones del usuario (para filtro server-side)
  userConversationIds: Set<string>;

  // Heartbeat
  heartbeatInterval: ReturnType<typeof setInterval> | null;
  lastHeartbeatAt: number;

  // Estado de conexión global
  isOnline: boolean;
  connectionState: "connected" | "disconnected" | "reconnecting";
}

const CONFIG = {
  // Heartbeat cada 30s
  HEARTBEAT_INTERVAL_MS: 30000,

  // Reconexión exponencial: base 1s, max 30s
  RECONNECT_BASE_MS: 1000,
  RECONNECT_MAX_MS: 30000,
  RECONNECT_MAX_ATTEMPTS: 10,

  // Timeout para considerar un canal "stale"
  CHANNEL_STALE_MS: 120000,

  // Debounce para actualizaciones de filtro
  FILTER_UPDATE_DEBOUNCE_MS: 500,
} as const;

/**
 * ============================================================================
 * ESTADO GLOBAL (Singleton)
 * ============================================================================
 */
const state: RealtimeManagerState = {
  globalChannel: null,
  conversationChannels: new Map(),
  userConversationIds: new Set(),
  heartbeatInterval: null,
  lastHeartbeatAt: 0,
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  connectionState: "disconnected",
};

// Callbacks globales (para integración con MessageStore)
const globalHandlers: Set<RealtimeEventHandler> = new Set();

// Debounce timer para actualizaciones de filtro
let filterUpdateTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * ============================================================================
 * UTILIDADES INTERNAS
 * ============================================================================
 */

function log(message: string, data?: unknown): void {
  if (isMessagingDebugEnabled()) {
    console.log(`[RealtimeManager] ${message}`, data ?? "");
  }
}

function logError(message: string, error?: unknown): void {
  console.error(`[RealtimeManager] ${message}`, error ?? "");
  messagingCounters.errorOccurred("realtime_manager");
}

/**
 * Calcula delay de reconexión exponencial con jitter
 */
function getReconnectDelay(attempt: number): number {
  const exponential = Math.min(
    CONFIG.RECONNECT_BASE_MS * Math.pow(2, attempt),
    CONFIG.RECONNECT_MAX_MS
  );
  // Jitter: ±20% para evitar thundering herd
  const jitter = exponential * 0.2 * (Math.random() * 2 - 1);
  return Math.max(0, exponential + jitter);
}

/**
 * Verifica si el manager está activo (flag habilitado)
 */
function isActive(): boolean {
  return isRealtimeFilteredEnabled();
}

/**
 * ============================================================================
 * GESTIÓN DE HANDLERS GLOBALES
 * ============================================================================
 */

export function subscribeToRealtimeEvents(handler: RealtimeEventHandler): () => void {
  globalHandlers.add(handler);
  log("Handler global registrado");

  return () => {
    globalHandlers.delete(handler);
    log("Handler global eliminado");
  };
}

function notifyGlobalHandlers(event: RealtimeEvent): void {
  globalHandlers.forEach((handler) => {
    try {
      handler(event);
    } catch (error) {
      logError("Error en handler global:", error);
    }
  });
}

/**
 * ============================================================================
 * CONSTRUCCIÓN DE CANALES
 * ============================================================================
 */

/**
 * Crea el canal global filtrado por conversaciones del usuario
 * Filtro server-side: conversation_id=in.(id1,id2,id3,...)
 */
function createGlobalChannel(): RealtimeChannel | null {
  if (!supabase) return null;

  const conversationIds = Array.from(state.userConversationIds);

  if (conversationIds.length === 0) {
    log("No hay conversaciones para filtrar, canal global omitido");
    return null;
  }

  // Filtro server-side: solo recibir eventos de conversaciones del usuario
  const filter = `conversation_id=in.(${conversationIds.join(",")})`;

  log("Creando canal global con filtro:", filter);

  const channel = supabase
    .channel("realtime_manager:global", {
      config: {
        broadcast: { self: false },
      },
    })
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter,
      },
      handleGlobalMessageInsert
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter,
      },
      handleGlobalMessageUpdate
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "messages",
        filter,
      },
      handleGlobalMessageDelete
    );

  return channel;
}

/**
 * Crea un canal específico para una conversación activa
 */
function createConversationChannel(conversationId: string): RealtimeChannel | null {
  if (!supabase) return null;

  log(`Creando canal para conversación: ${conversationId}`);

  const channel = supabase
    .channel(`realtime_manager:conversation:${conversationId}`, {
      config: {
        broadcast: { self: false },
      },
    })
    .on("broadcast", { event: "typing" }, (payload: { payload?: unknown }) => {
      handleBroadcastEvent("typing", payload, conversationId);
    })
    .on("broadcast", { event: "seen" }, (payload: { payload?: unknown }) => {
      handleBroadcastEvent("seen", payload, conversationId);
    })
    .on("broadcast", { event: "new_message" }, (payload: { payload?: unknown }) => {
      handleBroadcastEvent("new_message", payload, conversationId);
    })
    .on("broadcast", { event: "delete_message" }, (payload: { payload?: unknown }) => {
      handleBroadcastEvent("delete_message", payload, conversationId);
    });

  return channel;
}

/**
 * ============================================================================
 * HANDLERS DE EVENTOS
 * ============================================================================
 */

function handleGlobalMessageInsert(payload: RealtimePostgresChangesPayload<MessageRow>): void {
  const endTimer = messagingTimers.startRealtimeEvent(new Date().toISOString());

  try {
    const row = payload.new as MessageRow;
    if (!row) return;

    const msg: InboxMessage = {
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      body: row.body,
      createdAt: row.created_at,
      deliveryState: "sent",
      mediaUrl: row.payload?.mediaUrl ?? row.media_url ?? null,
      replyTo: row.payload?.replyTo ?? undefined,
    };

    const event: RealtimeEvent = {
      type: "new_message",
      payload: msg,
      timestamp: row.created_at,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
    };

    notifyGlobalHandlers(event);
    messagingCounters.messageReceived({ source: "realtime_filtered" });

    log("Mensaje nuevo recibido (global):", { id: msg.id, conversationId: msg.conversationId });
  } catch (error) {
    logError("Error procesando INSERT:", error);
  } finally {
    endTimer();
  }
}

function handleGlobalMessageUpdate(payload: RealtimePostgresChangesPayload<MessageRow>): void {
  try {
    const row = payload.new as MessageRow;
    if (!row) return;

    const event: RealtimeEvent = {
      type: "conversation_updated",
      payload: {
        conversationId: row.conversation_id,
        messageId: row.id,
        updatedAt: row.created_at,
      },
      timestamp: new Date().toISOString(),
      conversationId: row.conversation_id,
    };

    notifyGlobalHandlers(event);
    log("Mensaje actualizado (global):", { id: row.id });
  } catch (error) {
    logError("Error procesando UPDATE:", error);
  }
}

function handleGlobalMessageDelete(payload: RealtimePostgresChangesPayload<MessageRow>): void {
  try {
    const row = payload.old as MessageRow;
    if (!row) return;

    const event: RealtimeEvent = {
      type: "delete_message",
      payload: {
        messageId: row.id,
        conversationId: row.conversation_id,
      },
      timestamp: new Date().toISOString(),
      conversationId: row.conversation_id,
    };

    notifyGlobalHandlers(event);
    log("Mensaje eliminado (global):", { id: row.id });
  } catch (error) {
    logError("Error procesando DELETE:", error);
  }
}

function handleBroadcastEvent(
  eventType: RealtimeEventType,
  payload: { payload?: unknown },
  conversationId: string
): void {
  const endTimer = messagingTimers.startRealtimeEvent(new Date().toISOString());

  try {
    const event: RealtimeEvent = {
      type: eventType,
      payload: payload?.payload ?? payload,
      timestamp: new Date().toISOString(),
      conversationId,
    };

    // Notificar handlers específicos del canal
    const channelConfig = state.conversationChannels.get(conversationId);
    if (channelConfig) {
      channelConfig.handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          logError(`Error en handler de canal ${conversationId}:`, error);
        }
      });
    }

    // También notificar handlers globales
    notifyGlobalHandlers(event);

    if (eventType === "new_message") {
      messagingCounters.messageReceived({ source: "broadcast" });
    }

    log(`Evento broadcast recibido: ${eventType}`, { conversationId });
  } catch (error) {
    logError(`Error procesando broadcast ${eventType}:`, error);
  } finally {
    endTimer();
  }
}

/**
 * ============================================================================
 * GESTIÓN DE SUSCRIPCIONES
 * ============================================================================
 */

/**
 * Suscribe el canal global (single-flight)
 */
async function subscribeGlobalChannel(): Promise<void> {
  if (!isActive() || !supabase) return;

  // Single-flight: si ya existe y está conectando/conectado, no hacer nada
  if (state.globalChannel) {
    if (state.globalChannel.status === "connected" || state.globalChannel.status === "connecting") {
      log("Canal global ya existe, skip");
      return;
    }
    // Limpiar canal existente en error
    await unsubscribeGlobalChannel();
  }

  const channel = createGlobalChannel();
  if (!channel) return;

  const config: ChannelConfig = {
    name: "global",
    filter: Array.from(state.userConversationIds).join(","),
    events: ["new_message", "delete_message", "conversation_updated"],
    handlers: new Set(),
    channel,
    status: "connecting",
    lastConnectedAt: null,
    reconnectAttempt: 0,
  };

  state.globalChannel = config;

  return new Promise((resolve) => {
    channel.subscribe((status) => {
      log(`Canal global status: ${status}`);

      switch (status) {
        case "SUBSCRIBED":
          config.status = "connected";
          config.lastConnectedAt = Date.now();
          config.reconnectAttempt = 0;
          state.connectionState = "connected";
          log("Canal global conectado");
          resolve();
          break;

        case "CHANNEL_ERROR":
        case "TIMED_OUT":
          config.status = "error";
          state.connectionState = "reconnecting";
          logError(`Canal global error: ${status}`);
          scheduleReconnect("global");
          resolve();
          break;

        case "CLOSED":
          config.status = "closed";
          state.connectionState = "disconnected";
          resolve();
          break;
      }
    });
  });
}

/**
 * Desuscribe el canal global
 */
async function unsubscribeGlobalChannel(): Promise<void> {
  if (!state.globalChannel?.channel || !supabase) return;

  log("Desuscribiendo canal global");

  try {
    await supabase.removeChannel(state.globalChannel.channel);
  } catch (error) {
    logError("Error removiendo canal global:", error);
  }

  state.globalChannel = null;
}

/**
 * Suscribe a un canal de conversación específico
 */
export async function subscribeToConversation(
  conversationId: string,
  handler: RealtimeEventHandler
): Promise<() => void> {
  // Si el flag no está activo, no hacer nada (fallback a legacy)
  if (!isActive()) {
    log("RealtimeManager inactivo (flag deshabilitado), skip subscription");
    return () => {};
  }

  if (!supabase) {
    logError("Supabase no disponible");
    return () => {};
  }

  let config = state.conversationChannels.get(conversationId);

  if (!config) {
    // Crear nuevo canal
    const channel = createConversationChannel(conversationId);
    if (!channel) return () => {};

    config = {
      name: `conversation:${conversationId}`,
      events: ["typing", "seen", "new_message", "delete_message"],
      handlers: new Set(),
      channel,
      status: "connecting",
      lastConnectedAt: null,
      reconnectAttempt: 0,
    };

    state.conversationChannels.set(conversationId, config);

    // Suscribir
    channel.subscribe((status) => {
      log(`Canal ${conversationId} status: ${status}`);

      switch (status) {
        case "SUBSCRIBED":
          config!.status = "connected";
          config!.lastConnectedAt = Date.now();
          config!.reconnectAttempt = 0;
          log(`Canal conversación conectado: ${conversationId}`);
          break;

        case "CHANNEL_ERROR":
        case "TIMED_OUT":
          config!.status = "error";
          logError(`Canal ${conversationId} error: ${status}`);
          scheduleReconnect(conversationId);
          break;

        case "CLOSED":
          config!.status = "closed";
          break;
      }
    });
  }

  // Agregar handler
  config.handlers.add(handler);
  log(`Handler agregado a conversación ${conversationId}, total: ${config.handlers.size}`);

  // Retornar función de cleanup
  return () => {
    unsubscribeFromConversation(conversationId, handler);
  };
}

/**
 * Desuscribe un handler de una conversación
 * Si no quedan handlers, cierra el canal
 */
async function unsubscribeFromConversation(
  conversationId: string,
  handler: RealtimeEventHandler
): Promise<void> {
  const config = state.conversationChannels.get(conversationId);
  if (!config) return;

  config.handlers.delete(handler);
  log(`Handler removido de ${conversationId}, restantes: ${config.handlers.size}`);

  // Si no quedan handlers, cerrar el canal (evitar memory leaks)
  if (config.handlers.size === 0) {
    log(`Cerrando canal huérfano: ${conversationId}`);

    if (config.channel && supabase) {
      try {
        await supabase.removeChannel(config.channel);
      } catch (error) {
        logError(`Error cerrando canal ${conversationId}:`, error);
      }
    }

    state.conversationChannels.delete(conversationId);
  }
}

/**
 * ============================================================================
 * RECONEXIÓN AUTOMÁTICA
 * ============================================================================
 */

function scheduleReconnect(target: "global" | string): void {
  const isGlobal = target === "global";
  const config = isGlobal
    ? state.globalChannel
    : state.conversationChannels.get(target);

  if (!config) return;

  if (config.reconnectAttempt >= CONFIG.RECONNECT_MAX_ATTEMPTS) {
    logError(`Máximo de reconexiones alcanzado para ${target}`);
    config.status = "error";
    return;
  }

  const delay = getReconnectDelay(config.reconnectAttempt);
  config.reconnectAttempt++;

  log(`Reconexión programada para ${target} en ${delay}ms (intento ${config.reconnectAttempt})`);

  setTimeout(() => {
    if (isGlobal) {
      void subscribeGlobalChannel();
    } else {
      // Para conversaciones, verificar si aún tiene handlers
      const currentConfig = state.conversationChannels.get(target);
      if (currentConfig && currentConfig.handlers.size > 0) {
        void resubscribeConversation(target);
      }
    }
  }, delay);
}

async function resubscribeConversation(conversationId: string): Promise<void> {
  const config = state.conversationChannels.get(conversationId);
  if (!config || !supabase) return;

  log(`Resuscribiendo canal: ${conversationId}`);

  // Remover canal viejo
  if (config.channel) {
    try {
      await supabase.removeChannel(config.channel);
    } catch (error) {
      logError("Error removiendo canal viejo:", error);
    }
  }

  // Crear nuevo canal
  const channel = createConversationChannel(conversationId);
  if (!channel) return;

  config.channel = channel;
  config.status = "connecting";

  channel.subscribe((status) => {
    switch (status) {
      case "SUBSCRIBED":
        config.status = "connected";
        config.lastConnectedAt = Date.now();
        config.reconnectAttempt = 0;
        log(`Canal reconectado: ${conversationId}`);
        break;

      case "CHANNEL_ERROR":
      case "TIMED_OUT":
        config.status = "error";
        scheduleReconnect(conversationId);
        break;

      case "CLOSED":
        config.status = "closed";
        break;
    }
  });
}

/**
 * ============================================================================
 * HEARTBEAT
 * ============================================================================
 */

function startHeartbeat(): void {
  if (state.heartbeatInterval) return;

  log("Iniciando heartbeat");

  state.heartbeatInterval = setInterval(() => {
    performHeartbeat();
  }, CONFIG.HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat(): void {
  if (state.heartbeatInterval) {
    clearInterval(state.heartbeatInterval);
    state.heartbeatInterval = null;
    log("Heartbeat detenido");
  }
}

function performHeartbeat(): void {
  state.lastHeartbeatAt = Date.now();

  // Verificar canales stale
  const now = Date.now();

  // Verificar canal global
  if (state.globalChannel) {
    const lastConnected = state.globalChannel.lastConnectedAt;
    if (lastConnected && now - lastConnected > CONFIG.CHANNEL_STALE_MS) {
      log("Canal global stale, reconectando...");
      void subscribeGlobalChannel();
    }
  }

  // Verificar canales de conversación
  state.conversationChannels.forEach((config, conversationId) => {
    const lastConnected = config.lastConnectedAt;
    if (lastConnected && now - lastConnected > CONFIG.CHANNEL_STALE_MS) {
      log(`Canal ${conversationId} stale, reconectando...`);
      void resubscribeConversation(conversationId);
    }
  });

  // Verificar estado de red
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (isOnline !== state.isOnline) {
    state.isOnline = isOnline;
    if (isOnline) {
      log("Conexión restaurada, reconectando canales...");
      void reconnectAll();
    } else {
      log("Conexión perdida");
      state.connectionState = "disconnected";
    }
  }
}

async function reconnectAll(): Promise<void> {
  state.connectionState = "reconnecting";

  // Reconectar canal global
  if (state.globalChannel || state.userConversationIds.size > 0) {
    await subscribeGlobalChannel();
  }

  // Reconectar canales de conversación activos
  const activeConversations = Array.from(state.conversationChannels.entries())
    .filter(([, config]) => config.handlers.size > 0)
    .map(([id]) => id);

  for (const conversationId of activeConversations) {
    await resubscribeConversation(conversationId);
  }

  state.connectionState = "connected";
}

/**
 * ============================================================================
 * GESTIÓN DE CONVERSACIONES DEL USUARIO (Filtros)
 * ============================================================================
 */

/**
 * Actualiza el set de IDs de conversaciones del usuario
 * Triggers recreación del canal global con nuevo filtro
 */
export function updateUserConversations(conversationIds: string[]): void {
  if (!isActive()) return;

  const newSet = new Set(conversationIds);
  const currentSet = state.userConversationIds;

  // Verificar si hay cambios reales
  const hasChanges =
    newSet.size !== currentSet.size ||
    Array.from(newSet).some((id) => !currentSet.has(id));

  if (!hasChanges) {
    log("Conversaciones sin cambios, skip update");
    return;
  }

  log(`Actualizando conversaciones: ${conversationIds.length} ids`);
  state.userConversationIds = newSet;

  // Debounce para evitar recreaciones excesivas
  if (filterUpdateTimer) {
    clearTimeout(filterUpdateTimer);
  }

  filterUpdateTimer = setTimeout(() => {
    log("Recreado canal global con nuevos filtros");
    void subscribeGlobalChannel();
  }, CONFIG.FILTER_UPDATE_DEBOUNCE_MS);
}

/**
 * ============================================================================
 * API PÚBLICA
 * ============================================================================
 */

/**
 * Inicializa el RealtimeManager
 * Llama a esto al iniciar sesión o cuando cambia el feature flag
 */
export function initRealtimeManager(conversationIds?: string[]): void {
  if (!isActive()) {
    log("RealtimeManager: Inactivo (flag deshabilitado)");
    return;
  }

  log("Inicializando RealtimeManager");

  if (conversationIds) {
    state.userConversationIds = new Set(conversationIds);
  }

  // Iniciar suscripciones
  void subscribeGlobalChannel();
  startHeartbeat();

  // Escuchar cambios de conectividad
  if (typeof window !== "undefined") {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  }
}

/**
 * Detiene el RealtimeManager y limpia todos los recursos
 * Llama a esto al cerrar sesión
 */
export async function shutdownRealtimeManager(): Promise<void> {
  log("Shutting down RealtimeManager");

  stopHeartbeat();

  // Cerrar canal global
  await unsubscribeGlobalChannel();

  // Cerrar todos los canales de conversación
  const conversationIds = Array.from(state.conversationChannels.keys());
  for (const id of conversationIds) {
    const config = state.conversationChannels.get(id);
    if (config?.channel && supabase) {
      try {
        await supabase.removeChannel(config.channel);
      } catch (error) {
        logError(`Error cerrando canal ${id}:`, error);
      }
    }
  }
  state.conversationChannels.clear();

  // Limpiar handlers
  globalHandlers.clear();
  state.userConversationIds.clear();

  // Remover listeners
  if (typeof window !== "undefined") {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  }

  state.connectionState = "disconnected";
  log("RealtimeManager detenido");
}

function handleOnline(): void {
  log("Evento: online");
  state.isOnline = true;
  void reconnectAll();
}

function handleOffline(): void {
  log("Evento: offline");
  state.isOnline = false;
  state.connectionState = "disconnected";
}

/**
 * Obtiene el estado actual del manager
 */
export function getRealtimeManagerStatus(): {
  isActive: boolean;
  connectionState: string;
  globalChannelStatus: string;
  activeConversationChannels: number;
  userConversationCount: number;
} {
  return {
    isActive: isActive(),
    connectionState: state.connectionState,
    globalChannelStatus: state.globalChannel?.status ?? "none",
    activeConversationChannels: state.conversationChannels.size,
    userConversationCount: state.userConversationIds.size,
  };
}

/**
 * Fuerza la reconexión de todos los canales
 * Útil para recuperación manual
 */
export function forceReconnect(): void {
  log("Forzando reconexión...");
  void reconnectAll();
}

/**
 * ============================================================================
 * COMPATIBILIDAD CON LEGACY
 * ============================================================================
 *
 * Estas funciones permiten que el código legacy funcione sin cambios
 * cuando el flag está deshabilitado.
 */

/**
 * Verifica si debemos usar el sistema optimizado o el legacy
 * Usar en hooks para decidir qué path tomar
 */
export function shouldUseOptimizedRealtime(): boolean {
  return isActive();
}

/**
 * ============================================================================
 * INICIALIZACIÓN AUTOMÁTICA (opcional)
 * ============================================================================
 */

// Auto-inicialización si el flag está activo y estamos en browser
if (typeof window !== "undefined" && isActive()) {
  log("Auto-inicialización (flag activo)");
  // No iniciar automáticamente, esperar a que se llame initRealtimeManager
  // con los conversationIds del usuario
}
