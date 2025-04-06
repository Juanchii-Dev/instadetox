import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from 'ws';
import { storage } from "./storage";
import { handleChatRequest } from "./aura"; 
import { supabase, initializeTestData, BACKUP_USERS, BACKUP_MESSAGES } from "./supabase";

export async function registerRoutes(app: Express): Promise<Server> {
  // Crear servidor HTTP
  const httpServer = createServer(app);
  
  // Crear servidor WebSocket (definido al principio para poder usarlo en las rutas)
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Inicializar datos de prueba para desarrollo
  await initializeTestData();
  
  // Ruta para el chat con AURA (asistente IA)
  app.post("/api/chat", handleChatRequest);

  // API para autenticación y perfiles de usuario
  app.get("/api/users/me", async (req: Request, res: Response) => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.warn('Error de autenticación:', error);
        // Devolver un usuario de respaldo para desarrollo
        return res.json(BACKUP_USERS[0]);
      }
      
      if (!user) {
        console.warn('No hay usuario autenticado');
        // Devolver un usuario de respaldo para desarrollo
        return res.json(BACKUP_USERS[0]);
      }
      
      // Obtener perfil completo desde la tabla profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profileError) {
        console.warn('Error al obtener perfil:', profileError);
        // Devolver un perfil de respaldo basado en el usuario actual
        return res.json({
          id: user.id,
          username: user.email?.split('@')[0] || 'usuario',
          full_name: 'Usuario',
          avatar_url: 'https://i.pravatar.cc/150?img=1',
          online: true,
          last_seen: new Date().toISOString()
        });
      }
      
      res.json(profile);
    } catch (err) {
      console.error('Error inesperado en /api/users/me:', err);
      // En caso de cualquier error, usar datos de respaldo
      return res.json(BACKUP_USERS[0]);
    }
  });
  
  // Obtener todos los usuarios
  app.get("/api/users", async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('username');
      
      if (error) {
        console.warn('Error al obtener usuarios de Supabase:', error);
        // Si falla Supabase, usar datos de respaldo
        return res.json(BACKUP_USERS);
      }
      
      // Si no hay datos pero no hay error, también usar datos de respaldo
      if (!data || data.length === 0) {
        console.warn('No se encontraron usuarios en Supabase, usando datos de respaldo');
        return res.json(BACKUP_USERS);
      }
      
      res.json(data);
    } catch (err) {
      console.error('Error inesperado al obtener usuarios:', err);
      // En caso de cualquier error, usar datos de respaldo
      return res.json(BACKUP_USERS);
    }
  });
  
  // Obtener mensajes entre dos usuarios
  app.get("/api/messages/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      // Si no hay usuario autenticado, usar un ID de usuario de respaldo
      const currentUserId = user?.id || BACKUP_USERS[0].id;
      
      if (authError) {
        console.warn('Error de autenticación:', authError);
      }
      
      // Buscar mensajes en ambas direcciones
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUserId})`)
        .order('created_at');
      
      if (error || !data || data.length === 0) {
        console.warn('Error o sin datos al obtener mensajes:', error);
        
        // Si falla Supabase o no hay mensajes, filtrar mensajes de respaldo para esta conversación
        const filteredMessages = BACKUP_MESSAGES.filter(msg => 
          (msg.sender_id === currentUserId && msg.receiver_id === userId) || 
          (msg.sender_id === userId && msg.receiver_id === currentUserId)
        );
        
        return res.json(filteredMessages.length > 0 ? filteredMessages : BACKUP_MESSAGES);
      }
      
      res.json(data);
    } catch (err) {
      console.error('Error inesperado al obtener mensajes:', err);
      // En caso de cualquier error, usar datos de respaldo
      return res.json(BACKUP_MESSAGES);
    }
  });
  
  // Enviar un mensaje
  app.post("/api/messages", async (req: Request, res: Response) => {
    try {
      const { receiverId, content } = req.body;
      
      if (!receiverId || !content) {
        return res.status(400).json({ error: "Se requiere receiverId y content" });
      }
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      // Si no hay usuario autenticado, usar el ID del primer usuario de respaldo
      const senderId = user?.id || BACKUP_USERS[0].id;
      
      if (authError) {
        console.warn('Error de autenticación al enviar mensaje:', authError);
      }
      
      // Intentar insertar el mensaje en Supabase
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: senderId,
          receiver_id: receiverId,
          content,
          created_at: new Date().toISOString()
        })
        .select();
      
      // Si hay error o no hay datos, crear una respuesta simulada
      if (error || !data || data.length === 0) {
        console.warn('Error al insertar mensaje en Supabase:', error);
        
        // Crear un mensaje simulado (ID único para simular nuevo mensaje)
        const mockMessage = {
          id: crypto.randomUUID(),
          sender_id: senderId,
          receiver_id: receiverId,
          content,
          created_at: new Date().toISOString()
        };
        
        // Enviar el mensaje por WebSocket para mantener la funcionalidad en tiempo real
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'new_message',
              message: mockMessage
            }));
          }
        });
        
        return res.status(201).json(mockMessage);
      }
      
      // Si todo va bien, enviar el mensaje por WebSocket también
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'new_message',
            message: data[0]
          }));
        }
      });
      
      res.status(201).json(data[0]);
    } catch (err) {
      console.error('Error inesperado al enviar mensaje:', err);
      // En caso de error, devolver un mensaje con ID generado
      const mockMessage = {
        id: crypto.randomUUID(),
        sender_id: BACKUP_USERS[0].id,
        receiver_id: req.body.receiverId,
        content: req.body.content,
        created_at: new Date().toISOString()
      };
      return res.status(201).json(mockMessage);
    }
  });

  // Manejar conexiones WebSocket
  wss.on('connection', (ws) => {
    console.log('Nueva conexión WebSocket establecida');
    
    // Mensaje de bienvenida para confirmar conexión
    ws.send(JSON.stringify({ 
      type: 'welcome', 
      message: 'Conexión WebSocket establecida correctamente'
    }));
    
    // Escuchar eventos desde el cliente
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Mensaje WebSocket recibido:', data);
        
        // Enviar confirmación
        ws.send(JSON.stringify({ 
          type: 'ack', 
          messageId: data.id || 'unknown',
          timestamp: new Date().toISOString()
        }));
      } catch (err) {
        console.error('Error al procesar mensaje WebSocket:', err);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Error al procesar mensaje'
        }));
      }
    });
    
    // Manejar errores
    ws.on('error', (error) => {
      console.error('Error en conexión WebSocket:', error);
    });
    
    // Manejar desconexiones
    ws.on('close', () => {
      console.log('Conexión WebSocket cerrada');
    });
  });

  return httpServer;
}
