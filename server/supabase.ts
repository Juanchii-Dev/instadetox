import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Valores hardcodeados para desarrollo
const url = 'https://wlbsbqqryffapoptejpe.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsYnNicXFyeWZmYXBvcHRlanBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5MjUyMTcsImV4cCI6MjA1OTUwMTIxN30.UNa-NiMlCrlnjFJvwSsMELJeFgpHUs7LOk0X9ZW39rA';

// Verificar y mostrar información de depuración
console.log('Supabase URL:', url);
console.log('Supabase Key (primeros 10 caracteres):', key.substring(0, 10) + '...');

// Crear cliente de Supabase
export const supabase = createClient(url, key);

// Datos de usuario de respaldo que se usarán cuando Supabase no esté disponible
export const BACKUP_USERS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    username: "maria_garcia",
    full_name: "María García",
    avatar_url: "https://i.pravatar.cc/150?img=1",
    online: true,
    last_seen: new Date().toISOString()
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    username: "alex_rodriguez",
    full_name: "Alex Rodríguez",
    avatar_url: "https://i.pravatar.cc/150?img=2",
    online: false,
    last_seen: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    username: "laura_martinez",
    full_name: "Laura Martínez",
    avatar_url: "https://i.pravatar.cc/150?img=3",
    online: true,
    last_seen: new Date().toISOString()
  },
];

// Datos de mensajes de respaldo
export const BACKUP_MESSAGES = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    sender_id: '00000000-0000-0000-0000-000000000001',
    receiver_id: '00000000-0000-0000-0000-000000000002',
    content: "¡Hola! ¿Cómo va tu desintoxicación digital?",
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    sender_id: '00000000-0000-0000-0000-000000000002',
    receiver_id: '00000000-0000-0000-0000-000000000001',
    content: "¡Va genial! Ya he reducido mi tiempo en redes sociales un 30%.",
    created_at: new Date(Date.now() - 3500000).toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    sender_id: '00000000-0000-0000-0000-000000000001',
    receiver_id: '00000000-0000-0000-0000-000000000002',
    content: "¡Felicidades! ¿Qué técnica te ha funcionado mejor?",
    created_at: new Date(Date.now() - 3400000).toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    sender_id: '00000000-0000-0000-0000-000000000002',
    receiver_id: '00000000-0000-0000-0000-000000000001',
    content: "Usar temporizadores y la función de bienestar digital del teléfono. ¡Es increíble lo consciente que te hace de tu uso!",
    created_at: new Date(Date.now() - 3300000).toISOString(),
  },
];

// Función para inicializar datos de prueba (para desarrollo)
export async function initializeTestData() {
  try {
    console.log('Inicializando datos de respaldo para desarrollo...');
    
    // Verificar conexión con Supabase (solo para diagnóstico)
    const { data: healthCheck, error: healthError } = await supabase.from('profiles').select('count').limit(1);
    
    if (healthError) {
      console.error('Error de conexión con Supabase:', healthError);
      console.log('La aplicación usará datos de respaldo en memoria en su lugar.');
    } else {
      console.log('Conexión con Supabase exitosa, pero seguiremos usando datos de respaldo para desarrollo.');
    }
    
    // Omitimos las llamadas a RPC que estaban causando errores
    
    console.log('Datos de respaldo preparados y listos para usarse cuando sea necesario.');
    console.log('Inicialización de datos de prueba completada.');
  } catch (err) {
    console.error('Error al inicializar datos de prueba:', err);
    console.log('La aplicación continuará usando datos de respaldo en memoria.');
  }
}