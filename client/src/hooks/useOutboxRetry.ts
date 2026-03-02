import { useEffect, useRef } from 'react';
import { getPendingMutations, updateMutationStatus, dequeueMutation, type OutboxMutation } from '@/lib/outbox';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export const useOutboxRetry = (userId: string | undefined) => {
  const { toast } = useToast();
  const isProcessingRef = useRef(false);

  const processOutbox = async () => {
    if (isProcessingRef.current || !userId || !supabase) return;
    
    const isMounted = { current: true };
    const pending = await getPendingMutations();
    if (pending.length === 0) return () => { isMounted.current = false; };

    isProcessingRef.current = true;
    
    // Procesamiento Secuencial FIFO (M12)
    for (const mutation of pending) {
      if (mutation.status === 'failed' || mutation.retryCount >= 5) continue;

      try {
        await updateMutationStatus(mutation.id, { status: 'retrying' });
        
        let success = false;
        
        if (mutation.type === 'message') {
          const { payload } = mutation;
          // Idempotencia: el ID ya es el UUID del mensaje de cliente
          const { error } = await supabase.from('messages').insert({
            id: mutation.id,
            conversation_id: payload.conversationId,
            sender_id: mutation.userId,
            body: payload.body,
            created_at: mutation.createdAt,
            payload: payload.dbPayload || {}
          });
          
          // Si el error es un duplicado de PK, lo consideramos éxito (Idempotencia)
          if (!error || error.code === '23505') {
            success = true;
          } else {
            throw error;
          }
        } else if (mutation.type === 'post') {
            const { payload } = mutation;
            const { error } = await supabase.from('posts').insert({
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
              success = true;
            } else {
              throw error;
            }
        }

        if (success) {
          await dequeueMutation(mutation.id);
          console.info(`[Outbox] Mutacion ${mutation.id} procesada con exito.`);
        }
      } catch (err: any) {
        console.error(`[Outbox] Error reintentando mutacion ${mutation.id}:`, err);
        const newRetryCount = mutation.retryCount + 1;
        await updateMutationStatus(mutation.id, {
          status: newRetryCount >= 5 ? 'failed' : 'queued',
          retryCount: newRetryCount,
          lastError: err.message
        });
        
        // Si falla una mutación, detenemos el procesamiento secuencial 
        // para mantener el orden FIFO en el siguiente ciclo.
        break; 
      }
    }

    isProcessingRef.current = false;
  };

  useEffect(() => {
    let isMounted = true;
    if (!userId) return;

    // Procesar al montar y al volver online
    const runProcess = async () => {
      if (isMounted) await processOutbox();
    };
    
    void runProcess();

    const handleOnline = () => {
      console.info("[Outbox] Navegador Online. Iniciando retry engine...");
      if (isMounted) void processOutbox();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
    };
  }, [userId]);

  return { processOutbox };
};
