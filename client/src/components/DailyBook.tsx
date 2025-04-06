import { Glass } from "@/components/ui/glass";
import { BookOpen, Bookmark } from "lucide-react";

const DailyBook = () => {
  return (
    <Glass className="p-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center">
        <BookOpen className="w-5 h-5 mr-2 text-primary" />
        Libro recomendado
      </h2>
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <h3 className="text-lg font-medium mb-2">Digital Minimalism</h3>
          <p className="text-gray-400 mb-2">por Cal Newport</p>
          <p className="text-gray-300">
            Digital Minimalism es un enfoque respaldado por la filosofía para ayudarte a cuestionar qué herramientas digitales (y comportamientos relacionados) aportan valor a tu vida. Es motivado por la creencia de que la desordenada naturaleza de nuestras vidas en línea ha llevado a una existencia estresante y distraída.
          </p>
          <div className="mt-4">
            <button className="bg-primary hover:bg-primary/80 px-4 py-2 rounded-lg inline-flex items-center transition-colors">
              <Bookmark className="w-4 h-4 mr-2" />
              Guardar para después
            </button>
          </div>
        </div>
        <div className="w-full md:w-1/3 flex items-center justify-center">
          <div className="w-44 h-64 rounded-lg overflow-hidden shadow-lg transform rotate-3 transition-transform hover:rotate-0 hover:scale-105">
            <img 
              src="https://images.unsplash.com/photo-1544898471-e21054f33431?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3" 
              alt="Portada del libro Digital Minimalism" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </Glass>
  );
};

export default DailyBook;
