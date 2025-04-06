import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { LoginForm } from '@/components/LoginForm';
import { useAuth } from '@/lib/AuthContext';

const Login = () => {
  const { user, loading } = useAuth();
  const [_, setLocation] = useLocation();
  
  // Redirigir al usuario si ya está autenticado
  useEffect(() => {
    if (user && !loading) {
      setLocation('/messages');
    }
  }, [user, loading, setLocation]);
  
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md px-4">
        <LoginForm />
      </div>
    </div>
  );
};

export default Login;