import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  size?: "small" | "medium" | "large";
}

export const Spinner = ({ className, size = "medium" }: SpinnerProps) => {
  const sizeClasses = {
    small: "h-4 w-4 border-2",
    medium: "h-6 w-6 border-3",
    large: "h-8 w-8 border-4",
  };

  return (
    <div 
      className={cn(
        "animate-spin rounded-full border-t-transparent border-primary", 
        sizeClasses[size],
        className
      )}
    />
  );
};