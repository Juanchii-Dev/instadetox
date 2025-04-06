import { Switch, Route, Router, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { Background } from "@/components/ui/background";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import Footer from "@/components/Footer";
import Home from "@/pages/Home";
import Search from "@/pages/Search";
import Messages from "@/pages/Messages";
import Notifications from "@/pages/Notifications";
import Create from "@/pages/Create";
import Profile from "@/pages/Profile";
import More from "@/pages/More";
import Aura from "@/pages/Aura";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";

// Componente protegido que verifica autenticación
const ProtectedRoute = ({ component: Component }: { component: React.ComponentType }) => {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    if (!loading && !user) {
      setLocation('/login');
    }
  }, [user, loading, setLocation]);
  
  if (loading) {
    return <div className="flex items-center justify-center h-full">
      <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
    </div>;
  }
  
  return user ? <Component /> : null;
};

function AppRoutes() {
  const { user, loading } = useAuth();
  
  // No renderizamos rutas hasta que sepamos el estado de autenticación
  if (loading) {
    return <div className="flex items-center justify-center h-screen">
      <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
    </div>;
  }
  
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={Home} />
      <Route path="/inicio" component={Home} />
      <Route path="/busqueda" component={Search} />
      <Route path="/mensajes">
        {() => <ProtectedRoute component={Messages} />}
      </Route>
      <Route path="/notificaciones" component={Notifications} />
      <Route path="/crear" component={Create} />
      <Route path="/aura" component={Aura} />
      <Route path="/perfil" component={Profile} />
      <Route path="/mas" component={More} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Componente Layout para páginas con navegación
const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  
  // No mostrar layout en la página de login
  if (location === '/login') {
    return <>{children}</>;
  }
  
  return (
    <>
      <Background />
      <div className="flex flex-col min-h-screen">
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <MobileNav 
            isOpen={mobileMenuOpen} 
            onOpen={() => setMobileMenuOpen(true)} 
            onClose={() => setMobileMenuOpen(false)} 
          />
          
          <main className="flex-1 md:ml-64 pt-16 md:pt-0 px-4 md:px-8 py-6">
            {children}
          </main>
        </div>
        <Footer />
      </div>
    </>
  );
};

function App() {
  return (
    <>
      <MainLayout>
        <AppRoutes />
      </MainLayout>
      <Toaster />
    </>
  );
}

export default App;
