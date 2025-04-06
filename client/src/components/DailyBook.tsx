import { useState, useEffect } from "react";
import { Glass } from "@/components/ui/glass";
import { BookOpen, Bookmark, RefreshCw, Check, Share2, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Libros recomendados
const RECOMMENDED_BOOKS = [
  {
    id: "digitalmin",
    title: "Digital Minimalism",
    author: "Cal Newport",
    description: "Digital Minimalism es un enfoque respaldado por la filosofía para ayudarte a cuestionar qué herramientas digitales (y comportamientos relacionados) aportan valor a tu vida. Es motivado por la creencia de que la desordenada naturaleza de nuestras vidas en línea ha llevado a una existencia estresante y distraída.",
    cover: "https://images.unsplash.com/photo-1544898471-e21054f33431?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    rating: 4.5
  },
  {
    id: "deepwork",
    title: "Deep Work",
    author: "Cal Newport",
    description: "Deep Work explora cómo la concentración profunda se está convirtiendo en una habilidad rara y valiosa en nuestra economía, y por qué las personas que cultivan esta habilidad prosperarán. El libro proporciona reglas para transformar tu mente y hábitos para apoyar este tipo de trabajo profundo.",
    cover: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8NXx8ZGVlcCUyMHdvcmt8ZW58MHx8MHx8&auto=format&fit=crop&w=500&q=60",
    rating: 4.7
  },
  {
    id: "indistractable",
    title: "Indistractable",
    author: "Nir Eyal",
    description: "Indistractable proporciona un marco práctico para controlar tu atención y elegir tu vida. El libro identifica las causas raíz de la distracción y ofrece una serie de técnicas para ayudarte a manejar las distracciones internas y externas.",
    cover: "https://images.unsplash.com/photo-1553729459-efe14ef6055d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8MTB8fGZvY3VzfGVufDB8fDB8fA%3D%3D&auto=format&fit=crop&w=500&q=60",
    rating: 4.3
  },
  {
    id: "howtodo",
    title: "How to Do Nothing",
    author: "Jenny Odell",
    description: "How to Do Nothing es un replanteamiento de la noción de productividad que pone de relieve nuestras relaciones más básicas y los placeres de la atención. La autora critica la idea actual de que el tiempo debe estar optimizado para la productividad y nos invita a reconectar con nuestro entorno inmediato.",
    cover: "https://images.unsplash.com/photo-1611784728558-6a9848d00c0b?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8Mnx8cmVsYXglMjBuYXR1cmV8ZW58MHx8MHx8&auto=format&fit=crop&w=500&q=60",
    rating: 4.1
  }
];

interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  cover: string;
  rating: number;
}

