import { useState } from "react";
import { Glass } from "@/components/ui/glass";
import { Quote, Calendar, AlertCircle, Users } from "lucide-react";
import { getRandomQuote, UPCOMING_UPDATES, FRIENDS_IN_DETOX } from "@/lib/utils";

const RightPanel = () => {
  const [quote] = useState(getRandomQuote());
  const [detoxDays, setDetoxDays] = useState(78);

  const resetCounter = () => {
    setDetoxDays(0);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Quote of the day */}
      <Glass className="p-6 relative">
        <div className="quote">
          <h3 className="text-lg font-medium mb-3 flex items-center">
            <Quote className="w-5 h-5 mr-2 text-primary" />
            Quote del día
          </h3>
          <p className="text-gray-200 italic">
            "{quote.text}"
          </p>
          <p className="text-right text-sm text-gray-400 mt-3">— {quote.author}</p>
        </div>
      </Glass>
      
      {/* Days counter */}
      <Glass className="p-6">
        <h3 className="text-lg font-medium mb-3 flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-primary" />
          InstaDetox
        </h3>
        <div className="flex flex-col items-center py-4">
          <div className="text-5xl font-bold text-center bg-gradient-text transition-all duration-300 transform">
            {detoxDays}
          </div>
          <p className="text-gray-300 mt-2">días sin Instagram</p>
          <button 
            onClick={resetCounter} 
            className="mt-4 border border-gray-600 hover:border-gray-400 px-3 py-1 rounded-lg text-sm transition-colors duration-200"
          >
            Reiniciar contador
          </button>
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
              <span className={`w-2 h-2 rounded-full bg-${update.status}-500 mt-2 mr-2`}></span>
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
            <div key={index} className="flex items-center">
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
