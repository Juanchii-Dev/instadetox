import { useState, useEffect } from "react";
import { Glass } from "@/components/ui/glass";
import { Quote, Calendar, AlertCircle, Users, RefreshCw } from "lucide-react";
import { getRandomQuote, QUOTES, UPCOMING_UPDATES, FRIENDS_IN_DETOX } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const RightPanel = () => {
  // State for quotes
  const [quotes, setQuotes] = useState(QUOTES.slice(0, 3));
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  
  // State for detox days counter
  const [detoxDays, setDetoxDays] = useState(() => {
    const saved = localStorage.getItem('detoxDays');
    return saved !== null ? parseInt(saved) : 78;
  });

  // Toast notifications
  const { toast } = useToast();

  // Effect to save detox days to localStorage
  useEffect(() => {
    localStorage.setItem('detoxDays', detoxDays.toString());
  }, [detoxDays]);

  // Effect for auto-rotating quotes
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    
    if (autoRotate) {
      interval = setInterval(() => {
        rotateQuotes();
      }, 7000); // rotate every 7 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRotate, currentQuoteIndex]);

  const resetCounter = () => {
    setDetoxDays(0);
    toast({
      title: "Contador reiniciado",
      description: "¡Comienza tu detox digital desde cero!",
      duration: 3000,
    });
  };

  const incrementCounter = () => {
    setDetoxDays(prev => prev + 1);
    toast({
      title: "¡Felicidades!",
      description: "Has sumado un día más a tu detox digital.",
      duration: 3000,
    });
  };

  const rotateQuotes = () => {
    // Get new random quote indexes that aren't currently shown
    const allIndexes = Array.from({ length: QUOTES.length }, (_, i) => i);
    const currentIndexes = quotes.map(q => QUOTES.findIndex(quote => quote.text === q.text));
    const availableIndexes = allIndexes.filter(i => !currentIndexes.includes(i));
    
    // Replace one quote with a new one
    setCurrentQuoteIndex(prev => (prev + 1) % 3);
    
    if (availableIndexes.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableIndexes.length);
      const newQuoteIndex = availableIndexes[randomIndex];
      
      // Replace the current quote with a new one
      const newQuotes = [...quotes];
      newQuotes[currentQuoteIndex] = QUOTES[newQuoteIndex];
      setQuotes(newQuotes);
      
      toast({
        title: "Nueva cita",
        description: "Se ha actualizado una cita inspiradora",
        duration: 2000,
      });
    }
  };

  const toggleAutoRotate = () => {
    setAutoRotate(prev => !prev);
    toast({
      title: autoRotate ? "Rotación automática desactivada" : "Rotación automática activada",
      description: autoRotate ? "Las citas ya no cambiarán automáticamente" : "Las citas cambiarán cada 7 segundos",
      duration: 3000,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Quotes section */}
      <Glass className="p-6 relative">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium flex items-center">
            <Quote className="w-5 h-5 mr-2 text-primary" />
            Citas inspiradoras
          </h3>
          <div className="flex space-x-2">
            <button 
              onClick={rotateQuotes} 
              className="p-1 hover:bg-gray-700 rounded-full transition-colors"
              title="Cambiar citas"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button 
              onClick={toggleAutoRotate} 
              className={`p-1 ${autoRotate ? 'bg-primary/30' : 'hover:bg-gray-700'} rounded-full transition-colors`}
              title={autoRotate ? "Desactivar rotación automática" : "Activar rotación automática"}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                {autoRotate ? "A" : "M"}
              </div>
            </button>
          </div>
        </div>
        
        <div className="space-y-4">
          {quotes.map((quote, index) => (
            <div key={index} className="quote-card p-3 border border-gray-800 rounded-lg transition-all duration-300 hover:border-gray-700">
              <div className="flex">
                <div className="w-12 h-12 rounded overflow-hidden mr-3 flex-shrink-0">
                  <img 
                    src={quote.image} 
                    alt={`Imagen relacionada a la cita de ${quote.author}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-gray-200 italic text-sm">
                    "{quote.text}"
                  </p>
                  <p className="text-right text-xs text-gray-400 mt-1">— {quote.author}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Glass>
      
      {/* Days counter */}
      <Glass className="p-6">
        <h3 className="text-lg font-medium mb-3 flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-primary" />
          InstaDetox
        </h3>
        <div className="flex flex-col items-center py-4">
          <div className="text-5xl font-bold text-center bg-gradient-text transition-all duration-300 transform hover:scale-110">
            {detoxDays}
          </div>
          <p className="text-gray-300 mt-2">días sin Instagram</p>
          <div className="flex space-x-3 mt-4">
            <button 
              onClick={resetCounter} 
              className="border border-gray-600 hover:border-gray-400 px-3 py-1 rounded-lg text-sm transition-colors duration-200"
            >
              Reiniciar
            </button>
            <button 
              onClick={incrementCounter} 
              className="bg-primary/80 hover:bg-primary px-3 py-1 rounded-lg text-sm transition-colors duration-200"
            >
              +1 día
            </button>
          </div>
        </div>
      </Glass>
      
      {/* Updates */}
      <Glass className="p-6">
        <h3 className="text-lg font-medium mb-3 flex items-center">
          <AlertCircle className="w-5 h-5 mr-2 text-primary" />
          Próximas actualizaciones
        </h3>
        <ul className="space-y-3">
          {UPCOMING_UPDATES.map((update, index) => (
            <li key={index} className="flex items-start">
              <span className={`w-2 h-2 rounded-full bg-${update.status}-500 mt-2 mr-2 animate-pulse`}></span>
              <span className="text-gray-300">{update.text}</span>
            </li>
          ))}
        </ul>
      </Glass>
      
      {/* Friend activity */}
      <Glass className="p-6">
        <h3 className="text-lg font-medium mb-3 flex items-center">
          <Users className="w-5 h-5 mr-2 text-primary" />
          Amigos en detox
        </h3>
        <div className="space-y-3">
          {FRIENDS_IN_DETOX.map((friend, index) => (
            <div key={index} className="flex items-center p-2 hover:bg-black/20 rounded-lg transition-colors">
              <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
                <img 
                  src={friend.avatar} 
                  alt={`Avatar de ${friend.name}`} 
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <p className="font-medium">{friend.name}</p>
                <p className="text-sm text-gray-400">{friend.days} días</p>
              </div>
            </div>
          ))}
        </div>
      </Glass>
    </div>
  );
};

export default RightPanel;
