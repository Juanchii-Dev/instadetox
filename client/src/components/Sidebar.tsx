import { Link, useLocation } from "wouter";
import { NAVIGATION_ITEMS } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { prefetchProfileRouteSnapshot } from "@/lib/profileRouteCache";
import BrandLogo from "@/components/BrandLogo";
import { HelpCircle } from "lucide-react";
import { useInbox } from "@/lib/MessagesContext";

const SIDEBAR_ICON_COLUMN = "w-[62px]";

const Sidebar = () => {
  const { user } = useAuth();
  const [location] = useLocation();
  const profilePath = `/${user?.username ?? "perfil"}`;
  
  // Sincronización global de mensajes (Empresa - M12)
  const { unreadByConversation } = useInbox();
  const totalUnreadCount = Object.values(unreadByConversation).reduce((acc, count) => acc + count, 0);

  const warmOwnProfileRoute = () => {
    const username = (user?.username ?? "").trim().toLowerCase();
    if (!username) return;
    void prefetchProfileRouteSnapshot(username, user?.id ?? null);
  };
  
  const isActive = (path: string) => {
    // Handle root path
    if (path === "/inicio" && (location === "/" || location === "/inicio")) {
      return true;
    }
    return location === path;
  };

  const renderInstagramSvg = (iconName: string, label: string) => {
    switch (iconName) {
      case "home":
        return (
          <svg aria-label={label} fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
            <title>{label}</title>
            <path d="m21.762 8.786-7-6.68C13.266.68 10.734.68 9.238 2.106l-7 6.681A4.017 4.017 0 0 0 1 11.68V20c0 1.654 1.346 3 3 3h5.005a1 1 0 0 0 1-1L10 15c0-1.103.897-2 2-2 1.09 0 1.98.877 2 1.962L13.999 22a1 1 0 0 0 1 1H20c1.654 0 3-1.346 3-3v-8.32a4.021 4.021 0 0 0-1.238-2.894ZM21 20a1 1 0 0 1-1 1h-4.001L16 15c0-2.206-1.794-4-4-4s-4 1.794-4 4l.005 6H4a1 1 0 0 1-1-1v-8.32c0-.543.226-1.07.62-1.447l7-6.68c.747-.714 2.013-.714 2.76 0l7 6.68c.394.376.62.904.62 1.448V20Z" />
          </svg>
        );
      case "search":
        return (
          <svg aria-label={label} fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
            <title>{label}</title>
            <path
              d="M19 10.5A8.5 8.5 0 1 1 10.5 2a8.5 8.5 0 0 1 8.5 8.5Z"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
            <line
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
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
            <title>{label}</title>
            <path
              d="M13.973 20.046 21.77 6.928C22.8 5.195 21.55 3 19.535 3H4.466C2.138 3 .984 5.825 2.646 7.456l4.842 4.752 1.723 7.121c.548 2.266 3.571 2.721 4.762.717Z"
              fill="none"
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
      case "bell":
        return (
          <svg aria-label={label} fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
            <title>{label}</title>
            <path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.959-5.197 7.222-2.512 2.243-3.865 3.469-4.303 3.752-.477-.309-2.143-1.823-4.303-3.752C5.141 14.072 2.5 12.167 2.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.11-1.766a4.17 4.17 0 0 1 3.679-1.938m0-2a6.04 6.04 0 0 0-4.797 2.127 6.052 6.052 0 0 0-4.787-2.127A6.985 6.985 0 0 0 .5 9.122c0 3.61 2.55 5.827 5.015 7.97.283.246.569.494.853.747l1.027.918a44.998 44.998 0 0 0 3.518 3.018 2 2 0 0 0 2.174 0 45.263 45.263 0 0 0 3.626-3.115l.922-.824c.293-.26.59-.519.885-.774 2.334-2.025 4.98-4.32 4.98-7.94a6.985 6.985 0 0 0-6.708-7.218Z" />
          </svg>
        );
      case "plus-circle":
        return (
          <svg aria-label={label} fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
            <title>{label}</title>
            <path d="M21 11h-8V3a1 1 0 1 0-2 0v8H3a1 1 0 1 0 0 2h8v8a1 1 0 1 0 2 0v-8h8a1 1 0 1 0 0-2Z" />
          </svg>
        );
      case "more-horizontal":
        return (
          <svg aria-label="Configuracion" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24">
            <title>Configuracion</title>
            <line
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              x1="3"
              x2="21"
              y1="4"
              y2="4"
            />
            <line
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              x1="3"
              x2="21"
              y1="12"
              y2="12"
            />
            <line
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              x1="3"
              x2="21"
              y1="20"
              y2="20"
            />
          </svg>
        );
      default:
        return <HelpCircle className="w-6 h-6" aria-label={label} />;
    }
  };

  const labelVisibilityClasses =
    "whitespace-nowrap text-[15px] font-medium opacity-0 -translate-x-2 pointer-events-none transition-all duration-200 motion-reduce:transition-none group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 group-hover/sidebar:pointer-events-auto";
  const primaryNavigationItems = NAVIGATION_ITEMS.filter((item) => item.path !== "/mas");

  const renderNavigationIcon = (iconName: string, itemName: string, itemPath: string) => {
    const isProfileItem = itemPath === profilePath;

    if (isProfileItem) {
      return (
        <img
          src={user?.avatar_url || "/avatar_fallback.jpg"}
          alt={`Avatar de ${user?.username || "usuario"}`}
          className="w-7 h-7 rounded-full object-cover bg-white/10"
        />
      );
    }

    return renderInstagramSvg(iconName, itemName);
  };

  return (
    <aside
      aria-label="Barra lateral principal"
      className="glass-dark hidden md:flex fixed inset-y-0 left-0 z-30 w-[78px] hover:w-[252px] flex-col py-3 border-r border-white/10 transition-[width] duration-300 ease-in-out motion-reduce:transition-none group/sidebar overflow-hidden"
    >
      <div className="px-2 mb-6 min-h-[52px] flex items-center">
        <div className={`${SIDEBAR_ICON_COLUMN} h-[52px] flex items-center justify-center shrink-0`}>
          <BrandLogo variant="icon" className="h-[42px]" alt="InstaDetox" />
        </div>
        <h1 className="whitespace-nowrap transition-all duration-200 opacity-0 -translate-x-2 pointer-events-none group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 group-hover/sidebar:pointer-events-auto">
          <span className="text-2xl font-semibold tracking-tight leading-none">
            <span className="text-white">Insta</span>
            <span className="text-emerald-400">Detox</span>
          </span>
        </h1>
      </div>
      
      <nav className="flex-1" aria-label="Navegación principal">
        <ul className="space-y-1.5 px-2">
          {primaryNavigationItems.map((item) => {
            const itemPath = item.path === "/perfil" ? profilePath : item.path;
            const active = isActive(itemPath);
            
            return (
                  <li key={item.name}>
                <Link
                  href={itemPath}
                  onMouseEnter={item.path === "/perfil" ? warmOwnProfileRoute : undefined}
                  onFocus={item.path === "/perfil" ? warmOwnProfileRoute : undefined}
                  onTouchStart={item.path === "/perfil" ? warmOwnProfileRoute : undefined}
                  aria-label={item.name}
                  aria-current={active ? "page" : undefined}
                  title={item.name}
                  className={`flex items-center h-12 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent transition-colors ${
                    active ? "bg-primary/20 text-white" : "text-gray-200 hover:bg-white/10"
                  }`}
                >
                  <span className={`${SIDEBAR_ICON_COLUMN} h-12 flex items-center justify-center shrink-0 relative`}>
                    {renderNavigationIcon(item.icon, item.name, itemPath)}
                    {item.path === "/direct/inbox" && totalUnreadCount > 0 && (
                      <span className="absolute top-2 right-4 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-[#121212]">
                        {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                      </span>
                    )}
                  </span>
                  <span className={labelVisibilityClasses}>
                    {item.name}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="mt-auto px-2 py-3">
        <Link
          href="/mas"
          aria-label="Mas"
          aria-current={isActive("/mas") ? "page" : undefined}
          title="Mas"
          className={`flex items-center h-12 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent transition-colors ${
            isActive("/mas") ? "bg-primary/20 text-white" : "text-gray-200 hover:bg-white/10"
          }`}
        >
          <span className={`${SIDEBAR_ICON_COLUMN} h-12 flex items-center justify-center shrink-0`}>
            {renderInstagramSvg("more-horizontal", "Mas")}
          </span>
          <span className={labelVisibilityClasses}>Mas</span>
        </Link>

        <Link
          href="/mas"
          aria-label="Ayuda"
          aria-current={undefined}
          title="Ayuda"
          className="flex items-center h-12 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent transition-colors"
        >
          <span className={`${SIDEBAR_ICON_COLUMN} h-12 flex items-center justify-center shrink-0`}>
            <HelpCircle className="w-6 h-6" />
          </span>
          <span className={labelVisibilityClasses}>
            Ayuda
          </span>
        </Link>
      </div>
    </aside>
  );
};

export default Sidebar;
