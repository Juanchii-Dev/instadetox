import { createClient } from '@supabase/supabase-js';

// Credenciales de Supabase hardcodeadas para desarrollo
// En producción, estas deberían venir de variables de entorno
const url = 'https://wlbsbqqryffapoptejpe.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsYnNicXFyeWZmYXBvcHRlanBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5MjUyMTcsImV4cCI6MjA1OTUwMTIxN30.UNa-NiMlCrlnjFJvwSsMELJeFgpHUs7LOk0X9ZW39rA';

// Log para depuración (solo mostramos parte de la key por seguridad)
console.log('Cliente Supabase creado con URL:', url);
console.log('ANON KEY (primeros 10 caracteres):', anonKey.substring(0, 10) + '...');

// Crear un cliente de Supabase
export const supabase = createClient(url, anonKey);

// Tipado para la tabla de mensajes en Supabase
export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

// Tipado para usuarios
export interface User {
  id: string;
  email?: string;
  username?: string;
  avatar_url?: string;
  full_name?: string;
  created_at?: string;
  last_seen?: string;
  online?: boolean;
}

// Tipos para respuestas de autenticación
export interface AuthResponse {
  user: User | null;
  error: Error | null;
}

// Funciones de autenticación
export const authService = {
  // Iniciar sesión con correo electrónico (OTP - One Time Password)
  async signInWithEmail(email: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signInWithOtp({ 
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      });
      
      if (error) throw error;
      
      return { user: data.user, error: null };
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      return { user: null, error: error as Error };
    }
  },
  
  // Obtener el usuario actual
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) throw error;
      
      return user as User;
    } catch (error) {
      console.error('Error al obtener el usuario actual:', error);
      return null;
    }
  },
  
  // Cerrar sesión
  async signOut(): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) throw error;
      
      return { error: null };
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      return { error: error as Error };
    }
  }
};

// Servicio de mensajería
export const messageService = {
  // Enviar un mensaje
  async sendMessage(receiverId: string, content: string): Promise<{ error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('No hay usuario autenticado');
      
      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: receiverId,
        content
      });
      
      if (error) throw error;
      
      return { error: null };
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      return { error: error as Error };
    }
  },
  
  // Obtener mensajes entre dos usuarios
  async getMessagesBetweenUsers(otherUserId: string): Promise<{ messages: Message[], error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('No hay usuario autenticado');
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      return { messages: data as Message[], error: null };
    } catch (error) {
      console.error('Error al obtener mensajes:', error);
      return { messages: [], error: error as Error };
    }
  },
  
  // Suscribirse a nuevos mensajes en tiempo real
  subscribeToMessages(callback: (message: Message) => void): { unsubscribe: () => void } {
    const subscription = supabase
      .channel('messages-channel')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages' 
      }, (payload) => {
        // Llamar al callback con el nuevo mensaje
        callback(payload.new as Message);
      })
      .subscribe();
    
    return {
      unsubscribe: () => {
        subscription.unsubscribe();
      }
    };
  }
};

// Servicio de usuarios
export const userService = {
  // Obtener la lista de usuarios
  async getUsers(): Promise<{ users: User[], error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('username');
      
      if (error) throw error;
      
      return { users: data as User[], error: null };
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      return { users: [], error: error as Error };
    }
  },
  
  // Obtener un usuario por ID
  async getUserById(userId: string): Promise<{ user: User | null, error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      
      return { user: data as User, error: null };
    } catch (error) {
      console.error('Error al obtener usuario:', error);
      return { user: null, error: error as Error };
    }
  },
  
  // Actualizar estado online de un usuario
  async updateUserOnlineStatus(online: boolean): Promise<{ error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('No hay usuario autenticado');
      
      const { error } = await supabase
        .from('profiles')
        .update({ 
          online,
          last_seen: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      return { error: null };
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      return { error: error as Error };
    }
  }
};