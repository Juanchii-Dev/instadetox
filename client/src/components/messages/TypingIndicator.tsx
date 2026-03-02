/**
 * TypingIndicator.tsx
 * Componente de indicador de escritura tipo Instagram Web
 * Muestra 3 puntitos animados con efecto bounce escalonado
 */

import React from "react";

interface TypingIndicatorProps {
  /** Clase CSS adicional para personalización */
  className?: string;
  /** Tamaño de los puntos (small, medium, large) */
  size?: "small" | "medium" | "large";
  /** Variante de color para el fondo de la burbuja */
  variant?: "dark" | "light";
}

/**
 * Componente que muestra el estado "escribiendo..." con animación de 3 puntos.
 * Replica fielmente el diseño de Instagram Web con la paleta InstaDetox.
 */
export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  className = "",
  size = "medium",
  variant = "dark",
}) => {
  // Configuración de tamaños
  const sizeConfig = {
    small: {
      bubble: "px-3 py-2",
      dot: "w-[6px] h-[6px]",
      gap: "gap-[3px]",
    },
    medium: {
      bubble: "px-4 py-3",
      dot: "w-[8px] h-[8px]",
      gap: "gap-[4px]",
    },
    large: {
      bubble: "px-5 py-4",
      dot: "w-[10px] h-[10px]",
      gap: "gap-[5px]",
    },
  };

  // Configuración de variantes de color
  const variantConfig = {
    dark: {
      bubble: "bg-[#262626]",
      dot: "bg-[#a8a8a8]",
    },
    light: {
      bubble: "bg-[#efefef]",
      dot: "bg-[#737373]",
    },
  };

  const config = sizeConfig[size];
  const colors = variantConfig[variant];

  return (
    <div
      className={`
        inline-flex items-center justify-center rounded-full
        ${config.bubble}
        ${colors.bubble}
        ${className}
      `}
      role="status"
      aria-label="Escribiendo mensaje"
      aria-live="polite"
    >
      <div className={`flex items-center ${config.gap}`}>
        {/* Punto 1 - Sin delay */}
        <span
          className={`
            ${config.dot}
            ${colors.dot}
            rounded-full
            animate-typing-bounce
          `}
          style={{ animationDelay: "0ms" }}
        />
        {/* Punto 2 - Delay 150ms */}
        <span
          className={`
            ${config.dot}
            ${colors.dot}
            rounded-full
            animate-typing-bounce
          `}
          style={{ animationDelay: "150ms" }}
        />
        {/* Punto 3 - Delay 300ms */}
        <span
          className={`
            ${config.dot}
            ${colors.dot}
            rounded-full
            animate-typing-bounce
          `}
          style={{ animationDelay: "300ms" }}
        />
      </div>
      {/* Texto oculto para lectores de pantalla */}
      <span className="sr-only">La otra persona está escribiendo...</span>
    </div>
  );
};

/**
 * Componente de burbuja completa con avatar para mostrar en el hilo de mensajes.
 * Incluye el TypingIndicator posicionado como un mensaje entrante.
 */
interface TypingIndicatorBubbleProps extends TypingIndicatorProps {
  /** URL del avatar del usuario que está escribiendo */
  avatarUrl?: string | null;
  /** Nombre de usuario para el alt del avatar */
  username?: string;
}

export const TypingIndicatorBubble: React.FC<TypingIndicatorBubbleProps> = ({
  avatarUrl,
  username = "Usuario",
  className = "",
  size = "medium",
  variant = "dark",
}) => {
  const AVATAR_FALLBACK_URL = "/avatar_fallback.jpg";

  return (
    <div
      className={`
        flex items-end gap-3
        px-4 py-2
        animate-typing-fade-in
        ${className}
      `}
      role="status"
      aria-label={`${username} está escribiendo`}
    >
      {/* Avatar */}
      <img
        src={avatarUrl ?? AVATAR_FALLBACK_URL}
        alt={`Avatar de ${username}`}
        className="w-7 h-7 rounded-full object-cover flex-shrink-0"
        loading="lazy"
      />

      {/* Indicador de typing */}
      <TypingIndicator size={size} variant={variant} />
    </div>
  );
};

export default TypingIndicator;
