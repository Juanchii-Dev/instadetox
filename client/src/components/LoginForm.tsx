import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Glass } from '@/components/ui/glass';
import { Spinner } from '@/components/ui/spinner';

export const LoginForm = () => {
  const [email, setEmail] = useState('');
  const { signIn, loading } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Error",
        description: "Por favor ingresa tu correo electrónico",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await signIn(email);
      toast({
        title: "Enlace enviado",
        description: "Te hemos enviado un enlace mágico a tu correo electrónico para iniciar sesión",
      });
    } catch (error) {
      toast({
        title: "Error al iniciar sesión",
        description: (error as Error).message || "Ha ocurrido un error inesperado",
        variant: "destructive",
      });
    }
  };

  return (
    <Glass className="p-8 max-w-md w-full mx-auto">
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Iniciar sesión</h1>
          <p className="text-muted-foreground">
            Ingresa tu correo electrónico para recibir un enlace mágico
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Spinner size="small" className="mr-2" /> 
                Enviando enlace...
              </>
            ) : (
              'Enviar enlace de acceso'
            )}
          </Button>
        </form>
        
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Al iniciar sesión, aceptas nuestros{' '}
            <a href="#" className="underline">
              Términos de servicio
            </a>{' '}
            y{' '}
            <a href="#" className="underline">
              Política de privacidad
            </a>
          </p>
        </div>
      </div>
    </Glass>
  );
};