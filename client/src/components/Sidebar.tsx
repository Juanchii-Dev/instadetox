import { Link, useLocation } from "wouter";
import { NAVIGATION_ITEMS } from "@/lib/utils";
import { 
  Home, 
  Search, 
  MessageCircle, 
  Bell, 
  PlusCircle, 
  User, 
  MoreHorizontal,
  HelpCircle,
  Bot
} from "lucide-react";

const Sidebar = () => {
  const [location] = useLocation();
  
  const isActive = (path: string) => {
    // Handle root path
    if (path === "/inicio" && (location === "/" || location === "/inicio")) {
      return true;
    }
    return location === path;
  };

  // Function to get icon component based on icon name
  const getIconComponent = (iconName: string) => {
    switch(iconName) {
      case 'home': return Home;
      case 'search': return Search;
      case 'message-circle': return MessageCircle;
      case 'bell': return Bell;
      case 'plus-circle': return PlusCircle;
      case 'bot': return Bot;
      case 'user': return User;
      case 'more-horizontal': return MoreHorizontal;
      default: return Home;
    }
  };

  return (
    <aside className="glass-dark fixed h-full w-64 hidden md:flex flex-col py-4 z-10">
      <div className="px-4 mb-6">
        <h1 className="text-2xl font-semibold flex items-center">
          <span className="bg-gradient-text">InstaDetox</span>
        </h1>
        <p className="text-xs text-gray-400">Tu bienestar digital</p>
      </div>
      
      <nav className="flex-1">
        <ul className="space-y-1 px-2">
          {NAVIGATION_ITEMS.map((item) => {
            const IconComponent = getIconComponent(item.icon);
            
            return (
              <li key={item.name}>
                <Link href={item.path} className={`nav-link flex items-center px-4 py-3 rounded-lg ${isActive(item.path) ? 'active' : ''}`}>
                  <IconComponent className="w-5 h-5 mr-3" />
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="mt-auto px-4 py-2">
        <a href="#" className="flex items-center text-sm text-gray-400 hover:text-white transition-colors">
          <HelpCircle className="w-4 h-4 mr-2" />
          <span>Ayuda y Soporte</span>
        </a>
      </div>
    </aside>
  );
};

export default Sidebar;
