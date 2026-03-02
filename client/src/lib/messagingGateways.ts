/**
 * ============================================================================
 * FASE 0 - MESSAGING GATEWAYS (Toggle-Ready Architecture)
 * ============================================================================
 * Sistema de gateways condicionales para migración segura del sistema
 * de mensajería. 
 * 
 * ⚠️ REGLA CRÍTICA:
 * - Cuando isNewMessagingEnabled() === false: EJECUTAR CÓDIGO ACTUAL (legacy)
 * - Cuando isNewMessagingEnabled() === true: EJECUTAR NUEVO SISTEMA (v2)
 * - HOY ambos caminos ejecutan EXACTAMENTE el mismo código legacy
 * 
 * Este archivo es solo "toggle-ready infrastructure" - NO modifica
 * comportamiento actual cuando el flag está en false.
 * ============================================================================
 */

import { isNewMessagingEnabled, isMessagingDebugEnabled } from "./featureFlags";
import {
  messagingCounters,
  messagingTimers,
  measureAsync
} from "./messagingMetrics";
import {
  processIncomingMessage,
  type DeduplicatableMessage,
} from "./deduplicationService";
import type { InboxMessage, ReplyToPayload, Conversation } from "@/hooks/useMessagesInbox";

/**
 * ============================================================================
 * GATEWAY 1: ENVÍO DE MENSAJES (Message Send Pipeline)
 * ============================================================================
 * 
 * Puntos de inyección:
 * - sendMessage() en useMessagesInbox.ts
 * - Subida de multimedia
 * - Broadcast a peers
 */

