/**
 * ============================================================================
 * MESSAGING INFRASTRUCTURE - FASE 0
 * ============================================================================
 * Exportaciones centralizadas del sistema de infraestructura de mensajería.
 * 
 * Este archivo es el punto de entrada único para:
 * - Feature Flags
 * - Métricas
 * - Gateways
 * 
 * Importar desde aquí en lugar de archivos individuales.
 * ============================================================================
 */

// Feature Flags
export {
  isNewMessagingEnabled,
  isMessageMetricsEnabled,
  isMessagingDebugEnabled,
  getAllFeatureFlags,
  setLocalFlagOverride,
  clearLocalFlagOverrides,
} from "./featureFlags";

// Métricas
export {
  recordCounter,
  recordTimer,
  recordGauge,
  measureAsync,
  measureSync,
  generateMetricsReport,
  logMetricsReport,
  startAutoReporting,
  stopAutoReporting,
  messagingTimers,
  messagingCounters,
  type MetricsReport,
} from "./messagingMetrics";

// Gateways
export {
  gatewaySendMessage,
  gatewayHandleRealtimeEvent,
  gatewayLoadInbox,
  gatewayCacheOperation,
  gatewayUploadMedia,
  gatewayBroadcast,
  getGatewayStatus,
  logGatewayStatus,
  type SendMessagePayload,
  type SendMessageResult,
  type RealtimeEvent,
  type RealtimeEventType,
  type InboxLoadOptions,
  type InboxLoadResult,
  type MediaUploadPayload,
  type MediaUploadResult,
  type BroadcastPayload,
} from "./messagingGateways";

// Deduplication Service
export {
  deduplicationService,
  resolveDedupId,
  processIncomingMessage,
  type DeduplicatableMessage,
} from "./deduplicationService";