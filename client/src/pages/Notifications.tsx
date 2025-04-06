import { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  CheckCircle, 
  Heart, 
  MoreVertical, 
  X 
} from "lucide-react";
import { Glass } from "@/components/ui/glass";
import { Avatar } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// Tipos de notificaciones
type NotificationType = 
  | 'like' 
  | 'follow' 
  | 'repost' 
  | 'mention' 
  | 'thread' 
  | 'comment';

// Periodos de tiempo para agrupar notificaciones
type TimePeriod = 'today' | 'yesterday' | 'week' | 'month';

interface Notification {
  id: string;
  type: NotificationType;
  user: {
    id: string;
    username: string;
    avatar: string;
    verified?: boolean;
    hasRed?: boolean; // Para el círculo rojo en algunos avatares
  };
  content: string;
  timestamp: string;
  timeAgo: string;
  timePeriod: TimePeriod;
  image?: string;
  actionButton?: 'follow' | null;
}

// Datos de ejemplo para las notificaciones
const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    type: "repost",
    user: {
      id: "user1",
      username: "martu_diaz099",
      avatar: "https://i.pravatar.cc/150?img=1",
      hasRed: true
    },
    content: "reposteó una publicación de its_toxicass.",
    timestamp: "2025-04-05T14:30:00",
    timeAgo: "14 h",
    timePeriod: "yesterday",
    image: "https://picsum.photos/100/100?random=1"
  },
  {
    id: "2",
    type: "like",
    user: {
      id: "user2",
      username: "paolalopezpachao",
      avatar: "https://i.pravatar.cc/150?img=2",
      hasRed: true
    },
    content: "le gustó tu historia.",
    timestamp: "2025-04-05T06:00:00",
    timeAgo: "18 h",
    timePeriod: "yesterday",
    image: "https://picsum.photos/100/100?random=2"
  },
  {
    id: "3",
    type: "follow",
    user: {
      id: "user3",
      username: "deli_minidonas_lapepi",
      avatar: "https://i.pravatar.cc/150?img=3"
    },
    content: "y 505 cuentas más te siguen, pero tú no las sigues a ellas.",
    timestamp: "2025-04-04T12:00:00",
    timeAgo: "1 d",
    timePeriod: "week",
    actionButton: "follow"
  },
  {
    id: "4",
    type: "repost",
    user: {
      id: "user4",
      username: "guille.acosta18",
      avatar: "https://i.pravatar.cc/150?img=4",
      verified: true
    },
    content: "reposteó un reel de capturebizarre.",
    timestamp: "2025-04-03T15:45:00",
    timeAgo: "2 d",
    timePeriod: "week",
    image: "https://picsum.photos/100/100?random=3"
  },
  {
    id: "5",
    type: "repost",
    user: {
      id: "user5",
      username: "snrvalen.72",
      avatar: "https://i.pravatar.cc/150?img=5"
    },
    content: "reposteó un reel por primera vez.",
    timestamp: "2025-04-03T10:30:00",
    timeAgo: "2 d",
    timePeriod: "week",
    image: "https://picsum.photos/100/100?random=4"
  },
  {
    id: "6",
    type: "thread",
    user: {
      id: "user6",
      username: "midu.dev",
      avatar: "https://i.pravatar.cc/150?img=6",
      verified: true
    },
    content: "publicó un hilo que quizá te guste: ¿Qué programador eres tú?",
    timestamp: "2025-04-02T09:15:00",
    timeAgo: "3 d",
    timePeriod: "week",
    image: "https://picsum.photos/100/100?random=5"
  },
  {
    id: "7",
    type: "follow",
    user: {
      id: "user7",
      username: "kaoticode",
      avatar: "https://i.pravatar.cc/150?img=7"
    },
    content: "comenzó a seguirte.",
    timestamp: "2025-03-30T18:20:00",
    timeAgo: "1 sem",
    timePeriod: "month",
    actionButton: "follow"
  },
  {
    id: "8",
    type: "like",
    user: {
      id: "user8",
      username: "paolalopezpachao",
      avatar: "https://i.pravatar.cc/150?img=8",
      hasRed: true
    },
    content: ", virgi0064 y snrvalen.72 les gustó tu historia.",
    timestamp: "2025-03-30T14:10:00",
    timeAgo: "1 sem",
    timePeriod: "month",
    image: "https://picsum.photos/100/100?random=6"
  },
  {
    id: "9",
    type: "follow",
    user: {
      id: "user9",
      username: "worldwebtechnologypvtltd",
      avatar: "https://i.pravatar.cc/150?img=9"
    },
    content: "comenzó a seguirte.",
    timestamp: "2025-03-30T08:45:00",
    timeAgo: "1 sem",
    timePeriod: "month",
    actionButton: "follow"
  }
];

const Notifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [isUpToDate, setIsUpToDate] = useState(true);
  const { toast } = useToast();

  // Agrupar notificaciones por periodo de tiempo
  const notificationsByPeriod = {
    today: notifications.filter(n => n.timePeriod === 'today'),
    yesterday: notifications.filter(n => n.timePeriod === 'yesterday'),
    week: notifications.filter(n => n.timePeriod === 'week'),
    month: notifications.filter(n => n.timePeriod === 'month')
  };

  // Eliminar una notificación
  const removeNotification = (id: string) => {
    setNotifications(prevNotifications => 
      prevNotifications.filter(notification => notification.id !== id)
    );
    
    toast({
      title: "Notificación eliminada",
      description: "La notificación ha sido eliminada correctamente.",
    });
  };

  // Silenciar notificaciones de un usuario
  const muteUser = (username: string) => {
    toast({
      title: `${username} silenciado`,
      description: `No recibirás notificaciones de ${username} por 30 días.`,
    });
  };

  // Seguir a un usuario
  const followUser = (notificationId: string, userId: string, username: string) => {
    // Actualizamos la notificación para quitar el botón
    setNotifications(prevNotifications => 
      prevNotifications.map(notification => 
        notification.id === notificationId 
          ? { ...notification, actionButton: null } 
          : notification
      )
    );
    
    toast({
      title: `Siguiendo a ${username}`,
      description: "Has comenzado a seguir a este usuario.",
    });
  };

  // Renderizar icono según el tipo de notificación
  const renderNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'like':
        return <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <Glass className="p-0 overflow-hidden h-[85vh]">
        <div className="h-full flex flex-col">
          {/* Cabecera */}
          <div className="p-4 border-b border-gray-800 flex items-center">
            <button className="mr-3">
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
            <h2 className="text-xl font-semibold">Notificaciones</h2>
          </div>
          
          {/* Sección "Estás al día" */}
          {isUpToDate && (
            <div className="p-4 flex items-center">
              <div className="bg-gray-800 rounded-full p-2 mr-3">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium">Estás al día</p>
                <a href="#" className="text-blue-500 text-sm">Ver nueva actividad de juanchi_lopezfx</a>
              </div>
            </div>
          )}
          
          {/* Lista de notificaciones */}
          <div className="flex-1 overflow-y-auto">
            {/* Ayer */}
            {notificationsByPeriod.yesterday.length > 0 && (
              <>
                <h3 className="px-4 py-3 font-medium">Ayer</h3>
                {notificationsByPeriod.yesterday.map(notification => (
                  <div key={notification.id} className="px-4 py-3 flex hover:bg-gray-800/30">
                    <div className="relative mr-3">
                      <Avatar className="h-12 w-12 border-2 border-gray-700">
                        <img src={notification.user.avatar} alt={notification.user.username} className="object-cover" />
                      </Avatar>
                      {notification.user.hasRed && (
                        <div className="absolute bottom-0 right-0 bg-rose-500 rounded-full h-4 w-4 flex items-center justify-center border-2 border-black">
                          <Heart className="h-2 w-2 text-white" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <p className="text-sm mb-1">
                        <span className="font-medium">{notification.user.username}</span>
                        {notification.user.verified && (
                          <span className="inline-flex items-center justify-center rounded-full bg-blue-500 h-3 w-3 ml-1">
                            <CheckCircle className="h-2 w-2 text-white" />
                          </span>
                        )}
                        {' '}{notification.content}{' '}
                        <span className="text-gray-400">{notification.timeAgo}</span>
                      </p>
                      
                      {notification.actionButton === 'follow' && (
                        <Button 
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 rounded-lg text-sm"
                          onClick={() => followUser(notification.id, notification.user.id, notification.user.username)}
                        >
                          Seguir también
                        </Button>
                      )}
                    </div>
                    
                    {notification.image && (
                      <div className="ml-2 h-12 w-12 rounded overflow-hidden">
                        <img src={notification.image} alt="Content" className="h-full w-full object-cover" />
                      </div>
                    )}
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="ml-2 text-gray-400 hover:text-white">
                          <MoreVertical className="h-5 w-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700 text-white">
                        <DropdownMenuItem 
                          className="text-red-500 focus:bg-gray-700 cursor-pointer"
                          onClick={() => removeNotification(notification.id)}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="focus:bg-gray-700 cursor-pointer"
                          onClick={() => muteUser(notification.user.username)}
                        >
                          Silenciar a {notification.user.username}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </>
            )}
            
            {/* Últimos 7 días */}
            {notificationsByPeriod.week.length > 0 && (
              <>
                <h3 className="px-4 py-3 font-medium">Últimos 7 días</h3>
                {notificationsByPeriod.week.map(notification => (
                  <div key={notification.id} className="px-4 py-3 flex hover:bg-gray-800/30">
                    <div className="relative mr-3">
                      <Avatar className="h-12 w-12 border-2 border-gray-700">
                        <img src={notification.user.avatar} alt={notification.user.username} className="object-cover" />
                      </Avatar>
                      {notification.user.verified && (
                        <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full h-4 w-4 flex items-center justify-center border-2 border-black">
                          <CheckCircle className="h-2 w-2 text-white" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <p className="text-sm mb-1">
                        <span className="font-medium">{notification.user.username}</span>
                        {notification.user.verified && (
                          <span className="inline-flex items-center justify-center rounded-full bg-blue-500 h-3 w-3 ml-1">
                            <CheckCircle className="h-2 w-2 text-white" />
                          </span>
                        )}
                        {' '}{notification.content}{' '}
                        <span className="text-gray-400">{notification.timeAgo}</span>
                      </p>
                      
                      {notification.actionButton === 'follow' && (
                        <Button 
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 rounded-lg text-sm"
                          onClick={() => followUser(notification.id, notification.user.id, notification.user.username)}
                        >
                          Seguir también
                        </Button>
                      )}
                    </div>
                    
                    {notification.image && (
                      <div className="ml-2 h-12 w-12 rounded overflow-hidden">
                        <img src={notification.image} alt="Content" className="h-full w-full object-cover" />
                      </div>
                    )}
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="ml-2 text-gray-400 hover:text-white">
                          <MoreVertical className="h-5 w-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700 text-white">
                        <DropdownMenuItem 
                          className="text-red-500 focus:bg-gray-700 cursor-pointer"
                          onClick={() => removeNotification(notification.id)}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="focus:bg-gray-700 cursor-pointer"
                          onClick={() => muteUser(notification.user.username)}
                        >
                          Silenciar a {notification.user.username}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </>
            )}
            
            {/* Últimos 30 días */}
            {notificationsByPeriod.month.length > 0 && (
              <>
                <h3 className="px-4 py-3 font-medium">Últimos 30 días</h3>
                {notificationsByPeriod.month.map(notification => (
                  <div key={notification.id} className="px-4 py-3 flex hover:bg-gray-800/30">
                    <div className="relative mr-3">
                      <Avatar className="h-12 w-12 border-2 border-gray-700">
                        <img src={notification.user.avatar} alt={notification.user.username} className="object-cover" />
                      </Avatar>
                      {notification.user.hasRed && (
                        <div className="absolute bottom-0 right-0 bg-rose-500 rounded-full h-4 w-4 flex items-center justify-center border-2 border-black">
                          <Heart className="h-2 w-2 text-white" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <p className="text-sm mb-1">
                        <span className="font-medium">{notification.user.username}</span>
                        {' '}{notification.content}{' '}
                        <span className="text-gray-400">{notification.timeAgo}</span>
                      </p>
                      
                      {notification.actionButton === 'follow' && (
                        <Button 
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 rounded-lg text-sm"
                          onClick={() => followUser(notification.id, notification.user.id, notification.user.username)}
                        >
                          Seguir también
                        </Button>
                      )}
                    </div>
                    
                    {notification.image && (
                      <div className="ml-2 h-12 w-12 rounded overflow-hidden">
                        <img src={notification.image} alt="Content" className="h-full w-full object-cover" />
                      </div>
                    )}
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="ml-2 text-gray-400 hover:text-white">
                          <MoreVertical className="h-5 w-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700 text-white">
                        <DropdownMenuItem 
                          className="text-red-500 focus:bg-gray-700 cursor-pointer"
                          onClick={() => removeNotification(notification.id)}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="focus:bg-gray-700 cursor-pointer"
                          onClick={() => muteUser(notification.user.username)}
                        >
                          Silenciar a {notification.user.username}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </Glass>
    </div>
  );
};

export default Notifications;