export interface SendMessagePayload {
  conversationId: string;
  body: string;
  replyTo?: ReplyToPayload;
  pendingFiles?: Array<{ file: File; previewUrl: string }>;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Gateway de envío de mensajes.
 * FASE 1: Registra mensajes enviados en deduplicación cuando flag=true
 * LEGACY: Sin cambios cuando flag está en false
 */
export async function gatewaySendMessage(
  payload: SendMessagePayload,
  legacySendMessage: (payload: SendMessagePayload) => Promise<SendMessageResult>
): Promise<SendMessageResult> {
  const isNewSystem = isNewMessagingEnabled();

  if (isMessagingDebugEnabled()) {
    console.log(`[MessagingGateway] sendMessage | newSystem=${isNewSystem}`, {
      conversationId: payload.conversationId,
      hasFiles: !!payload.pendingFiles?.length,
    });
  }

  // Iniciar timer de latencia
  const endTimer = messagingTimers.startSend();

  try {
    let result: SendMessageResult;

    if (isNewSystem) {
      // FASE 1: Delegar a legacy pero registrar en dedup tras éxito
      result = await legacySendMessage(payload);

      // Registrar mensaje en sistema de deduplicación para evitar duplicados
      // por reintentos de red o race conditions
      if (result.success && result.messageId) {
        const now = new Date().toISOString();
        void processIncomingMessage({
          id: result.messageId,
          conversationId: payload.conversationId,
          senderId: "self", // Placeholder, se actualizará con datos reales
          createdAt: now,
          body: payload.body,
        });
      }
    } else {
      // LEGACY: Código actual sin cambios (FASE 0)
      result = await legacySendMessage(payload);
    }

    // Registrar métricas solo si éxito
    if (result.success) {
      messagingCounters.messageSent();
    } else {
      messagingCounters.errorOccurred("send_failed");
    }

    return result;
  } catch (error) {
    messagingCounters.errorOccurred("send_exception");
    throw error;
  } finally {
    endTimer();
  }
}

/**
 * ============================================================================
 * GATEWAY 2: HANDLER REALTIME (Realtime Event Dispatcher)
 * ============================================================================
 * 
 * Puntos de inyección:
 * - Recepción de mensajes nuevos
 * - Eventos de typing
 * - Eventos de seen/read
 * - Eventos de delete
 */

export type RealtimeEventType = 
  | "new_message" 
  | "typing" 
  | "seen" 
  | "delete_message";

export interface RealtimeEvent {
  type: RealtimeEventType;
  payload: unknown;
  timestamp: string;
  senderId?: string;
}

/**
 * Gateway de procesamiento de eventos realtime.
 * FASE 1: Agrega deduplicación cuando isNewMessagingEnabled() === true
 * LEGACY: Sin cambios cuando flag está en false
 */
export function gatewayHandleRealtimeEvent(
  event: RealtimeEvent,
  legacyHandler: (event: RealtimeEvent) => void
): void {
  const isNewSystem = isNewMessagingEnabled();

  if (isMessagingDebugEnabled()) {
    console.log(`[MessagingGateway] realtimeEvent | type=${event.type} | newSystem=${isNewSystem}`);
  }

  // Medir delay del evento (desde emisión hasta recepción)
  const endTimer = messagingTimers.startRealtimeEvent(event.timestamp);

  try {
    if (isNewSystem) {
      // FASE 1: Deduplicación para eventos de nuevo mensaje
      if (event.type === "new_message" && event.payload) {
        const payload = event.payload as DeduplicatableMessage;

        // Validar payload mínimo requerido
        if (!payload.conversationId || !payload.senderId || !payload.createdAt) {
          if (isMessagingDebugEnabled()) {
            console.warn("[MessagingGateway] Payload inválido, ignorando deduplicación");
          }
          legacyHandler(event);
          messagingCounters.messageReceived({ source: "realtime" });
          return;
        }

        // Procesar con deduplicación (async pero no bloquea)
        void processIncomingMessage(payload).then((shouldProcess) => {
          if (shouldProcess) {
            // Mensaje nuevo - procesar normalmente
            legacyHandler(event);
            messagingCounters.messageReceived({ source: "realtime" });
          } else {
            // Mensaje duplicado - ya fue registrado por dedup service
            if (isMessagingDebugEnabled()) {
              console.log("[MessagingGateway] Mensaje duplicado ignorado:", payload.id);
            }
          }
        });

        return; // Early return para evitar el flujo legacy directo
      }

      // Otros eventos: procesar normalmente
      legacyHandler(event);
    } else {
      // LEGACY: Handler actual sin cambios (FASE 0)
      legacyHandler(event);
    }

    // Registrar recepción exitosa (solo para legacy path)
    if (!isNewSystem || event.type !== "new_message") {
      messagingCounters.messageReceived({ source: "realtime" });
    }
  } catch (error) {
    messagingCounters.errorOccurred("realtime_handler");
    throw error;
  } finally {
    endTimer();
  }
}

/**
 * ============================================================================
 * GATEWAY 3: CARGA DE INBOX (Inbox Loader)
 * ============================================================================
 * 
 * Puntos de inyección:
 * - Carga inicial de conversaciones
 * - Carga de mensajes de una conversación
 * - Carga de mensajes antiguos (pagination)
 */

export interface InboxLoadOptions {
  silent?: boolean;
  abortSignal?: AbortSignal;
  conversationId?: string;
}

export interface InboxLoadResult {
  conversations?: Conversation[];
  messages?: InboxMessage[];
  hasMore?: boolean;
}

/**
 * Gateway de carga de inbox.
 * HOY: Siempre delega a legacyLoader
 * FUTURO: Permite bifurcación a nuevo sistema
 */
export async function gatewayLoadInbox(
  options: InboxLoadOptions,
  legacyLoader: (options: InboxLoadOptions) => Promise<InboxLoadResult>
): Promise<InboxLoadResult> {
  const isNewSystem = isNewMessagingEnabled();
  
  if (isMessagingDebugEnabled()) {
    console.log(`[MessagingGateway] loadInbox | newSystem=${isNewSystem}`, options);
  }

  const endTimer = messagingTimers.startInboxLoad();

  try {
    let result: InboxLoadResult;

    if (isNewSystem) {
      // FUTURO: Implementar nuevo loader aquí
      result = await legacyLoader(options);
    } else {
      // LEGACY: Loader actual sin cambios
      result = await legacyLoader(options);
    }

    return result;
  } catch (error) {
    messagingCounters.errorOccurred("inbox_load");
    throw error;
  } finally {
    endTimer();
  }
}

/**
 * ============================================================================
 * GATEWAY 4: CACHE Y PERSISTENCIA LOCAL
 * ============================================================================
 * 
 * Puntos de inyección:
 * - Guardado en localStorage
 * - Hidratación de caché
 * - Limpieza de caché
 */

export interface CacheOperation {
  type: "save" | "load" | "clear";
  key: string;
  data?: unknown;
}

/**
 * Gateway de operaciones de caché.
 * Permite migrar estrategia de persistencia en el futuro.
 */
export function gatewayCacheOperation<T>(
  operation: CacheOperation,
  legacyOperation: (op: CacheOperation) => T
): T {
  const isNewSystem = isNewMessagingEnabled();

  // Por ahora, siempre usa legacy
  if (isNewSystem) {
    // FUTURO: IndexedDB, OPFS, u otra estrategia
    return legacyOperation(operation);
  }

  return legacyOperation(operation);
}

/**
 * ============================================================================
 * GATEWAY 5: SUBIDA DE MULTIMEDIA
 * ============================================================================
 * 
 * Puntos de inyección:
 * - Subida a Supabase Storage
 * - Generación de thumbnails
 * - Compresión
 */

export interface MediaUploadPayload {
  file: File;
  conversationId: string;
  userId: string;
}

export interface MediaUploadResult {
  url: string | null;
  error?: string;
}

/**
 * Gateway de subida de multimedia.
 * HOY: Delega a legacy (Supabase Storage)
 * FUTURO: Permite CDN, compresión, etc.
 */
export async function gatewayUploadMedia(
  payload: MediaUploadPayload,
  legacyUploader: (payload: MediaUploadPayload) => Promise<MediaUploadResult>
): Promise<MediaUploadResult> {
  const isNewSystem = isNewMessagingEnabled();

  if (isNewSystem) {
    // FUTURO: Implementar nuevo uploader
    return legacyUploader(payload);
  }

  return legacyUploader(payload);
}

/**
 * ============================================================================
 * GATEWAY 6: BROADCAST Y SINCRONIZACIÓN
 * ============================================================================
 * 
 * Puntos de inyección:
 * - Broadcast a canal de conversación
 * - Broadcast a inbox de peers
 * - Confirmaciones de recepción
 */

export interface BroadcastPayload {
  event: string;
  payload: unknown;
  targets: string[]; // peer IDs
}

/**
 * Gateway de broadcast.
 * HOY: Usa Supabase Realtime
 * FUTURO: WebSocket dedicado, SSE, etc.
 */
export async function gatewayBroadcast(
  broadcast: BroadcastPayload,
  legacyBroadcast: (b: BroadcastPayload) => Promise<void>
): Promise<void> {
  const isNewSystem = isNewMessagingEnabled();

  if (isNewSystem) {
    // FUTURO: Implementar nuevo transporte
    return legacyBroadcast(broadcast);
  }

  return legacyBroadcast(broadcast);
}

/**
 * ============================================================================
 * UTILIDADES DE DEBUG Y DIAGNÓSTICO
 * ============================================================================
 */

/**
 * Estado actual del gateway para debugging
 */
export function getGatewayStatus(): {
  newSystemEnabled: boolean;
  debugEnabled: boolean;
  activeGateways: string[];
} {
  return {
    newSystemEnabled: isNewMessagingEnabled(),
    debugEnabled: isMessagingDebugEnabled(),
    activeGateways: [
      "send",
      "realtime",
      "inbox_load",
      "cache",
      "media_upload",
      "broadcast",
    ],
  };
}

/**
 * Log de estado del gateway
 */
export function logGatewayStatus(): void {
  console.log("[MessagingGateway] Estado:", getGatewayStatus());
}

/**
 * ============================================================================
 * EXPOSICIÓN GLOBAL PARA DEBUG
 * ============================================================================
 */

if (typeof window !== "undefined") {
  (window as any).__MESSAGING_GATEWAY__ = {
    getStatus: getGatewayStatus,
    logStatus: logGatewayStatus,
    // Funciones de gateway (para testing)
    gatewaySendMessage,
    gatewayHandleRealtimeEvent,
    gatewayLoadInbox,
  };
}

/**
 * Log de inicialización
 */
if (typeof window !== "undefined") {
  console.log("[MessagingGateway] Inicializado. Modo:", 
    isNewMessagingEnabled() ? "NEW (preparado)" : "LEGACY (estable)"
  );
}