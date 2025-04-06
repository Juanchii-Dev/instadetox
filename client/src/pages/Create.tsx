import { PlusCircle } from "lucide-react";
import { Glass } from "@/components/ui/glass";
import RightPanel from "@/components/RightPanel";

const Create = () => {
  return (
    <div className="flex flex-col md:flex-row">
      {/* Middle content area */}
      <div className="w-full md:w-2/3 lg:w-7/12 space-y-6 pb-8 animate-in fade-in duration-500">
        <Glass className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <PlusCircle className="w-5 h-5 mr-2 text-primary" />
            Crear contenido
          </h2>
          <p className="text-gray-300 mb-4">
            Comparte tus experiencias y logros en InstaDetox.
          </p>
          <div className="space-y-4">
            <textarea 
              placeholder="¿Qué quieres compartir hoy?"
              className="w-full bg-black/30 border border-gray-700 rounded-lg p-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none h-32"
            />
            <div className="flex justify-end">
              <button className="bg-primary hover:bg-primary/80 px-4 py-2 rounded-lg inline-flex items-center transition-colors">
                <PlusCircle className="w-4 h-4 mr-2" />
                Publicar
              </button>
            </div>
          </div>
        </Glass>
      </div>

      {/* Right panel */}
      <div className="w-full md:w-1/3 lg:w-5/12 md:pl-6 mt-6 md:mt-0">
        <RightPanel />
      </div>
    </div>
  );
};

export default Create;
