import { Compass, PlusCircle } from "lucide-react";
import { Glass } from "@/components/ui/glass";
import DailyPodcast from "@/components/DailyPodcast";
import DailyBook from "@/components/DailyBook";
import RightPanel from "@/components/RightPanel";
import PostFeed from "@/components/PostFeed";
import { motion } from "framer-motion";
import { usePostStore } from "@/lib/postService";
import { Link } from "wouter";

const Home = () => {
  const { posts } = usePostStore();
  
  return (
    <div className="flex flex-col md:flex-row">
      {/* Middle content area */}
      <div className="w-full md:w-2/3 lg:w-7/12 space-y-6 pb-8 animate-in fade-in duration-500">
        <Glass className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center justify-between">
            <div className="flex items-center">
              <Compass className="w-5 h-5 mr-2 text-primary" />
              Bienvenido a InstaDetox
            </div>
            <Link href="/create">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center text-sm bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-full"
              >
                <PlusCircle className="w-4 h-4 mr-1" />
                Crear
              </motion.button>
            </Link>
          </h2>
          <p className="text-gray-300 mb-4">
            Tu espacio diario para desconectar de las redes sociales y conectar con lo que realmente importa.
          </p>
        </Glass>

        {/* Feed de publicaciones */}
        <PostFeed />

        {/* Recomendaciones diarias */}
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
