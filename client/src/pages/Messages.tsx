import { useState } from "react";
import { MessageCircle, Search, ChevronLeft, Camera, ArrowLeft, Circle, Send } from "lucide-react";
import { Glass } from "@/components/ui/glass";
import { Avatar } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Message {
  id: string;
  user: User;
  content: string;
  timestamp: string;
  read: boolean;
  isLastFromSender: boolean;
}

interface User {
  id: string;
  name: string;
  avatar: string;
  online?: boolean;
  lastSeen?: string;
}

// Datos de ejemplo para las conversaciones
const SAMPLE_USERS: User[] = [
  {
    id: "1",
    name: "María García",
    avatar: "https://i.pravatar.cc/150?img=1",
    online: true
  },
  {
    id: "2",
    name: "Alex Rodríguez",
    avatar: "https://i.pravatar.cc/150?img=2"
  },
  {
    id: "3",
    name: "Laura Martínez",
    avatar: "https://i.pravatar.cc/150?img=3",
    online: true
  },
  {
    id: "4",
    name: "Carlos López",
    avatar: "https://i.pravatar.cc/150?img=4"
  },
  {
    id: "5",
    name: "Ana Wilson",
    avatar: "https://i.pravatar.cc/150?img=5"
  },
  {
    id: "6",
    name: "Tech & Zen",
    avatar: "https://i.pravatar.cc/150?img=12"
  },
  {
    id: "7",
    name: "Digital Detox Club",
    avatar: "https://i.pravatar.cc/150?img=7"
  }
];

// Ejemplo de conversaciones recientes
const SAMPLE_MESSAGES: Message[] = [
  {
    id: "msg1",
    user: SAMPLE_USERS[0],
    content: "Hola, ¿cómo va tu desintoxicación digital?",
    timestamp: "12:30",
    read: true,
    isLastFromSender: true
  },
  {
    id: "msg2",
    user: SAMPLE_USERS[1],
    content: "¿Has visto los nuevos consejos de bienestar?",
    timestamp: "Ayer",
    read: false,
    isLastFromSender: true
  },
  {
    id: "msg3",
    user: SAMPLE_USERS[2],
    content: "Te llamé ayer pero supongo que estabas offline 😊",
    timestamp: "2d",
    read: true,
    isLastFromSender: true
  },
  {
    id: "msg4",
    user: SAMPLE_USERS[3],
    content: "¿Quieres unirte a nuestro grupo de meditación?",
    timestamp: "Lun",
    read: true,
    isLastFromSender: false
  },
  {
    id: "msg5",
    user: SAMPLE_USERS[4],
    content: "Gracias por los consejos de desconexión",
    timestamp: "2 sem",
    read: true,
    isLastFromSender: true
  },
  {
    id: "msg6",
    user: SAMPLE_USERS[5],
    content: "Nuevo artículo sobre bienestar digital disponible",
    timestamp: "2d",
    read: true,
    isLastFromSender: true
  },
  {
    id: "msg7",
    user: SAMPLE_USERS[6],
    content: "¿Te unes a nuestro reto de 7 días sin redes?",
    timestamp: "2 sem",
    read: true,
    isLastFromSender: true
  }
];

