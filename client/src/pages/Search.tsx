import { Search as SearchIcon } from "lucide-react";
import { Glass } from "@/components/ui/glass";
import RightPanel from "@/components/RightPanel";

const Search = () => {
  return (
    <div className="flex flex-col md:flex-row">
      {/* Middle content area */}
      <div className="w-full md:w-2/3 lg:w-7/12 space-y-6 pb-8 animate-in fade-in duration-500">
        <Glass className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <SearchIcon className="w-5 h-5 mr-2 text-primary" />
            Búsqueda
          </h2>
          <p className="text-gray-300 mb-4">
            Encuentra contenido relevante para tu bienestar digital.
          </p>
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar recursos, artículos..."
              className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2 pl-10 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <SearchIcon className="absolute left-3 top-2.5 w-5 h-5 text-gray-500" />
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

export default Search;
