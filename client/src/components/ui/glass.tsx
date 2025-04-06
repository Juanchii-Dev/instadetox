import { cn } from "@/lib/utils";
import React from "react";

type GlassProps = {
  children: React.ReactNode;
  className?: string;
  variant?: "light" | "dark";
} & React.HTMLAttributes<HTMLDivElement>;

export const Glass: React.FC<GlassProps> = ({ 
  children, 
  className, 
  variant = "light", 
  ...props 
}) => {
  return (
    <div 
      className={cn(
        variant === "light" ? "glass" : "glass-dark",
        "rounded-xl",
        className
      )} 
      {...props}
    >
      {children}
    </div>
  );
};
