import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const QUOTES = [
  {
    text: "La tecnología puede ser nuestra mejor aliada, pero también es importante saber cuándo desconectar y disfrutar del mundo real.",
    author: "Cal Newport",
    image: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8MTB8fGRpZ2l0YWwlMjBtaW5pbWFsaXNtfGVufDB8fDB8fA%3D%3D&auto=format&fit=crop&w=500&q=60"
  },
  {
    text: "Vivimos en la era digital, pero nuestras mentes y cuerpos siguen perteneciendo al mundo analógico.",
    author: "Nicholas Carr",
    image: "https://images.unsplash.com/photo-1557672172-298e090bd0f1?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8Mnx8ZGlnaXRhbCUyMGRldG94fGVufDB8fDB8fA%3D%3D&auto=format&fit=crop&w=500&q=60"
  },
  {
    text: "La simplicidad es la sofisticación suprema.",
    author: "Leonardo da Vinci",
    image: "https://images.unsplash.com/photo-1536659622524-5d12b4e9cf7d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8NXx8c2ltcGxpY2l0eXxlbnwwfHwwfHw%3D&auto=format&fit=crop&w=500&q=60"
  },
  {
    text: "Menos, pero mejor.",
    author: "Dieter Rams",
    image: "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8M3x8bWluaW1hbGlzbXxlbnwwfHwwfHw%3D&auto=format&fit=crop&w=500&q=60"
  },
  {
    text: "La atención es el recurso más escaso y valioso que tenemos.",
    author: "Adam Gazzaley",
    image: "https://images.unsplash.com/photo-1489533119213-66a5cd877091?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8Nnx8Zm9jdXN8ZW58MHx8MHx8&auto=format&fit=crop&w=500&q=60"
  }
];

export function getRandomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

export const NAVIGATION_ITEMS = [
  { name: "Inicio", icon: "home", path: "/inicio" },
  { name: "Búsqueda", icon: "search", path: "/busqueda" },
  { name: "Mensajes", icon: "message-circle", path: "/mensajes" },
  { name: "Notificaciones", icon: "bell", path: "/notificaciones" },
  { name: "Crear", icon: "plus-circle", path: "/crear" },
  { name: "Perfil", icon: "user", path: "/perfil" },
  { name: "Más", icon: "more-horizontal", path: "/mas" }
];

export const UPCOMING_UPDATES = [
  { 
    status: "green", 
    text: "Nueva funcionalidad de seguimiento de metas (10 mayo)" 
  },
  { 
    status: "yellow", 
    text: "Integración con calendario (15 mayo)" 
  },
  { 
    status: "blue", 
    text: "Nuevo apartado de recursos (22 mayo)" 
  }
];

export const FRIENDS_IN_DETOX = [
  {
    name: "Carlos M.",
    days: 42,
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
  },
  {
    name: "Ana P.",
    days: 103,
    avatar: "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=400&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
  },
  {
    name: "Miguel L.",
    days: 29,
    avatar: "https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
  }
];
