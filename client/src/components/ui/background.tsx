import React from 'react';

export const Background: React.FC = () => {
  return (
    <div 
      className="fixed w-full h-full top-0 left-0 z-[-1] bg-cover bg-center" 
      style={{ 
        backgroundImage: "url('https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=2070')",
        filter: "blur(120px) brightness(0.4)",
        opacity: 0.4
      }} 
    />
  );
};
