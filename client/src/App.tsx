import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { Background } from "@/components/ui/background";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import MobileBottomNav from "@/components/MobileBottomNav";
import Home from "@/pages/Home";
import Search from "@/pages/Search";
import Messages from "@/pages/Messages";
import Notifications from "@/pages/Notifications";
import FollowerRequests from "@/pages/FollowerRequests";
import Create from "@/pages/Create";
import Profile from "@/pages/Profile";
import More from "@/pages/More";
import Privacy from "@/pages/Privacy";
import EditProfile from "@/pages/EditProfile";
import Login from "@/pages/Login";
import MobileStatsPage from "@/pages/MobileStatsPage";
import NotFound from "@/pages/not-found";
import { useState } from "react";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { MessagesProvider } from "@/lib/MessagesContext";
import SplashScreen from "@/components/ui/SplashScreen";
import { useOutboxRetry } from "@/hooks/useOutboxRetry";

function AppRoutes() {
  const { user, loading } = useAuth();
  
  // Activar Retry Engine global (Fase 4C)
  useOutboxRetry(user?.id);

  if (loading) {
    return <SplashScreen />;
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route component={Login} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/inicio" component={Home} />
      <Route path="/p/:postId" component={Profile} />
      <Route path="/busqueda" component={Search} />
      <Route path="/direct/inbox" component={Messages} />
      <Route path="/direct/t/:id" component={Messages} />
      <Route path="/notificaciones" component={Notifications} />
      <Route path="/notificaciones/solicitudes" component={FollowerRequests} />
      <Route path="/crear" component={Create} />
      <Route path="/mas" component={More} />
      <Route path="/privacidad" component={Privacy} />
      <Route path="/accounts/edit/" component={EditProfile} />
      <Route path="/accounts/edit" component={EditProfile} />
      <Route path="/login" component={Home} />
      <Route path="/detox" component={MobileStatsPage} />
      <Route path="/:username" component={Profile} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const { user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  const isStandaloneRoute = location === "/privacidad";
  const isMessagesRoute = location.startsWith("/direct/inbox") || location.startsWith("/direct/t/");

  if (loading) {
    return <SplashScreen />;
  }

  if (!user) {
    return <AppRoutes />;
  }

  return (
    <MessagesProvider userId={user.id}>
      <Background />
      <div className="flex flex-col min-h-screen">
        <div className="flex flex-1 overflow-hidden">
          {!isStandaloneRoute ? <Sidebar /> : null}
          {!isStandaloneRoute && !isMessagesRoute ? (
            <MobileNav />
          ) : null}

          <main
            className={`flex-1 h-full ${
              isStandaloneRoute
                ? "px-3 sm:px-4 md:px-5 lg:px-8 py-4 sm:py-6 pt-4 md:ml-0"
                : isMessagesRoute
                  ? "px-0 py-0 md:ml-[78px]"
                  : "px-3 sm:px-4 md:px-5 lg:px-8 py-4 sm:py-6 md:ml-[78px] pt-16 md:pt-0"
            }`}
          >
            <AppRoutes />
          </main>
        </div>
        {!isStandaloneRoute ? <MobileBottomNav /> : null}
      </div>
      <Toaster />
    </MessagesProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
