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
  Menu,
  X
} from "lucide-react";

interface MobileNavProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

const MobileNav: React.FC<MobileNavProps> = ({ isOpen, onOpen, onClose }) => {
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
      case 'user': return User;
      case 'more-horizontal': return MoreHorizontal;
      default: return Home;
    }
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-10 glass-dark p-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold">
          <span className="bg-gradient-text">InstaDetox</span>
        </h1>
        <button onClick={onOpen} className="text-white">
          <Menu className="w-6 h-6" />
        </button>
      </div>
      
      {/* Mobile Menu */}
      <div 
        className={`md:hidden fixed inset-0 z-20 glass-dark transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out`}
      >
        <div className="flex flex-col h-full p-4">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl font-semibold">
              <span className="bg-gradient-text">InstaDetox</span>
            </h1>
            <button onClick={onClose} className="text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <nav className="flex-1">
            <ul className="space-y-1">
              {NAVIGATION_ITEMS.map((item) => {
                const IconComponent = getIconComponent(item.icon);
                
                return (
                  <li key={item.name}>
                    <Link 
                      href={item.path} 
                      className={`nav-link flex items-center px-4 py-3 rounded-lg ${isActive(item.path) ? 'active' : ''}`}
                      onClick={onClose}
                    >
                      <IconComponent className="w-5 h-5 mr-3" />
                      <span>{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
};

export default MobileNav;
