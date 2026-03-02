/**
 * ============================================================================
 * FASE 5 - OUTBOX ENGINE HOOK (Reliable Messaging)
 * ============================================================================
 * 
 * ⚠️ REGLA CRÍTICA - ZERO IMPACTO REALTIME:
 * Este hook SOLO actúa cuando hay fallo de red o envío.
 * NUNCA intercepta mensajes que ya funcionan online.
 * 
 * RESPONSABILIDADES:
 * - Procesar mutaciones pendientes con backoff exponencial
 * - Integrar con MessageStore (SSOT) via dispatch de acciones
 * - Detección online/offline sin polling
 * - Cancelar retry si mensaje confirmado por realtime
 * - Garantizar orden FIFO (M12)
 * 
 * POLÍTICA DE RETRY:
 * - Secuencia: 1s → 2s → 4s → 8s → 16s (+ jitter)
 * - Solo errores de red/timeout son reintentables
 * - Máximo 5 intentos antes de DLQ
 * - Cancelación inmediata si confirmado por realtime
 * ============================================================================
 */

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useMessageStore } from '@/lib/messageStore';
import { 
  getPendingMutations, 
  getRetryableMutations,
  updateMutationStatus,
  markMutationSent,
  isMutationProcessed,
  type OutboxMutation,
  isRetryableError,
} from '@/lib/outbox';
import { isOutboxEngineEnabled, isMessagingDebugEnabled } from '@/lib/featureFlags';

interface UseOutboxEngineParams {
  userId: string | undefined;
}

/**
 * Hook principal del Outbox Engine
 * Se conecta al MessageStore y maneja reintentos automáticos
 */
