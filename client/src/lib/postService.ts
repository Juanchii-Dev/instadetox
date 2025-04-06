// Servicio para manejar las publicaciones (posts)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Tipos de contenido que se pueden crear
export type ContentType = 'reflection' | 'quote' | 'goal' | 'milestone';

// Interfaz para el contenido publicado
export interface Post {
  id: string;
  type: ContentType;
  title: string;
  content: string;
  image?: string;
  date: string;
  dateFormatted?: string;
  likes: number;
  comments: number;
}

// Interfaz para el estado global de posts
interface PostState {
  posts: Post[];
  addPost: (post: Post) => void;
  updatePost: (post: Post) => void;
  deletePost: (id: string) => void;
  likePost: (id: string) => void;
}

// Crear store con persistencia
export const usePostStore = create<PostState>()(
  persist(
    (set) => ({
      posts: [],
      addPost: (post) => set((state) => ({ posts: [post, ...state.posts] })),
      updatePost: (post) => set((state) => ({
        posts: state.posts.map((p) => (p.id === post.id ? post : p))
      })),
      deletePost: (id) => set((state) => ({
        posts: state.posts.filter((post) => post.id !== id)
      })),
      likePost: (id) => set((state) => ({
        posts: state.posts.map((post) => 
          post.id === id ? { ...post, likes: post.likes + 1 } : post
        )
      })),
    }),
    {
      name: 'instadetox-posts',
    }
  )
);

// Función auxiliar para formatear una fecha ISO a formato legible
export const formatDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat('es', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

// Obtener un icono para cada tipo de contenido
export const getContentTypeLabel = (type: ContentType): string => {
  switch (type) {
    case 'reflection':
      return 'Reflexión';
    case 'quote':
      return 'Cita';
    case 'goal':
      return 'Meta';
    case 'milestone':
      return 'Logro';
  }
};