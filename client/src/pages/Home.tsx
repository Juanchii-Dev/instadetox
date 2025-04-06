import { Compass } from "lucide-react";
import { Glass } from "@/components/ui/glass";
import DailyPodcast from "@/components/DailyPodcast";
import DailyBook from "@/components/DailyBook";
import RightPanel from "@/components/RightPanel";

const Home = () => {
  return (
    <div className="flex flex-col md:flex-row">
      {/* Middle content area */}
      <div className="w-full md:w-2/3 lg:w-7/12 space-y-6 pb-8 animate-in fade-in duration-500">
        <Glass className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Compass className="w-5 h-5 mr-2 text-primary" />
            Bienvenido a InstaDetox
          </h2>
          <p className="text-gray-300 mb-4">
            Tu espacio diario para desconectar de las redes sociales y conectar con lo que realmente importa.
          </p>
        </Glass>

        <DailyPodcast />
        <DailyBook />
      </div>

      {/* Right panel */}
      <div className="w-full md:w-1/3 lg:w-5/12 md:pl-6 mt-6 md:mt-0">
        <RightPanel />
      </div>
    </div>
  );
};

export default Home;
