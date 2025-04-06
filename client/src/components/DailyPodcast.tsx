import { Glass } from "@/components/ui/glass";
import { Bookmark, Share2, PlayCircle } from "lucide-react";

const DailyPodcast = () => {
  return (
    <Glass className="p-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center">
        <PlayCircle className="w-5 h-5 mr-2 text-primary" />
        Video del día
      </h2>
      <p className="text-gray-300 mb-4">
        Cómo el minimalismo digital puede transformar tu vida
      </p>
      <div className="aspect-video rounded-lg overflow-hidden">
        <iframe 
          className="w-full h-full" 
          src="https://www.youtube.com/embed/UQP5jktm0GQ" 
          title="Video del día" 
          frameBorder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowFullScreen
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center">
          <button className="p-2 hover:bg-gray-700 rounded-full transition-colors">
            <Bookmark className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-gray-700 rounded-full transition-colors">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
        <span className="text-sm text-gray-400">10:23 min</span>
      </div>
    </Glass>
  );
};

export default DailyPodcast;
