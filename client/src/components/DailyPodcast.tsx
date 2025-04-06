import { useState, useEffect } from "react";
import { Glass } from "@/components/ui/glass";
import { Bookmark, Share2, PlayCircle, Check, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Definición de los videos disponibles
const DAILY_VIDEOS = [
  {
    id: "UQP5jktm0GQ",
    title: "Cómo el minimalismo digital puede transformar tu vida",
    duration: "10:23",
    thumbnail: "https://images.unsplash.com/photo-1516882056301-c0e5aed493d4?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8NHx8ZGlnaXRhbCUyMGxpZmV8ZW58MHx8MHx8&auto=format&fit=crop&w=500&q=60"
  },
  {
    id: "3qsstax9U-k",
    title: "7 hábitos para mejorar tu bienestar digital",
    duration: "08:45",
    thumbnail: "https://images.unsplash.com/photo-1592424002053-21f369ad7fdb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8MXx8d2VsbGJlaW5nfGVufDB8fDB8fA%3D%3D&auto=format&fit=crop&w=500&q=60"
  },
  {
    id: "Rh-2ERNtpJo",
    title: "Estrategias de desconexión para profesionales",
    duration: "12:08",
    thumbnail: "https://images.unsplash.com/photo-1586473219010-2ffc57b0d282?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8Mnx8ZGlnaXRhbCUyMGRldG94fGVufDB8fDB8fA%3D%3D&auto=format&fit=crop&w=500&q=60"
  },
  {
    id: "tIQ0CG-lHx4",
    title: "Cómo crear un espacio libre de tecnología en tu hogar",
    duration: "09:32",
    thumbnail: "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8M3x8bWluaW1hbGlzbSUyMGhvbWV8ZW58MHx8MHx8&auto=format&fit=crop&w=500&q=60"
  }
];

interface DailyVideo {
  id: string;
  title: string;
  duration: string;
  thumbnail: string;
}

const DailyPodcast = () => {
  // Estado para manejar el video actual y la lista de guardados
  const [currentVideo, setCurrentVideo] = useState<DailyVideo>(() => {
    // Intentar recuperar el video guardado del localStorage
    const lastPlayed = localStorage.getItem('lastPlayedVideo');
    if (lastPlayed) {
      try {
        return JSON.parse(lastPlayed);
      } catch (e) {
        return DAILY_VIDEOS[0];
      }
    }
    return DAILY_VIDEOS[0];
  });
  
  const [savedVideos, setSavedVideos] = useState<DailyVideo[]>(() => {
    // Intentar recuperar videos guardados del localStorage
    const saved = localStorage.getItem('savedVideos');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const { toast } = useToast();

  // Efecto para verificar si el video actual está guardado
  useEffect(() => {
    const videoIsSaved = savedVideos.some(v => v.id === currentVideo.id);
    setIsSaved(videoIsSaved);
  }, [currentVideo, savedVideos]);

  // Efecto para guardar en localStorage
  useEffect(() => {
    localStorage.setItem('savedVideos', JSON.stringify(savedVideos));
  }, [savedVideos]);

  useEffect(() => {
    localStorage.setItem('lastPlayedVideo', JSON.stringify(currentVideo));
  }, [currentVideo]);

  const handleSaveVideo = () => {
    if (isSaved) {
      // Si ya está guardado, lo quitamos de la lista
      setSavedVideos(prev => prev.filter(v => v.id !== currentVideo.id));
      toast({
        title: "Video eliminado",
        description: "Se ha quitado el video de tu lista de guardados",
        duration: 3000,
      });
      setIsSaved(false);
    } else {
      // Si no está guardado, lo añadimos
      setSavedVideos(prev => [...prev, currentVideo]);
      toast({
        title: "Video guardado",
        description: "Se ha guardado el video para ver más tarde",
        duration: 3000,
      });
      setIsSaved(true);
    }
  };

  const handleShareVideo = () => {
    // Simulamos la funcionalidad de compartir copiando la URL al portapapeles
    const videoUrl = `https://www.youtube.com/watch?v=${currentVideo.id}`;
    navigator.clipboard.writeText(videoUrl).then(() => {
      setIsSharing(true);
      toast({
        title: "¡Enlace copiado!",
        description: "El enlace del video ha sido copiado al portapapeles",
        duration: 3000,
      });
      setTimeout(() => setIsSharing(false), 2000);
    }).catch(err => {
      toast({
        title: "Error al compartir",
        description: "No se pudo copiar el enlace al portapapeles",
        duration: 3000,
      });
    });
  };

  const changeVideo = () => {
    // Seleccionar un video diferente al actual
    const filteredVideos = DAILY_VIDEOS.filter(v => v.id !== currentVideo.id);
    const randomIndex = Math.floor(Math.random() * filteredVideos.length);
    setCurrentVideo(filteredVideos[randomIndex]);
    toast({
      title: "Nuevo video",
      description: "Se ha cambiado al video del día",
      duration: 2000,
    });
  };

  return (
    <Glass className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <PlayCircle className="w-5 h-5 mr-2 text-primary" />
          Video del día
        </h2>
        <button 
          onClick={changeVideo}
          className="p-1 hover:bg-gray-700 rounded-full transition-colors text-gray-400 hover:text-white"
          title="Cambiar video"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      
      <p className="text-gray-300 mb-4">
        {currentVideo.title}
      </p>
      
      <div className="aspect-video rounded-lg overflow-hidden relative group">
        {/* Preview thumbnail con efecto hover */}
        <div className="absolute inset-0 group-hover:opacity-0 transition-opacity duration-300 z-10">
          <img 
            src={currentVideo.thumbnail} 
            alt={currentVideo.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <PlayCircle className="w-16 h-16 text-white/80" />
          </div>
        </div>
        
        {/* Iframe del video */}
        <iframe 
          className="w-full h-full" 
          src={`https://www.youtube.com/embed/${currentVideo.id}`}
          title={currentVideo.title}
          frameBorder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowFullScreen
        />
      </div>
      
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center">
          <button 
            onClick={handleSaveVideo} 
            className={`p-2 rounded-full transition-colors ${isSaved ? 'bg-primary/20 text-primary' : 'hover:bg-gray-700'}`}
            title={isSaved ? "Quitar de guardados" : "Guardar para después"}
          >
            {isSaved ? <Check className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
          </button>
          
          <button 
            onClick={handleShareVideo} 
            className={`p-2 rounded-full transition-colors ${isSharing ? 'bg-green-500/20 text-green-400' : 'hover:bg-gray-700'}`}
            title="Compartir video"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
        <span className="text-sm text-gray-400">{currentVideo.duration} min</span>
      </div>
      
      {/* Mostrar videos guardados si hay alguno */}
      {savedVideos.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <h3 className="text-sm font-medium text-gray-400 mb-3">
            Videos guardados ({savedVideos.length})
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
            {savedVideos.map((video) => (
              <div 
                key={video.id} 
                className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${
                  video.id === currentVideo.id ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-gray-800/50'
                }`}
                onClick={() => setCurrentVideo(video)}
              >
                <div className="w-16 h-9 rounded overflow-hidden flex-shrink-0 mr-3">
                  <img 
                    src={video.thumbnail} 
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{video.title}</p>
                  <p className="text-xs text-gray-500">{video.duration}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Glass>
  );
};

export default DailyPodcast;