const DailyBook = () => {
  // Estado para manejar el libro actual y libros guardados
  const [currentBook, setCurrentBook] = useState<Book>(() => {
    // Intentar recuperar el último libro mostrado
    const saved = localStorage.getItem('lastBook');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return RECOMMENDED_BOOKS[0];
      }
    }
    return RECOMMENDED_BOOKS[0];
  });
  
  const [savedBooks, setSavedBooks] = useState<Book[]>(() => {
    // Recuperar libros guardados del localStorage
    const saved = localStorage.getItem('savedBooks');
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

  // Comprobar si el libro actual está guardado
  useEffect(() => {
    const bookIsSaved = savedBooks.some(b => b.id === currentBook.id);
    setIsSaved(bookIsSaved);
  }, [currentBook, savedBooks]);

  // Guardar cambios en localStorage
  useEffect(() => {
    localStorage.setItem('savedBooks', JSON.stringify(savedBooks));
  }, [savedBooks]);

  useEffect(() => {
    localStorage.setItem('lastBook', JSON.stringify(currentBook));
  }, [currentBook]);

  const handleSaveBook = () => {
    if (isSaved) {
      // Si ya está guardado, lo eliminamos
      setSavedBooks(prev => prev.filter(b => b.id !== currentBook.id));
      toast({
        title: "Libro eliminado",
        description: "Se ha quitado el libro de tu lista de lectura",
        duration: 3000,
      });
      setIsSaved(false);
    } else {
      // Si no está guardado, lo añadimos
      setSavedBooks(prev => [...prev, currentBook]);
      toast({
        title: "Libro guardado",
        description: "Se ha añadido el libro a tu lista de lectura",
        duration: 3000,
      });
      setIsSaved(true);
    }
  };

  const handleShareBook = () => {
    // Simulamos compartir creando un texto con detalles del libro
    const bookInfo = `📚 Recomendación: "${currentBook.title}" de ${currentBook.author} - Una obra clave sobre el bienestar digital`;
    navigator.clipboard.writeText(bookInfo).then(() => {
      setIsSharing(true);
      toast({
        title: "¡Información copiada!",
        description: "La información del libro ha sido copiada al portapapeles",
        duration: 3000,
      });
      setTimeout(() => setIsSharing(false), 2000);
    }).catch(err => {
      toast({
        title: "Error al compartir",
        description: "No se pudo copiar la información al portapapeles",
        duration: 3000,
      });
    });
  };

  const changeBook = () => {
    // Seleccionar un libro diferente al actual
    const filteredBooks = RECOMMENDED_BOOKS.filter(b => b.id !== currentBook.id);
    const randomIndex = Math.floor(Math.random() * filteredBooks.length);
    setCurrentBook(filteredBooks[randomIndex]);
    toast({
      title: "Nueva recomendación",
      description: "Se ha cambiado al libro recomendado del día",
      duration: 2000,
    });
  };

  // Función para renderizar estrellas de valoración
  const renderRatingStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    return (
      <div className="flex items-center">
        {[...Array(5)].map((_, index) => {
          if (index < fullStars) {
            return <Star key={index} className="w-4 h-4 fill-yellow-500 text-yellow-500" />;
          } else if (index === fullStars && hasHalfStar) {
            return (
              <div key={index} className="relative">
                <Star className="w-4 h-4 text-gray-500" />
                <div className="absolute top-0 left-0 w-1/2 overflow-hidden">
                  <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                </div>
              </div>
            );
          } else {
            return <Star key={index} className="w-4 h-4 text-gray-500" />;
          }
        })}
        <span className="ml-1 text-sm text-gray-400">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <Glass className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <BookOpen className="w-5 h-5 mr-2 text-primary" />
          Libro recomendado
        </h2>
        <button 
          onClick={changeBook}
          className="p-1 hover:bg-gray-700 rounded-full transition-colors text-gray-400 hover:text-white"
          title="Cambiar recomendación"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-medium mb-1">{currentBook.title}</h3>
              <p className="text-gray-400 mb-2">por {currentBook.author}</p>
            </div>
            <div className="hidden md:block">
              {renderRatingStars(currentBook.rating)}
            </div>
          </div>
          
          <div className="md:hidden mb-2">
            {renderRatingStars(currentBook.rating)}
          </div>
          
          <p className="text-gray-300 mb-4">
            {currentBook.description}
          </p>
          
          <div className="flex space-x-3">
            <button 
              onClick={handleSaveBook}
              className={`px-4 py-2 rounded-lg inline-flex items-center transition-colors ${
                isSaved 
                ? 'bg-primary/20 text-primary border border-primary/30' 
                : 'bg-primary hover:bg-primary/80'
              }`}
            >
              {isSaved ? <Check className="w-4 h-4 mr-2" /> : <Bookmark className="w-4 h-4 mr-2" />}
              {isSaved ? 'Guardado' : 'Guardar para después'}
            </button>
            
            <button 
              onClick={handleShareBook}
              className={`border border-gray-700 hover:border-gray-500 px-4 py-2 rounded-lg inline-flex items-center transition-colors ${
                isSharing ? 'bg-green-500/20 text-green-400' : ''
              }`}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Compartir
            </button>
          </div>
          
          {/* Lista de libros guardados (versión móvil) */}
          {savedBooks.length > 0 && (
            <div className="mt-6 md:hidden">
              <h4 className="text-sm font-medium text-gray-400 mb-3">
                Tu lista de lectura ({savedBooks.length})
              </h4>
              <div className="flex overflow-x-auto space-x-4 pb-2">
                {savedBooks.map((book) => (
                  <div 
                    key={book.id} 
                    className={`flex-shrink-0 w-24 cursor-pointer ${
                      book.id === currentBook.id ? 'opacity-100 ring-2 ring-primary' : 'opacity-80 hover:opacity-100'
                    }`}
                    onClick={() => setCurrentBook(book)}
                  >
                    <div className="w-24 h-36 rounded-lg overflow-hidden shadow-lg">
                      <img 
                        src={book.cover} 
                        alt={`Portada de ${book.title}`} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-xs mt-1 truncate">{book.title}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="w-full md:w-1/3 flex flex-col items-center justify-center space-y-4">
          <div className="w-44 h-64 rounded-lg overflow-hidden shadow-lg transform rotate-3 transition-transform hover:rotate-0 hover:scale-105">
            <img 
              src={currentBook.cover} 
              alt={`Portada del libro ${currentBook.title}`} 
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* Lista de libros guardados (versión desktop) */}
          {savedBooks.length > 0 && (
            <div className="hidden md:block w-full">
              <h4 className="text-sm font-medium text-gray-400 mb-2 text-center">
                Tu lista de lectura
              </h4>
              <div className="flex justify-center space-x-2">
                {savedBooks.slice(0, 3).map((book) => (
                  <div 
                    key={book.id} 
                    className={`w-12 h-20 rounded-md overflow-hidden cursor-pointer transform transition-transform ${
                      book.id === currentBook.id 
                      ? 'ring-2 ring-primary scale-110' 
                      : 'opacity-70 hover:opacity-100 hover:scale-105'
                    }`}
                    onClick={() => setCurrentBook(book)}
                    title={book.title}
                  >
                    <img 
                      src={book.cover} 
                      alt={`${book.title} miniatura`} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
                {savedBooks.length > 3 && (
                  <div className="w-12 h-20 rounded-md overflow-hidden bg-gray-800 flex items-center justify-center text-xs text-gray-400">
                    +{savedBooks.length - 3}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Glass>
  );
};

export default DailyBook;
