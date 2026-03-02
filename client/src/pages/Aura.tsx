import { useState, useEffect, useRef } from "react";
import { Glass } from "@/components/ui/glass";
import { Bot, Send, Loader2, Plus, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Sugerencias rápidas para el usuario
const QUICK_SUGGESTIONS = [
  {
    text: "¿Qué es la desintoxicación digital?",
    icon: <ArrowLeft className="w-4 h-4" />,
  },
  {
    text: "Recomiéndame un hábito",
    icon: <Plus className="w-4 h-4" />,
  },
  {
    text: "Muéstrame una cita inspiradora",
    icon: <ArrowLeft className="w-4 h-4" />,
  },
  {
    text: "Explícame la sección Crear",
    icon: <ArrowLeft className="w-4 h-4" />,
  },
];

// Mensaje de bienvenida inicial
const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content: `**Bienvenido a AURA, tu guía de bienestar digital.**

Estoy aquí para ayudarte en tu viaje de desintoxicación digital y bienestar tecnológico. Puedo aconsejarte sobre:

1. Crear hábitos digitales saludables
2. Gestionar la ansiedad por redes sociales
3. Encontrar equilibrio con la tecnología
4. Navegar por las diferentes secciones de InstaDetox

¿En qué puedo ayudarte hoy? 🌱`,
};

const Aura = () => {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Sistema de scroll automático al recibir nuevos mensajes
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Función para manejar el envío de mensajes
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() === "" || isLoading) return;

    const userMessage = { role: "user" as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Realizar la petición a la API de OpenAI
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
    } catch (error) {
      console.error("Error al comunicarse con la API:", error);
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar con AURA. Por favor, inténtalo de nuevo más tarde.",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar las sugerencias rápidas
  const handleSuggestion = (text: string) => {
    setInput(text);
  };

  // Renderizar los mensajes con formato apropiado
  const renderMessage = (message: Message, index: number) => {
    const isUser = message.role === "user";

    return (
      <div
        key={index}
        className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
      >
        <div
          className={`max-w-[80%] rounded-lg p-4 ${
            isUser
              ? "bg-primary/20 text-white"
              : "bg-gray-800/60 border border-gray-700"
          }`}
        >
          {!isUser && (
            <div className="flex items-center mb-2">
              <div className="bg-primary/20 p-1 rounded-full mr-2">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <span className="font-medium text-primary">AURA</span>
            </div>
          )}
          <div 
            className="prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{ 
              __html: formatMessage(message.content) 
            }}
          />
        </div>
      </div>
    );
  };

  // Función para formatear el mensaje con Markdown simple
  const formatMessage = (content: string) => {
    // Formato para negritas
    content = content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    
    // Formato para listas
    content = content.replace(/^\d+\.\s(.*)$/gm, "<li>$1</li>");
    content = content.replace(/<li>/g, "<ol><li>").replace(/<\/li>/g, "</li></ol>");
    content = content.replace(/<\/ol><ol>/g, "");
    
    // Formato para viñetas
    content = content.replace(/^-\s(.*)$/gm, "<li>$1</li>");
    content = content.replace(/(?<!<\/ul>)<li>/g, "<ul><li>").replace(/(?!<ul>)<\/li>/g, "</li></ul>");
    content = content.replace(/<\/ul><ul>/g, "");
    
    // Formato para saltos de línea
    content = content.replace(/\n\n/g, "<br><br>");
    content = content.replace(/\n/g, "<br>");
    
    return content;
  };

  return (
    <div className="w-full animate-in fade-in duration-500">
      <Glass className="p-6 flex flex-col h-[80vh]">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Bot className="w-5 h-5 mr-2 text-primary" />
          AURA - Asistente de Bienestar Digital
        </h2>
        
        {/* Área de mensajes */}
        <div className="flex-1 overflow-y-auto mb-4 pr-2">
          {messages.map(renderMessage)}
          <div ref={messagesEndRef} />
          
          {/* Indicador de escritura */}
          {isLoading && (
            <div className="flex justify-start mb-4">
              <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 flex items-center">
                <Loader2 className="w-4 h-4 text-primary mr-2 animate-spin" />
                <span className="text-gray-400 text-sm">AURA está escribiendo...</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Sugerencias rápidas */}
        <div className="mb-4 flex flex-wrap gap-2">
          {QUICK_SUGGESTIONS.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestion(suggestion.text)}
              className="bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700 rounded-full px-3 py-1.5 text-sm flex items-center transition-colors"
            >
              {suggestion.icon}
              <span className="ml-1">{suggestion.text}</span>
            </button>
          ))}
        </div>
        
        {/* Área de entrada de texto */}
        <form onSubmit={handleSubmit} className="flex">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu mensaje a AURA..."
            className="flex-1 bg-black/30 border border-gray-700 rounded-l-lg p-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || input.trim() === ""}
            className="bg-primary hover:bg-primary/80 px-4 py-3 rounded-r-lg flex items-center justify-center transition-colors disabled:bg-primary/50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      </Glass>
    </div>
  );
};

export default Aura;