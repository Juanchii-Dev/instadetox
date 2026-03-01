import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/AuthContext";
import { useInbox } from "@/lib/MessagesContext";
import {
  HelpCircle
} from "lucide-react";

const MobileBottomNav = () => {
  const { user } = useAuth();
  const [location] = useLocation();
  
  // Sincronización de badge de mensajes (M12)
  const { unreadByConversation } = useInbox();
  const totalUnreadCount = Object.values(unreadByConversation).reduce((acc, count) => acc + count, 0);

  const isActive = (path: string) => {
    if (path === "/inicio" && (location === "/" || location === "/inicio")) return true;
    return location === path;
  };

  const renderInstagramSvg = (iconName: string, label: string, active: boolean) => {
    const fill = active ? "currentColor" : "none";
    const strokeWidth = active ? "0" : "2";

    switch (iconName) {
      case "home":
        return (
          <svg aria-label={label} fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
            {active ? (
              <path d="M22 23h-6.001a1 1 0 0 1-1-1v-5.457a2.997 2.997 0 1 0-5.994 0V22a1 1 0 0 1-1 1H4a3 3 0 0 1-3-3v-8.32a4.022 4.022 0 0 1 1.238-2.894l7.001-6.68a3.993 3.993 0 0 1 5.525 0l7.001 6.681A4.02 4.02 0 0 1 23 11.68V20a3 3 0 0 1-3 3Z" />
            ) : (
              <path d="m21.762 8.786-7-6.68C13.266.68 10.734.68 9.238 2.106l-7 6.681A4.017 4.017 0 0 0 1 11.68V20c0 1.654 1.346 3 3 3h5.005a1 1 0 0 0 1-1L10 15c0-1.103.897-2 2-2 1.09 0 1.98.877 2 1.962L13.999 22a1 1 0 0 0 1 1H20c1.654 0 3-1.346 3-3v-8.32a4.021 4.021 0 0 0-1.238-2.894ZM21 20a1 1 0 0 1-1 1h-4.001L16 15c0-2.206-1.794-4-4-4s-4 1.794-4 4l.005 6H4a1 1 0 0 1-1-1v-8.32c0-.543.226-1.07.62-1.447l7-6.68c.747-.714 2.013-.714 2.76 0l7 6.68c.394.376.62.904.62 1.448V20Z" />
            )}
          </svg>
        );
      case "search":
        return (
          <svg aria-label={label} fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
            <path
              d="M19 10.5A8.5 8.5 0 1 1 10.5 2a8.5 8.5 0 0 1 8.5 8.5Z"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={active ? "3" : "2"}
            />
            <line
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={active ? "3" : "2"}
              x1="16.511"
              x2="22"
              y1="16.511"
              y2="22"
            />
          </svg>
        );
      case "message-circle":
        return (
          <svg aria-label={label} fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
            <path
              d="M13.973 20.046 21.77 6.928C22.8 5.195 21.55 3 19.535 3H4.466C2.138 3 .984 5.825 2.646 7.456l4.842 4.752 1.723 7.121c.548 2.266 3.571 2.721 4.762.717Z"
              fill={active ? "currentColor" : "none"}
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="2"
            />
            <line
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              x1="7.488"
              x2="15.515"
              y1="12.208"
              y2="7.641"
            />
          </svg>
        );
      case "plus-circle":
        return (
          <svg aria-label={label} fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
            <path d="M21 11h-8V3a1 1 0 1 0-2 0v8H3a1 1 0 1 0 0 2h8v8a1 1 0 1 0 2 0v-8h8a1 1 0 1 0 0-2Z" strokeWidth={active ? "1" : "0"} stroke="currentColor" />
          </svg>
        );
      case "stats":
        return (
          <svg aria-label={label} fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
            {/* Teléfono */}
            <rect
              x="6"
              y="3"
              width="10"
              height="18"
              rx="2"
              fill="none"
              stroke="currentColor"
              strokeWidth={active ? "2.5" : "2"}
            />
            {/* Reloj en la parte superior derecha */}
            <circle
              cx="17"
              cy="7"
              r="4"
              fill={active ? "currentColor" : "black"}
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M17 5v2.5l1.5 1"
              fill="none"
              stroke={active ? "black" : "currentColor"}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Flecha/Tendencia a la baja */}
            <path
              d="M19 14l-3 3-3-3"
              fill="none"
              stroke="currentColor"
              strokeWidth={active ? "2.5" : "2"}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line
              x1="16"
              y1="11"
              x2="16"
              y2="17"
              fill="none"
              stroke="currentColor"
              strokeWidth={active ? "2.5" : "2"}
              strokeLinecap="round"
            />
          </svg>
        );
      default:
        return <HelpCircle className="w-6 h-6" />;
    }
  };

  const navItems = [
    { name: "Inicio", icon: "home", path: "/inicio" },
    { name: "Explorar", icon: "search", path: "/busqueda" },
    { name: "Crear", icon: "plus-circle", path: "/crear" },
    { name: "Mensajes", icon: "message-circle", path: "/direct/inbox" },
    { name: "Detox", icon: "stats", path: "/detox" },
    { name: "Perfil", icon: "user", path: `/${user?.username || "perfil"}` },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-dark border-t border-white/5 px-2 pb-safe-area-inset-bottom">
      <nav className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const active = isActive(item.path);
          
          return (
            <Link
              key={item.name}
              href={item.path}
              className={`flex flex-col items-center justify-center w-full h-full transition-all duration-300 relative ${active ? 'text-primary scale-110' : 'text-gray-400 hover:text-white'}`}
            >
              {item.icon === "user" ? (
                <img
                  src={user?.avatar_url || "/avatar_fallback.jpg"}
                  alt={`Avatar de ${user?.username || "usuario"}`}
                  className={`w-7 h-7 rounded-full object-cover border-2 transition-all ${active ? 'border-primary ring-2 ring-primary/20' : 'border-transparent'}`}
                />
              ) : (
                <div className="relative">
                  {renderInstagramSvg(item.icon, item.name, active)}
                  {/* Badge de mensajes no leídos */}
                  {item.icon === "message-circle" && totalUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-background">
                      {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                    </span>
                  )}
                </div>
              )}
              <span className={`text-[10px] mt-1 font-medium transition-opacity ${active ? 'opacity-100' : 'opacity-70'}`}>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default MobileBottomNav;
