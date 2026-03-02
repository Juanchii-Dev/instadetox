import { useState, useEffect } from "react";
import { PlusCircle, Image, Quote, Target, Calendar, Loader2, X, MessageCircle, Edit } from "lucide-react";
import { Glass } from "@/components/ui/glass";
import RightPanel from "@/components/RightPanel";
import { useToast } from "@/hooks/use-toast";

// Tipos de contenido que se pueden crear
type ContentType = 'reflection' | 'quote' | 'goal' | 'milestone';

// Interfaz para el contenido publicado
interface Post {
  id: string;
  type: ContentType;
  title: string;
  content: string;
  image?: string;
  date: string;
  dateFormatted?: string;
}

// Opciones de imágenes para usar en publicaciones
const IMAGE_OPTIONS = [
  {
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8Mnx8cmVsYXh8ZW58MHx8MHx8&auto=format&fit=crop&w=500&q=60",
    label: "Playa"
  },
  {
    url: "https://images.unsplash.com/photo-1513682121497-80211f36a7d3?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8M3x8Zm9yZXN0fGVufDB8fDB8fA%3D%3D&auto=format&fit=crop&w=500&q=60",
    label: "Bosque"
  },
  {
    url: "https://images.unsplash.com/photo-1473296413359-d232d7ebc9a1?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8Mnx8bWluaW1hbGlzbXxlbnwwfHwwfHw%3D&auto=format&fit=crop&w=500&q=60",
    label: "Minimalismo"
  },
  {
    url: "https://images.unsplash.com/photo-1517021897933-0e0319cfbc28?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8MXx8bWluZGZ1bHxlbnwwfHwwfHw%3D&auto=format&fit=crop&w=500&q=60",
    label: "Mindfulness"
  }
];

