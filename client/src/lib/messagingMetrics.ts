/**
 * ============================================================================
 * FASE 0 - MESSAGING METRICS BASELINE
 * ============================================================================
 * Sistema de métricas ligero para observabilidad del sistema de mensajería.
 * 
 * Reglas:
 * - Zero overhead cuando está deshabilitado
 * - No dependencias externas pesadas
 * - Structured logs para fácil parseo
 * - Métricas automáticamente agregadas por minuto
 * ============================================================================
 */

import { isMessageMetricsEnabled, isMessagingDebugEnabled } from "./featureFlags";

/**
 * Tipos de métricas soportadas
 */
type MetricType = "counter" | "timer" | "gauge";

/**
 * Categorías de métricas de mensajería
 */
export type MessagingMetricName =
  | "messages_sent_total"           // Contador de mensajes enviados
  | "messages_received_total"       // Contador de mensajes recibidos
  | "messages_deduplicated_total"   // Contador de mensajes duplicados eliminados
  | "message_send_latency_ms"       // Latencia de envío (ms)
  | "realtime_event_delay_ms"       // Delay de eventos realtime (ms)
  | "inbox_load_time_ms"           // Tiempo de carga del inbox (ms)
  | "messaging_errors_total";       // Contador de errores

/**
 * Metadata asociada a cada métrica
 */
interface MetricMetadata {
  type: MetricType;
  description: string;
  unit?: string;
}

/**
 * Registro de todas las métricas disponibles
 */
const METRIC_REGISTRY: Record<MessagingMetricName, MetricMetadata> = {
  messages_sent_total: {
    type: "counter",
    description: "Total de mensajes enviados por el usuario",
    unit: "messages",
  },
  messages_received_total: {
    type: "counter",
    description: "Total de mensajes recibidos en tiempo real",
    unit: "messages",
  },
  messages_deduplicated_total: {
    type: "counter",
    description: "Total de mensajes duplicados eliminados por el sistema de deduplicación",
    unit: "messages",
  },
  message_send_latency_ms: {
    type: "timer",
    description: "Latencia desde que el usuario presiona enviar hasta confirmación",
    unit: "milliseconds",
  },
  realtime_event_delay_ms: {
    type: "timer",
    description: "Delay entre emisión y recepción de eventos realtime",
    unit: "milliseconds",
  },
  inbox_load_time_ms: {
    type: "timer",
    description: "Tiempo de carga inicial del inbox",
    unit: "milliseconds",
  },
  messaging_errors_total: {
    type: "counter",
    description: "Total de errores en operaciones de mensajería",
    unit: "errors",
  },
};

/**
 * Estructura de un valor de métrica individual
 */
interface MetricValue {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

/**
 * Agregador de métricas por minuto
 */
class MetricAggregator {
  private values: MetricValue[] = [];
  private readonly maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  add(value: number, labels?: Record<string, string>): void {
    this.values.push({
      timestamp: Date.now(),
      value,
      labels,
    });

    // Evitar crecimiento ilimitado
    if (this.values.length > this.maxSize) {
      this.values = this.values.slice(-Math.floor(this.maxSize / 2));
    }
  }

  /**
   * Calcula estadísticas del último minuto
   */
  getStats(windowMs: number = 60000): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    p95: number;
  } | null {
    const cutoff = Date.now() - windowMs;
    const recent = this.values.filter(v => v.timestamp >= cutoff);
    
    if (recent.length === 0) return null;

    const values = recent.map(v => v.value).sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const p95Index = Math.floor(values.length * 0.95);

    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      min: values[0],
      max: values[values.length - 1],
      p95: values[p95Index] || values[values.length - 1],
    };
  }

  clear(): void {
    this.values = [];
  }
}

/**
 * Storage de métricas en memoria
 */
const metricsStore = new Map<MessagingMetricName, MetricAggregator>();

/**
 * Obtiene o crea un agregador para una métrica
 */
function getAggregator(name: MessagingMetricName): MetricAggregator {
  if (!metricsStore.has(name)) {
    metricsStore.set(name, new MetricAggregator());
  }
  return metricsStore.get(name)!;
}

/**
 * ============================================================================
 * API PÚBLICA DE MÉTRICAS
 * ============================================================================
 */

/**
 * Registra un contador (incremento de 1)
 */
export function recordCounter(name: MessagingMetricName, labels?: Record<string, string>): void {
  if (!isMessageMetricsEnabled()) return;
  
  getAggregator(name).add(1, labels);
  
  if (isMessagingDebugEnabled()) {
    console.log(`[Metrics] ${name}: +1`, labels);
  }
}

/**
 * Registra un valor de timer (latencia en ms)
 */
export function recordTimer(name: MessagingMetricName, valueMs: number, labels?: Record<string, string>): void {
  if (!isMessageMetricsEnabled()) return;
  
  getAggregator(name).add(valueMs, labels);
  
  if (isMessagingDebugEnabled()) {
    console.log(`[Metrics] ${name}: ${valueMs}ms`, labels);
  }
}

/**
 * Registra un valor gauge (valor puntual)
 */
export function recordGauge(name: MessagingMetricName, value: number, labels?: Record<string, string>): void {
  if (!isMessageMetricsEnabled()) return;
  
  getAggregator(name).add(value, labels);
}

/**
 * Helper para medir tiempo de ejecución de una función
 */
