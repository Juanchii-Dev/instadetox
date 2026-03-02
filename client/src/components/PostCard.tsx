import { useState } from 'react';
import { Heart, MessageCircle, Quote, Target, Calendar, MoreVertical, Bookmark, Share2, Trash2 } from 'lucide-react';
import { Glass } from '@/components/ui/glass';
import { Avatar } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { usePostStore, Post, formatDate, getContentTypeLabel } from '@/lib/postService';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { motion } from 'framer-motion';

interface PostCardProps {
  post: Post;
  onEdit?: (post: Post) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, onEdit }) => {
  const { deletePost, likePost } = usePostStore();
  const [showFullContent, setShowFullContent] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const { toast } = useToast();
  
  // Verificar si el contenido es largo
  const isLongContent = post.content.length > 200;
  const displayContent = showFullContent 
    ? post.content 
    : isLongContent ? `${post.content.substring(0, 200)}...` : post.content;
    
  // Renderizar icono según tipo de contenido
  const getContentTypeIcon = () => {
    switch (post.type) {
      case 'reflection':
        return <MessageCircle className="w-4 h-4" />;
      case 'quote':
        return <Quote className="w-4 h-4" />;
      case 'goal':
        return <Target className="w-4 h-4" />;
      case 'milestone':
        return <Calendar className="w-4 h-4" />;
    }
  };
  
  // Manejar acciones
  const handleLike = () => {
    if (!isLiked) {
      likePost(post.id);
      setIsLiked(true);
      toast({
        title: "Publicación gustada",
        description: "Has indicado que te gusta esta publicación",
      });
    }
  };
  
  const handleSave = () => {
    setIsSaved(!isSaved);
    toast({
      title: isSaved ? "Eliminado de guardados" : "Guardado en colección",
      description: isSaved 
        ? "Se ha eliminado de tus elementos guardados" 
        : "Se ha añadido a tus elementos guardados",
    });
  };
  
  const handleDelete = () => {
    deletePost(post.id);
    toast({
      title: "Publicación eliminada",
      description: "La publicación ha sido eliminada correctamente",
    });
  };
  
  const handleShare = () => {
    toast({
      title: "Compartido",
      description: "Enlace de la publicación copiado al portapapeles",
    });
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Glass className="mb-6 overflow-hidden">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center space-x-3">
            <Avatar className="h-9 w-9 border-2 border-gray-700">
              <img src="https://i.pravatar.cc/150?img=10" alt="User" className="object-cover" />
            </Avatar>
            <div>
              <div className="font-medium">Tu</div>
              <div className="text-xs text-gray-400">{formatDate(post.date)}</div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="bg-gray-800/60 py-1 px-2 rounded-full text-xs flex items-center">
              {getContentTypeIcon()}
              <span className="ml-1">{getContentTypeLabel(post.type)}</span>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 hover:bg-gray-800 rounded-full">
                  <MoreVertical className="h-5 w-5 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700 text-white">
                {onEdit && (
                  <DropdownMenuItem 
                    className="focus:bg-gray-700 cursor-pointer"
                    onClick={() => onEdit(post)}
                  >
                    Editar publicación
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  className="focus:bg-gray-700 cursor-pointer"
                  onClick={handleDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Contenido */}
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-2">{post.title}</h3>
          <p className="mb-3 whitespace-pre-line text-gray-200">{displayContent}</p>
          
          {isLongContent && (
            <button 
              onClick={() => setShowFullContent(!showFullContent)}
              className="text-primary text-sm hover:underline mb-2"
            >
              {showFullContent ? "Ver menos" : "Ver más"}
            </button>
          )}
          
          {post.image && (
            <div className="mt-3 mb-4">
              <img 
                src={post.image} 
                alt={post.title} 
                className="w-full h-auto max-h-[400px] object-cover rounded-lg"
              />
            </div>
          )}
        </div>
        
        {/* Acciones */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
          <div className="flex space-x-4">
            <button 
              onClick={handleLike}
              className="flex items-center text-gray-400 hover:text-white"
            >
              <Heart 
                className={`h-5 w-5 mr-1 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} 
              />
              <span>{post.likes + (isLiked ? 1 : 0)}</span>
            </button>
            
            <button className="flex items-center text-gray-400 hover:text-white">
              <MessageCircle className="h-5 w-5 mr-1" />
              <span>{post.comments}</span>
            </button>
          </div>
          
          <div className="flex space-x-3">
            <button 
              onClick={handleShare}
              className="text-gray-400 hover:text-white"
            >
              <Share2 className="h-5 w-5" />
            </button>
            
            <button 
              onClick={handleSave}
              className="text-gray-400 hover:text-white"
            >
              <Bookmark className={`h-5 w-5 ${isSaved ? 'fill-primary text-primary' : ''}`} />
            </button>
          </div>
        </div>
      </Glass>
    </motion.div>
  );
};

export default PostCard;