const Messages = () => {
  const [selectedChat, setSelectedChat] = useState<User | null>(null);
  const [messageText, setMessageText] = useState("");
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Filtrar mensajes por búsqueda
  const filteredMessages = SAMPLE_MESSAGES.filter(message => 
    message.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    message.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Manejar envío de mensaje
  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedChat) return;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      user: {
        id: 'me',
        name: 'Tú',
        avatar: 'https://i.pravatar.cc/150?img=10'
      },
      content: messageText,
      timestamp: 'Ahora',
      read: true,
      isLastFromSender: true
    };
    
    setChatMessages([...chatMessages, newMessage]);
    setMessageText("");
    
    // Simular respuesta automática después de un tiempo
    setTimeout(() => {
      const autoReply: Message = {
        id: Date.now().toString(),
        user: selectedChat,
        content: `Respuesta automática de ${selectedChat.name}: Gracias por tu mensaje.`,
        timestamp: 'Ahora',
        read: false,
        isLastFromSender: true
      };
      setChatMessages(prev => [...prev, autoReply]);
    }, 1000);
  };

  // Seleccionar un chat
  const selectChat = (user: User) => {
    setSelectedChat(user);
    // Cargar mensajes históricos ficticios para este chat
    setChatMessages([
      {
        id: 'hist1',
        user: user,
        content: `Hola, soy ${user.name}`,
        timestamp: 'Ayer',
        read: true,
        isLastFromSender: true
      },
      {
        id: 'hist2',
        user: {
          id: 'me',
          name: 'Tú',
          avatar: 'https://i.pravatar.cc/150?img=10'
        },
        content: "Hola, ¿cómo estás?",
        timestamp: 'Ayer',
        read: true,
        isLastFromSender: true
      }
    ]);
  };

  // Volver a la lista de chats
  const backToList = () => {
    setSelectedChat(null);
  };

  return (
    <div className="animate-in fade-in duration-500">
      <Glass className="p-0 overflow-hidden h-[85vh]">
        {/* Vista de lista de mensajes */}
        {!selectedChat ? (
          <div className="h-full flex flex-col">
            {/* Cabecera */}
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <h2 className="text-xl font-semibold">Mensajes</h2>
              <div className="flex space-x-2">
                <Tabs defaultValue="primary">
                  <TabsList className="bg-gray-800/60">
                    <TabsTrigger value="primary">Principal</TabsTrigger>
                    <TabsTrigger value="requests">Solicitudes</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
            
            {/* Barra de búsqueda */}
            <div className="p-3 border-b border-gray-800">
              <div className="bg-gray-800/60 rounded-full flex items-center px-3 py-2">
                <Search className="w-5 h-5 text-gray-400 mr-2" />
                <input 
                  type="text" 
                  placeholder="Buscar mensajes"
                  className="bg-transparent border-none focus:outline-none text-white w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            {/* Lista de mensajes */}
            <div className="flex-1 overflow-y-auto">
              {filteredMessages.length > 0 ? (
                <ul>
                  {filteredMessages.map((message) => (
                    <li 
                      key={message.id}
                      className="px-4 py-3 border-b border-gray-800 flex items-center hover:bg-gray-800/30 cursor-pointer transition-colors"
                      onClick={() => selectChat(message.user)}
                    >
                      <div className="relative">
                        <Avatar className="h-12 w-12 border-2 border-gray-700 rounded-full overflow-hidden">
                          <img src={message.user.avatar} alt={message.user.name} className="object-cover" />
                        </Avatar>
                        {message.user.online && (
                          <div className="absolute bottom-0 right-0">
                            <Circle className="h-3 w-3 fill-blue-500 text-blue-500" />
                          </div>
                        )}
                      </div>
                      
                      <div className="ml-3 flex-1">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{message.user.name}</span>
                          <span className="text-xs text-gray-400">{message.timestamp}</span>
                        </div>
                        <div className="flex items-center">
                          <p className="text-sm text-gray-300 truncate max-w-[180px]">
                            {message.isLastFromSender ? "" : "Tú: "}
                            {message.content}
                          </p>
                          {!message.read && (
                            <Circle className="h-2 w-2 fill-blue-500 text-blue-500 ml-2" />
                          )}
                        </div>
                      </div>
                      
                      <Camera className="h-5 w-5 text-gray-400 ml-2" />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-400">No se encontraron mensajes</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Vista de conversación individual
          <div className="h-full flex flex-col">
            {/* Cabecera del chat */}
            <div className="p-4 border-b border-gray-800 flex items-center">
              <button onClick={backToList} className="mr-2">
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>
              
              <Avatar className="h-8 w-8 mr-3">
                <img src={selectedChat.avatar} alt={selectedChat.name} className="object-cover" />
              </Avatar>
              
              <div className="flex-1">
                <h3 className="font-medium">{selectedChat.name}</h3>
                <p className="text-xs text-gray-400">
                  {selectedChat.online ? "En línea" : "Últ. vez hoy"}
                </p>
              </div>
              
              <Camera className="h-5 w-5 text-white" />
            </div>
            
            {/* Área de mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map((msg, index) => (
                <div 
                  key={msg.id}
                  className={`flex ${msg.user.id === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] rounded-2xl p-3 ${
                    msg.user.id === 'me' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-800 text-white'
                  }`}>
                    <p>{msg.content}</p>
                    <span className="text-xs opacity-70 block text-right mt-1">{msg.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Área de entrada de texto */}
            <div className="p-3 border-t border-gray-800 flex items-center">
              <input 
                type="text" 
                placeholder="Mensaje..."
                className="flex-1 bg-gray-800/60 rounded-full px-4 py-2 focus:outline-none"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button 
                className={`ml-2 p-2 rounded-full ${messageText.trim() ? 'text-blue-500' : 'text-gray-500'}`}
                onClick={handleSendMessage}
                disabled={!messageText.trim()}
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </Glass>
    </div>
  );
};

export default Messages;
