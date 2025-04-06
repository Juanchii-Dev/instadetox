import { Bell } from "lucide-react";
import { Glass } from "@/components/ui/glass";
import RightPanel from "@/components/RightPanel";

const Notifications = () => {
  return (
    <div className="flex flex-col md:flex-row">
      {/* Middle content area */}
      <div className="w-full md:w-2/3 lg:w-7/12 space-y-6 pb-8 animate-in fade-in duration-500">
        <Glass className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Bell className="w-5 h-5 mr-2 text-primary" />
            Notificaciones
          </h2>
          <p className="text-gray-300 mb-4">
            Mantente al día con las actualizaciones y recordatorios.
          </p>
          <div className="flex items-center justify-center h-60 border border-dashed border-gray-700 rounded-lg">
            <p className="text-gray-400">No hay notificaciones nuevas</p>
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

export default Notifications;