export const useOutboxEngine = ({ userId }: UseOutboxEngineParams) => {
  const isProcessingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Acciones del MessageStore
  const updateMessageStatus = useMessageStore((state) => state.updateMessageStatus);
  const addMessage = useMessageStore((state) => state.addMessage);

  /**
   * Procesa una mutación individual
   * Retorna true si fue exitosa, false si debe reintentar, null si cancelada
   */
  const processMutation = useCallback(async (
    mutation: OutboxMutation
  ): Promise<boolean | null> => {
    if (!supabase || !userId) return null;
    
    // Verificar idempotencia: si ya fue procesada, eliminar del outbox
    const processed = await isMutationProcessed(mutation.clientMutationId);
    if (processed) {
      if (isMessagingDebugEnabled()) {
        console.log(`[OutboxEngine] Mutación ${mutation.id} ya procesada, limpiando`);
      }
      await markMutationSent(mutation.id);
      return true;
    }
    
    // Verificar si fue cancelada
    if (abortControllerRef.current?.signal.aborted) {
      return null;
    }
    
    try {
      // Marcar como retrying en el store
      if (mutation.status !== 'retrying') {
        await updateMutationStatus(mutation.id, { status: 'retrying' });
      }
      
      // Actualizar UI via MessageStore
      if (mutation.conversationId) {
        updateMessageStatus(mutation.id, 'sending');
      }
      
      let success = false;
      
      // Procesar según tipo
      if (mutation.type === 'message') {
        success = await processMessageMutation(mutation);
      } else if (mutation.type === 'post') {
        success = await processPostMutation(mutation);
      } else if (mutation.type === 'upload') {
        success = await processUploadMutation(mutation);
      }
      
      if (success) {
        // Marcar como enviada en outbox
        await markMutationSent(mutation.id);
        
        // Actualizar UI via MessageStore
        if (mutation.conversationId) {
          updateMessageStatus(mutation.id, 'sent');
        }
        
        if (isMessagingDebugEnabled()) {
          console.log(`[OutboxEngine] Mutación ${mutation.id} procesada exitosamente`);
        }
        
        return true;
      }
      
      return false;
      
    } catch (error: any) {
      // Verificar si es error reintentable
      if (!isRetryableError(error)) {
        console.error(`[OutboxEngine] Error no reintentable para ${mutation.id}:`, error);
        // Marcar como failed (moverá a DLQ)
        await updateMutationStatus(mutation.id, { 
          error,
          status: 'failed' 
        });
        
        // Actualizar UI
        if (mutation.conversationId) {
          updateMessageStatus(mutation.id, 'failed');
        }
        
        return false;
      }
      
      // Error reintentable: actualizar estado con backoff
      const updated = await updateMutationStatus(mutation.id, { error });
      
      if (updated) {
        if (isMessagingDebugEnabled()) {
          console.log(`[OutboxEngine] Mutación ${mutation.id} reintentará en ${updated.nextRetryAt}`);
        }
      } else {
        // Se movió a DLQ
        if (mutation.conversationId) {
          updateMessageStatus(mutation.id, 'failed');
        }
      }
      
      return false;
    }
  }, [userId, updateMessageStatus]);

  /**
   * Procesa una mutación de mensaje
   */
  const processMessageMutation = async (mutation: OutboxMutation): Promise<boolean> => {
    const { payload } = mutation;
    
    const { error } = await supabase!.from('messages').insert({
      id: mutation.id,
      conversation_id: payload.conversationId,
      sender_id: mutation.userId,
      body: payload.body,
      created_at: mutation.createdAt,
      payload: payload.dbPayload || {}
    });
    
    // Idempotencia: PK duplicate = éxito
    if (!error || error.code === '23505') {
      return true;
    }
    
    throw error;
  };

  /**
   * Procesa una mutación de post
   */
  const processPostMutation = async (mutation: OutboxMutation): Promise<boolean> => {
    const { payload } = mutation;
    
    const { error } = await supabase!.from('posts').insert({
      id: mutation.id,
      user_id: mutation.userId,
      type: payload.type,
      title: payload.title,
      caption: payload.caption,
      media_url: payload.media_url,
      mentions: payload.mentions,
      video_cover_url: payload.video_cover_url,
      is_published: true,
      created_at: mutation.createdAt
    });
    
    if (!error || error.code === '23505') {
      return true;
    }
    
    throw error;
  };

  /**
   * Procesa una mutación de upload
   */
  const processUploadMutation = async (mutation: OutboxMutation): Promise<boolean> => {
    // Uploads se manejan diferente (ya deberían estar subidos)
    // Aquí solo registramos el resultado
    return true;
  };

  /**
   * Loop principal de procesamiento
   */
  const processOutbox = useCallback(async () => {
    // Protecciones: feature flag, userId, y single execution
    if (!isOutboxEngineEnabled()) {
      if (isMessagingDebugEnabled()) {
        console.log('[OutboxEngine] Engine deshabilitado por feature flag');
      }
      return;
    }
    
    if (!userId || !supabase) return;
    if (isProcessingRef.current) return;
    
    // Cancelar procesamiento anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    isProcessingRef.current = true;
    
    try {
      // 1. Obtener mutaciones pendientes (queued o retrying con nextRetryAt vencido)
      const pending = await getPendingMutations();
      const now = new Date().toISOString();
      
      const readyToProcess = pending.filter(m => 
        m.status === 'queued' || 
        (m.status === 'retrying' && m.nextRetryAt && m.nextRetryAt <= now)
      );
      
      if (readyToProcess.length === 0) {
        isProcessingRef.current = false;
        return;
      }
      
      if (isMessagingDebugEnabled()) {
        console.log(`[OutboxEngine] Procesando ${readyToProcess.length} mutaciones`);
      }
      
      // 2. Procesamiento secuencial FIFO (M12 - mantiene orden)
      for (const mutation of readyToProcess) {
        // Verificar cancelación
        if (abortControllerRef.current.signal.aborted) {
          if (isMessagingDebugEnabled()) {
            console.log('[OutboxEngine] Procesamiento cancelado');
          }
          break;
        }
        
        const result = await processMutation(mutation);
        
        // Si falló un reintento, detener procesamiento secuencial
        // para mantener orden FIFO en siguiente ciclo
        if (result === false) {
          if (isMessagingDebugEnabled()) {
            console.log(`[OutboxEngine] Deteniendo procesamiento secuencial tras fallo de ${mutation.id}`);
          }
          break;
        }
      }
      
    } finally {
      isProcessingRef.current = false;
    }
  }, [userId, processMutation]);

  /**
   * Cancela el procesamiento actual
   */
  const cancelProcessing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isProcessingRef.current = false;
  }, []);

  // Effect: Procesar al montar y configurar listeners
  useEffect(() => {
    let isMounted = true;
    let onlineListener: (() => void) | null = null;
    let visibilityListener: (() => void) | null = null;
    
    if (!userId || !isOutboxEngineEnabled()) return;

    // Procesar al montar (si hay pendientes)
    const init = async () => {
      if (isMounted) {
        await processOutbox();
      }
    };
    
    void init();
    
    // Procesar al volver online
    const handleOnline = () => {
      if (isMessagingDebugEnabled()) {
        console.log('[OutboxEngine] Navegador online - iniciando retry');
      }
      if (isMounted) void processOutbox();
    };
    
    // Procesar al volver a la pestaña visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (isMessagingDebugEnabled()) {
          console.log('[OutboxEngine] Pestaña visible - verificando outbox');
        }
        if (isMounted) void processOutbox();
      }
    };
    
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    onlineListener = () => window.removeEventListener('online', handleOnline);
    visibilityListener = () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      isMounted = false;
      cancelProcessing();
      onlineListener?.();
      visibilityListener?.();
    };
  }, [userId, processOutbox, cancelProcessing]);

  return {
    processOutbox,
    cancelProcessing,
    isProcessing: () => isProcessingRef.current,
  };
};

export default useOutboxEngine;
