import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, User } from './supabase';

interface AuthContextProps {
  user: User | null;
  loading: boolean;
  error: Error | null;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

// Habilitar o deshabilitar el modo de desarrollo (usuario ficticio autenticado)
const DEVELOPMENT_MODE = true;

// Usuario ficticio para desarrollo
const DEV_USER: User = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'usuario@ejemplo.com',
  username: 'usuario_ejemplo',
  avatar_url: 'https://i.pravatar.cc/150?img=1',
  full_name: 'Usuario Ejemplo',
  created_at: new Date().toISOString(),
  last_seen: new Date().toISOString(),
  online: true,
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Cargar el usuario al iniciar
  useEffect(() => {
    async function loadUser() {
      try {
        setLoading(true);
        
        if (DEVELOPMENT_MODE) {
          console.log('Modo desarrollo activado, usando usuario ficticio');
          // En modo desarrollo, simular un pequeño retraso
          setTimeout(() => {
            setUser(DEV_USER);
            setLoading(false);
          }, 500);
          return;
        }
        
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch (err) {
        console.error('Error al cargar el usuario:', err);
        setError(err as Error);
        
        // Si hay error y estamos en modo desarrollo, usar usuario ficticio
        if (DEVELOPMENT_MODE) {
          console.log('Error de autenticación, pero usando usuario ficticio para desarrollo');
          setUser(DEV_USER);
        }
      } finally {
        if (!DEVELOPMENT_MODE) {
          setLoading(false);
        }
      }
    }

    loadUser();
  }, []);

  // Iniciar sesión con correo electrónico
  const signIn = async (email: string) => {
    try {
      setLoading(true);
      setError(null);
      
      if (DEVELOPMENT_MODE) {
        console.log('Modo desarrollo activado, iniciando sesión con usuario ficticio');
        // Simular un pequeño retraso
        setTimeout(() => {
          setUser(DEV_USER);
          setLoading(false);
        }, 500);
        return;
      }
      
      const { user, error } = await authService.signInWithEmail(email);
      
      if (error) {
        setError(error);
        return;
      }
      
      if (user) {
        setUser(user);
      } else {
        // Si no hay error pero tampoco usuario, es porque se envió el email
        // y el usuario debe confirmar en su correo
        console.log('Se envió un enlace mágico a tu correo electrónico');
      }
    } catch (err) {
      console.error('Error al iniciar sesión:', err);
      setError(err as Error);
      
      // Si hay error y estamos en modo desarrollo, usar usuario ficticio
      if (DEVELOPMENT_MODE) {
        console.log('Error de inicio de sesión, pero usando usuario ficticio para desarrollo');
        setUser(DEV_USER);
      }
    } finally {
      if (!DEVELOPMENT_MODE) {
        setLoading(false);
      }
    }
  };

  // Cerrar sesión
  const signOut = async () => {
    try {
      setLoading(true);
      
      if (DEVELOPMENT_MODE) {
        console.log('Modo desarrollo activado, cerrando sesión ficticia');
        // Simular un pequeño retraso
        setTimeout(() => {
          setUser(null);
          setLoading(false);
        }, 500);
        return;
      }
      
      const { error } = await authService.signOut();
      
      if (error) {
        setError(error);
        return;
      }
      
      setUser(null);
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
      setError(err as Error);
    } finally {
      if (!DEVELOPMENT_MODE) {
        setLoading(false);
      }
    }
  };

  const value = {
    user,
    loading,
    error,
    signIn,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}