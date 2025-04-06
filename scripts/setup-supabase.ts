import { createClient } from '@supabase/supabase-js';

// Obtener credenciales de Supabase del entorno
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Faltan las credenciales de Supabase en las variables de entorno');
  process.exit(1);
}

// Crear cliente de Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

async function setupSupabase() {
  console.log('Configurando tablas en Supabase...');
  
  try {
    // 1. Crear la tabla de perfiles de usuario
    console.log('Creando tabla profiles...');
    const { error: profilesError } = await supabase.rpc('create_table_if_not_exists', {
      table_name: 'profiles',
      column_defs: `
        id UUID PRIMARY KEY REFERENCES auth.users(id),
        username TEXT UNIQUE,
        full_name TEXT,
        avatar_url TEXT,
        online BOOLEAN DEFAULT FALSE,
        last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      `
    });
    
    if (profilesError) {
      throw new Error(`Error al crear tabla profiles: ${profilesError.message}`);
    }
    
    // 2. Crear la tabla de mensajes
    console.log('Creando tabla messages...');
    const { error: messagesError } = await supabase.rpc('create_table_if_not_exists', {
      table_name: 'messages',
      column_defs: `
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        sender_id UUID REFERENCES profiles(id) NOT NULL,
        receiver_id UUID REFERENCES profiles(id) NOT NULL,
        content TEXT NOT NULL,
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      `
    });
    
    if (messagesError) {
      throw new Error(`Error al crear tabla messages: ${messagesError.message}`);
    }
    
    // 3. Configurar políticas de seguridad (RLS)
    console.log('Configurando políticas de seguridad...');
    // Esta parte normalmente se haría desde la interfaz de Supabase directamente
    
    console.log('Configuración completada con éxito.');
  } catch (error) {
    console.error('Error al configurar Supabase:', error);
    process.exit(1);
  }
}

setupSupabase();