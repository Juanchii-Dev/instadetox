import { useState, useEffect } from "react";
import { MessageCircle, Search, ChevronLeft, Camera, ArrowLeft, Circle, Send, AlertCircle, Loader2 } from "lucide-react";
import { Glass } from "@/components/ui/glass";
import { Avatar } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { User as SupabaseUser, Message as SupabaseMessage, messageService, userService } from "@/lib/supabase";
import { formatDistanceToNow, format, isToday, isYesterday, differenceInDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from "@/lib/AuthContext";

// Interfaces locales para mensajes con formato de visualización
interface ChatMessage {
  id: string;
  userId: string;
  content: string;
  timestamp: string;
  timestampRaw: string;
  isMine: boolean;
}

interface Contact {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
  lastMessage?: {
    content: string;
    timestamp: string;
    read: boolean;
    isMine: boolean;
  };
}

const Messages = () => {
  const { user } = useAuth();
  const [selectedChat, setSelectedChat] = useState<Contact | null>(null);
  const [messageText, setMessageText] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar lista de contactos desde Supabase
  useEffect(() => {
    async function loadContacts() {
      try {
        setLoading(true);
        const { users, error } = await userService.getUsers();
        
        if (error) throw error;
        
        // Filtrar para no incluirnos a nosotros mismos
        const otherUsers = users.filter(u => u.id !== user?.id);
        
        // Convertir usuarios de Supabase a nuestro formato de contactos
        const contactsList = otherUsers.map(u => ({
          id: u.id,
          name: u.full_name || u.username || 'Usuario sin nombre',
          avatar: u.avatar_url || `https://i.pravatar.cc/150?u=${u.id}`,
          online: u.online || false,
          lastMessage: undefined
        }));
        
        setContacts(contactsList);
      } catch (err) {
        console.error('Error al cargar contactos:', err);
        setError('No se pudieron cargar los contactos. Intenta más tarde.');
      } finally {
        setLoading(false);
      }
    }
    
    if (user) {
      loadContacts();
    }
  }, [user]);

  // Formatear timestamp para mostrar
  const formatMessageTimestamp = (timestamp: string): string => {
    const date = parseISO(timestamp);
    
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return 'Ayer';
    } else if (differenceInDays(new Date(), date) < 7) {
      return format(date, 'eeee', { locale: es });
    } else {
      return formatDistanceToNow(date, { addSuffix: true, locale: es });
    }
  };

  // Filtrar contactos por búsqueda
  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (contact.lastMessage?.content || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Manejar envío de mensaje a través de Supabase
  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedChat || !user) return;
    
    try {
      // Crear mensaje temporal optimista mientras se envía
      const optimisticMessage: ChatMessage = {
        id: 'temp-' + Date.now().toString(),
        userId: user.id,
        content: messageText,
        timestamp: 'Enviando...',
        timestampRaw: new Date().toISOString(),
        isMine: true
      };
      
      setChatMessages(msgs => [...msgs, optimisticMessage]);
      setMessageText("");
      
      // Enviar mensaje a Supabase
      const { error } = await messageService.sendMessage(selectedChat.id, messageText);
      
      if (error) {
        throw error;
      }
      
    } catch (err) {
      console.error('Error al enviar mensaje:', err);
      setError('No se pudo enviar el mensaje. Intenta de nuevo.');
    }
  };

  // Seleccionar un chat y cargar mensajes
  const selectChat = async (contact: Contact) => {
    setSelectedChat(contact);
    setLoadingMessages(true);
    setChatMessages([]);
    
    try {
      // Cargar mensajes entre usuarios desde Supabase
      const { messages, error } = await messageService.getMessagesBetweenUsers(contact.id);
      
      if (error) throw error;
      
      // Convertir mensajes de Supabase a nuestro formato local
      const formattedMessages: ChatMessage[] = messages.map(msg => ({
        id: msg.id,
        userId: msg.sender_id,
        content: msg.content,
        timestamp: formatMessageTimestamp(msg.created_at),
        timestampRaw: msg.created_at,
        isMine: msg.sender_id === user?.id
      }));
      
      setChatMessages(formattedMessages);
      
    } catch (err) {
      console.error('Error al cargar mensajes:', err);
      setError('No se pudieron cargar los mensajes. Intenta más tarde.');
    } finally {
      setLoadingMessages(false);
    }
    
    // Suscribirse a nuevos mensajes en tiempo real
    const subscription = messageService.subscribeToMessages((newMessage: SupabaseMessage) => {
      // Solo procesar mensajes relevantes para esta conversación
      if (
        (newMessage.sender_id === user?.id && newMessage.receiver_id === contact.id) ||
        (newMessage.sender_id === contact.id && newMessage.receiver_id === user?.id)
      ) {
        const formattedMessage: ChatMessage = {
          id: newMessage.id,
          userId: newMessage.sender_id,
          content: newMessage.content,
          timestamp: formatMessageTimestamp(newMessage.created_at),
          timestampRaw: newMessage.created_at,
          isMine: newMessage.sender_id === user?.id
        };
        
        setChatMessages(msgs => [...msgs, formattedMessage]);
      }
    });
    
    // Limpiar suscripción al desmontar o cambiar de chat
    return () => {
      subscription.unsubscribe();
    };
  };

  // Volver a la lista de chats
  const backToList = () => {
    setSelectedChat(null);
    setError(null);
  };

  return (
    <div className="animate-in fade-in duration-500">
      <Glass className="p-0 overflow-hidden h-[85vh]">
        {/* Mensaje de error si existe */}
        {error && (
          <div className="bg-red-500/20 p-3 text-red-200 flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}
        
        {/* Vista de lista de contactos */}
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
            
            {/* Lista de contactos */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : filteredContacts.length > 0 ? (
                <ul>
                  {filteredContacts.map((contact) => (
                    <li 
                      key={contact.id}
                      className="px-4 py-3 border-b border-gray-800 flex items-center hover:bg-gray-800/30 cursor-pointer transition-colors"
                      onClick={() => selectChat(contact)}
                    >
                      <div className="relative">
                        <Avatar className="h-12 w-12 border-2 border-gray-700 rounded-full overflow-hidden">
                          <img src={contact.avatar} alt={contact.name} className="object-cover" />
                        </Avatar>
                        {contact.online && (
                          <div className="absolute bottom-0 right-0">
                            <Circle className="h-3 w-3 fill-blue-500 text-blue-500" />
                          </div>
                        )}
                      </div>
                      
                      <div className="ml-3 flex-1">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{contact.name}</span>
                          <span className="text-xs text-gray-400">{contact.lastMessage?.timestamp || ''}</span>
                        </div>
                        {contact.lastMessage && (
                          <div className="flex items-center">
                            <p className="text-sm text-gray-300 truncate max-w-[180px]">
                              {contact.lastMessage.isMine ? "Tú: " : ""}
                              {contact.lastMessage.content}
                            </p>
                            {!contact.lastMessage.read && !contact.lastMessage.isMine && (
                              <Circle className="h-2 w-2 fill-blue-500 text-blue-500 ml-2" />
                            )}
                          </div>
                        )}
                      </div>
                      
                      <Camera className="h-5 w-5 text-gray-400 ml-2" />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                  <MessageCircle className="h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-300 font-medium mb-1">No hay mensajes aún</p>
                  <p className="text-gray-400 text-sm">
                    {searchQuery 
                      ? "No se encontraron contactos con ese término" 
                      : "Conéctate con otros usuarios para comenzar a chatear"}
                  </p>
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
              {loadingMessages ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : chatMessages.length > 0 ? (
                chatMessages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] rounded-2xl p-3 ${
                      msg.isMine 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-800 text-white'
                    }`}>
                      <p>{msg.content}</p>
                      <span className="text-xs opacity-70 block text-right mt-1">{msg.timestamp}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                  <MessageCircle className="h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-300 font-medium">Comienza una conversación</p>
                  <p className="text-gray-400 text-sm mt-1">
                    No hay mensajes previos con {selectedChat.name}
                  </p>
                </div>
              )}
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
