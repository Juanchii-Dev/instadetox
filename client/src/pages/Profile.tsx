import { User, Settings, Award } from "lucide-react";
import { Glass } from "@/components/ui/glass";
import RightPanel from "@/components/RightPanel";

const Profile = () => {
  return (
    <div className="flex flex-col md:flex-row">
      {/* Middle content area */}
      <div className="w-full md:w-2/3 lg:w-7/12 space-y-6 pb-8 animate-in fade-in duration-500">
        <Glass className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-24 h-24 bg-primary/30 rounded-full flex items-center justify-center">
              <User className="w-12 h-12 text-primary" />
            </div>
            <div className="text-center sm:text-left">
              <h2 className="text-xl font-semibold">Usuario InstaDetox</h2>
              <p className="text-gray-400">@usuario</p>
              <p className="text-sm text-gray-300 mt-2">
                En desintoxicación digital desde hace 78 días
              </p>
            </div>
          </div>
        </Glass>

        <Glass className="p-6">
          <h3 className="text-lg font-medium mb-3 flex items-center">
            <Award className="w-5 h-5 mr-2 text-primary" />
            Logros
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-black/30 p-4 rounded-lg border border-gray-700 text-center">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                <span className="text-primary font-bold">7</span>
              </div>
              <p className="mt-2 text-sm">Semana inicial</p>
            </div>
            <div className="bg-black/30 p-4 rounded-lg border border-gray-700 text-center">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                <span className="text-primary font-bold">30</span>
              </div>
              <p className="mt-2 text-sm">Mes completo</p>
            </div>
            <div className="bg-black/30 p-4 rounded-lg border border-gray-700 text-center">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                <span className="text-primary font-bold">60</span>
              </div>
              <p className="mt-2 text-sm">Hábito formado</p>
            </div>
          </div>
        </Glass>

        <Glass className="p-6">
          <h3 className="text-lg font-medium mb-3 flex items-center">
            <Settings className="w-5 h-5 mr-2 text-primary" />
            Configuración
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
              <span>Notificaciones diarias</span>
              <div className="w-10 h-5 bg-primary/30 rounded-full relative">
                <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-primary rounded-full"></div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
              <span>Modo oscuro</span>
              <div className="w-10 h-5 bg-primary/30 rounded-full relative">
                <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-primary rounded-full"></div>
              </div>
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

export default Profile;