const Create = () => {
  // Estado para manejar el tipo de contenido seleccionado
  const [contentType, setContentType] = useState<ContentType>('reflection');
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [goalDate, setGoalDate] = useState<string>('');
  const [showImageSelector, setShowImageSelector] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Estado para mostrar publicaciones guardadas
  const [posts, setPosts] = useState<Post[]>(() => {
    const saved = localStorage.getItem('userPosts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // Estado para el modo de edición
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [showPosts, setShowPosts] = useState<boolean>(false);

  const { toast } = useToast();

  // Cargar post en edición si existe
  useEffect(() => {
    if (editingPost) {
      setContentType(editingPost.type);
      setTitle(editingPost.title);
      setContent(editingPost.content);
      setImageUrl(editingPost.image || '');
      setGoalDate(editingPost.date || '');
    }
  }, [editingPost]);

  // Guardar posts en localStorage
  useEffect(() => {
    localStorage.setItem('userPosts', JSON.stringify(posts));
  }, [posts]);

  // Función para validar el formulario
  const validateForm = (): boolean => {
    if (!title.trim()) {
      toast({
        title: "Título requerido",
        description: "Por favor, añade un título a tu publicación",
        duration: 3000,
      });
      return false;
    }

    if (!content.trim()) {
      toast({
        title: "Contenido requerido",
        description: "Por favor, añade algún contenido a tu publicación",
        duration: 3000,
      });
      return false;
    }

    if (contentType === 'goal' && !goalDate) {
      toast({
        title: "Fecha requerida",
        description: "Por favor, selecciona una fecha para tu meta",
        duration: 3000,
      });
      return false;
    }

    return true;
  };

  // Función para publicar el contenido
  const handleSubmit = () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    // Simulamos un retraso para mostrar el estado de carga
    setTimeout(() => {
      try {
        const now = new Date();
        const newPost: Post = {
          id: editingPost ? editingPost.id : `post-${Date.now()}`,
          type: contentType,
          title,
          content,
          image: imageUrl,
          date: contentType === 'goal' ? goalDate : now.toISOString(),
          dateFormatted: now.toLocaleDateString()
        };
        
        if (editingPost) {
          // Si estamos editando, actualizamos el post existente
          setPosts(prev => prev.map(post => post.id === editingPost.id ? newPost : post));
          toast({
            title: "Publicación actualizada",
            description: "Tu publicación ha sido actualizada correctamente",
            duration: 3000,
          });
          setEditingPost(null);
        } else {
          // Si es una nueva publicación, la añadimos al inicio
          setPosts(prev => [newPost, ...prev]);
          toast({
            title: "¡Publicado con éxito!",
            description: "Tu contenido ha sido publicado correctamente",
            duration: 3000,
          });
        }
        
        // Resetear el formulario
        resetForm();
      } catch (error) {
        toast({
          title: "Error al publicar",
          description: "Ha ocurrido un error. Por favor, inténtalo de nuevo.",
          duration: 3000,
        });
      } finally {
        setIsSubmitting(false);
      }
    }, 1000);
  };

  // Función para editar un post existente
  const handleEditPost = (post: Post) => {
    setEditingPost(post);
    setShowPosts(false);
  };

  // Función para eliminar un post
  const handleDeletePost = (postId: string) => {
    setPosts(prev => prev.filter(post => post.id !== postId));
    toast({
      title: "Publicación eliminada",
      description: "La publicación ha sido eliminada correctamente",
      duration: 3000,
    });
  };

  // Función para cancelar la edición
  const cancelEdit = () => {
    setEditingPost(null);
    resetForm();
  };

  // Resetear el formulario
  const resetForm = () => {
    setTitle('');
    setContent('');
    setImageUrl('');
    setGoalDate('');
    setShowImageSelector(false);
  };

  // Renderizado condicional para diferentes tipos de contenido
  const renderContentTypeForm = () => {
    switch (contentType) {
      case 'reflection':
        return (
          <div className="space-y-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título de tu reflexión"
              className="w-full bg-black/30 border border-gray-700 rounded-lg p-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Comparte tus pensamientos y experiencias sobre el desapego digital..."
              className="w-full bg-black/30 border border-gray-700 rounded-lg p-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none h-32"
            />
            
            {/* Selector de imagen */}
            <div>
              <button 
                type="button"
                onClick={() => setShowImageSelector(!showImageSelector)}
                className="flex items-center text-sm text-gray-300 hover:text-white"
              >
                <Image className="w-4 h-4 mr-2" />
                {imageUrl ? 'Cambiar imagen' : 'Añadir imagen'}
              </button>
              
              {showImageSelector && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {IMAGE_OPTIONS.map((img, idx) => (
                    <div 
                      key={idx}
                      onClick={() => {
                        setImageUrl(img.url);
                        setShowImageSelector(false);
                      }}
                      className={`cursor-pointer rounded-lg overflow-hidden border-2 ${imageUrl === img.url ? 'border-primary' : 'border-transparent'}`}
                    >
                      <img 
                        src={img.url} 
                        alt={img.label}
                        className="w-full h-24 object-cover"
                      />
                      <div className="p-1 text-xs text-center">{img.label}</div>
                    </div>
                  ))}
                </div>
              )}
              
              {imageUrl && !showImageSelector && (
                <div className="mt-2 relative">
                  <img 
                    src={imageUrl} 
                    alt="Imagen seleccionada" 
                    className="w-full h-40 object-cover rounded-lg"
                  />
                  <button 
                    onClick={() => setImageUrl('')}
                    className="absolute top-2 right-2 bg-black/70 p-1 rounded-full hover:bg-black"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
        
      case 'quote':
        return (
          <div className="space-y-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Autor de la cita"
              className="w-full bg-black/30 border border-gray-700 rounded-lg p-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe aquí la cita inspiradora..."
              className="w-full bg-black/30 border border-gray-700 rounded-lg p-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none h-32"
            />
          </div>
        );
        
      case 'goal':
        return (
          <div className="space-y-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título de tu meta"
              className="w-full bg-black/30 border border-gray-700 rounded-lg p-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe tu meta de desintoxicación digital..."
              className="w-full bg-black/30 border border-gray-700 rounded-lg p-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none h-32"
            />
            <div>
              <label className="block text-sm text-gray-400 mb-1">Fecha objetivo</label>
              <input
                type="date"
                value={goalDate}
                onChange={(e) => setGoalDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full bg-black/30 border border-gray-700 rounded-lg p-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        );
        
      case 'milestone':
        return (
          <div className="space-y-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título del logro"
              className="w-full bg-black/30 border border-gray-700 rounded-lg p-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe el logro que has alcanzado en tu desintoxicación digital..."
              className="w-full bg-black/30 border border-gray-700 rounded-lg p-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none h-32"
            />
            {/* Selector de imagen */}
            <div>
              <button 
                type="button"
                onClick={() => setShowImageSelector(!showImageSelector)}
                className="flex items-center text-sm text-gray-300 hover:text-white"
              >
                <Image className="w-4 h-4 mr-2" />
                {imageUrl ? 'Cambiar imagen' : 'Añadir imagen'}
              </button>
              
              {showImageSelector && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {IMAGE_OPTIONS.map((img, idx) => (
                    <div 
                      key={idx}
                      onClick={() => {
                        setImageUrl(img.url);
                        setShowImageSelector(false);
                      }}
                      className={`cursor-pointer rounded-lg overflow-hidden border-2 ${imageUrl === img.url ? 'border-primary' : 'border-transparent'}`}
                    >
                      <img 
                        src={img.url} 
                        alt={img.label}
                        className="w-full h-24 object-cover"
                      />
                      <div className="p-1 text-xs text-center">{img.label}</div>
                    </div>
                  ))}
                </div>
              )}
              
              {imageUrl && !showImageSelector && (
                <div className="mt-2 relative">
                  <img 
                    src={imageUrl} 
                    alt="Imagen seleccionada" 
                    className="w-full h-40 object-cover rounded-lg"
                  />
                  <button 
                    onClick={() => setImageUrl('')}
                    className="absolute top-2 right-2 bg-black/70 p-1 rounded-full hover:bg-black"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  // Función para renderizar el ícono según el tipo de contenido
  const getContentTypeIcon = (type: ContentType) => {
    switch (type) {
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

  // Componente para mostrar publicaciones previas
  const renderPostsList = () => {
    if (posts.length === 0) {
      return (
        <div className="text-center p-8 text-gray-400">
          <p>Aún no has creado ninguna publicación</p>
        </div>
      );
    }

    return (
      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
        {posts.map((post) => (
          <div key={post.id} className="border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center">
                <div className="bg-gray-800 p-1.5 rounded-md mr-2">
                  {getContentTypeIcon(post.type)}
                </div>
                <h3 className="font-medium">{post.title}</h3>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEditPost(post)}
                  className="p-1.5 hover:bg-gray-800 rounded transition-colors"
                  title="Editar"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeletePost(post.id)}
                  className="p-1.5 hover:bg-gray-800 rounded transition-colors text-red-400"
                  title="Eliminar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <p className="text-gray-300 text-sm mb-3 whitespace-pre-line">
              {post.content}
            </p>
            
            {post.image && (
              <div className="mb-3">
                <img 
                  src={post.image} 
                  alt={post.title}
                  className="w-full h-40 object-cover rounded-lg"
                />
              </div>
            )}
            
            <div className="text-xs text-gray-500">
              {post.type === 'goal' ? (
                <span>Meta para: {new Date(post.date).toLocaleDateString()}</span>
              ) : (
                <span>Publicado: {post.dateFormatted || new Date(post.date).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Renderizar la interfaz principal
  return (
    <div className="flex flex-col md:flex-row">
      {/* Middle content area */}
      <div className="w-full md:w-2/3 lg:w-7/12 space-y-6 pb-8 animate-in fade-in duration-500">
        <Glass className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold flex items-center">
              <PlusCircle className="w-5 h-5 mr-2 text-primary" />
              {editingPost ? 'Editar contenido' : 'Crear contenido'}
            </h2>
            <div className="flex space-x-2">
              <button 
                onClick={() => setShowPosts(!showPosts)}
                className={`px-3 py-1 rounded text-sm ${showPosts ? 'bg-primary/20 text-primary' : 'hover:bg-gray-800'}`}
              >
                {showPosts ? 'Crear nuevo' : 'Ver publicaciones'}
              </button>
            </div>
          </div>
          
          {showPosts ? (
            renderPostsList()
          ) : (
            <>
              <p className="text-gray-300 mb-4">
                {editingPost ? 'Edita tu contenido existente.' : 'Comparte tus experiencias y logros en InstaDetox.'}
              </p>
            
              {/* Selector de tipo de contenido */}
              <div className="flex flex-wrap mb-4 bg-black/20 rounded-lg p-1">
                <button 
                  onClick={() => setContentType('reflection')}
                  className={`flex-1 flex items-center justify-center py-2 rounded-md text-sm ${contentType === 'reflection' ? 'bg-primary/20 text-primary' : 'hover:bg-gray-800'}`}
                >
                  <MessageCircle className="w-4 h-4 mr-1" />
                  Reflexión
                </button>
                <button 
                  onClick={() => setContentType('quote')}
                  className={`flex-1 flex items-center justify-center py-2 rounded-md text-sm ${contentType === 'quote' ? 'bg-primary/20 text-primary' : 'hover:bg-gray-800'}`}
                >
                  <Quote className="w-4 h-4 mr-1" />
                  Cita
                </button>
                <button 
                  onClick={() => setContentType('goal')}
                  className={`flex-1 flex items-center justify-center py-2 rounded-md text-sm ${contentType === 'goal' ? 'bg-primary/20 text-primary' : 'hover:bg-gray-800'}`}
                >
                  <Target className="w-4 h-4 mr-1" />
                  Meta
                </button>
                <button 
                  onClick={() => setContentType('milestone')}
                  className={`flex-1 flex items-center justify-center py-2 rounded-md text-sm ${contentType === 'milestone' ? 'bg-primary/20 text-primary' : 'hover:bg-gray-800'}`}
                >
                  <Calendar className="w-4 h-4 mr-1" />
                  Logro
                </button>
              </div>
              
              {/* Formulario según el tipo de contenido */}
              {renderContentTypeForm()}
              
              {/* Botones de acción */}
              <div className="flex justify-end mt-6 space-x-3">
                {editingPost && (
                  <button 
                    onClick={cancelEdit}
                    className="border border-gray-700 hover:border-gray-500 px-4 py-2 rounded-lg inline-flex items-center transition-colors"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </button>
                )}
                
                <button 
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="bg-primary hover:bg-primary/80 px-6 py-2 rounded-lg inline-flex items-center transition-colors disabled:bg-primary/50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {editingPost ? 'Actualizando...' : 'Publicando...'}
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4 mr-2" />
                      {editingPost ? 'Actualizar' : 'Publicar'}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
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