export function measureAsync<T>(
  name: MessagingMetricName,
  fn: () => Promise<T>,
  labels?: Record<string, string>
): Promise<T> {
  if (!isMessageMetricsEnabled()) {
    return fn();
  }

  const start = performance.now();
  
  return fn().finally(() => {
    const duration = performance.now() - start;
    recordTimer(name, duration, labels);
  });
}

/**
 * Helper para medir tiempo de ejecución sincrónica
 */
export function measureSync<T>(
  name: MessagingMetricName,
  fn: () => T,
  labels?: Record<string, string>
): T {
  if (!isMessageMetricsEnabled()) {
    return fn();
  }

  const start = performance.now();
  try {
    return fn();
  } finally {
    const duration = performance.now() - start;
    recordTimer(name, duration, labels);
  }
}

/**
 * ============================================================================
 * REPORTING Y DIAGNÓSTICO
 * ============================================================================
 */

/**
 * Estructura del reporte de métricas
 */
export interface MetricsReport {
  timestamp: string;
  windowMs: number;
  metrics: Record<MessagingMetricName, {
    type: MetricType;
    stats: ReturnType<MetricAggregator["getStats"]>;
  } | null>;
}

/**
 * Genera un reporte de métricas del último período
 */
export function generateMetricsReport(windowMs: number = 60000): MetricsReport {
  const report: MetricsReport = {
    timestamp: new Date().toISOString(),
    windowMs,
    metrics: {} as Record<MessagingMetricName, any>,
  };

  for (const [name, metadata] of Object.entries(METRIC_REGISTRY)) {
    const aggregator = metricsStore.get(name as MessagingMetricName);
    report.metrics[name as MessagingMetricName] = {
      type: metadata.type,
      stats: aggregator?.getStats(windowMs) ?? null,
    };
  }

  return report;
}

/**
 * Loguea el reporte de métricas en formato estructurado
 */
export function logMetricsReport(windowMs: number = 60000): void {
  const report = generateMetricsReport(windowMs);
  
  console.log("[MessagingMetrics] Reporte:", JSON.stringify(report, null, 2));
}

/**
 * ============================================================================
 * INTEGRACIÓN CON SISTEMA EXISTENTE
 * ============================================================================
 */

/**
 * Timer helper para casos de uso específicos de mensajería
 */
export const messagingTimers = {
  /**
   * Inicia un timer para medir latencia de envío de mensaje
   */
  startSend(): () => void {
    if (!isMessageMetricsEnabled()) return () => {};
    
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      recordTimer("message_send_latency_ms", duration);
    };
  },

  /**
   * Inicia un timer para medir delay de eventos realtime
   */
  startRealtimeEvent(sentAt: string): () => void {
    if (!isMessageMetricsEnabled()) return () => {};
    
    const sentTimestamp = new Date(sentAt).getTime();
    return () => {
      const delay = Date.now() - sentTimestamp;
      recordTimer("realtime_event_delay_ms", delay);
    };
  },

  /**
   * Inicia un timer para medir carga de inbox
   */
  startInboxLoad(): () => void {
    if (!isMessageMetricsEnabled()) return () => {};
    
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      recordTimer("inbox_load_time_ms", duration);
    };
  },
};

/**
 * Contadores específicos de mensajería
 */
export const messagingCounters = {
  messageSent(): void {
    recordCounter("messages_sent_total");
  },
  
  messageReceived(labels?: { source: "realtime" | "realtime_filtered" | "broadcast" | "poll" | "cache" }): void {
    recordCounter("messages_received_total", labels);
  },

  messageDeduplicated(): void {
    recordCounter("messages_deduplicated_total");
  },

  errorOccurred(errorType: string): void {
    recordCounter("messaging_errors_total", { type: errorType });
  },
};

/**
 * ============================================================================
 * AUTO-REPORTING (opcional)
 * ============================================================================
 */

let autoReportInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Inicia auto-reporting de métricas cada N minutos
 */
export function startAutoReporting(intervalMinutes: number = 5): void {
  if (!isMessageMetricsEnabled() || autoReportInterval) return;
  
  autoReportInterval = setInterval(() => {
    logMetricsReport();
  }, intervalMinutes * 60 * 1000);
  
  console.log(`[MessagingMetrics] Auto-reporting iniciado (${intervalMinutes}min)`);
}

/**
 * Detiene el auto-reporting
 */
export function stopAutoReporting(): void {
  if (autoReportInterval) {
    clearInterval(autoReportInterval);
    autoReportInterval = null;
  }
}

/**
 * ============================================================================
 * UTILIDADES DE DESARROLLO
 * ============================================================================
 */

/**
 * Expone métricas globalmente para debugging en consola
 */
if (typeof window !== "undefined") {
  (window as any).__MESSAGING_METRICS__ = {
    recordCounter,
    recordTimer,
    generateMetricsReport,
    logMetricsReport,
    startAutoReporting,
    stopAutoReporting,
    registry: METRIC_REGISTRY,
  };
}

/**
 * Log de inicialización
 */
if (typeof window !== "undefined" && isMessageMetricsEnabled()) {
  console.log("[MessagingMetrics] Sistema inicializado. Flags:", {
    metricsEnabled: isMessageMetricsEnabled(),
    debugEnabled: isMessagingDebugEnabled(),
    metrics: Object.keys(METRIC_REGISTRY),
  });
}