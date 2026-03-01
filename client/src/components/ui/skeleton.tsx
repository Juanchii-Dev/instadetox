import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/20 relative overflow-hidden", className)}
      {...props}
    >
      <div className="absolute inset-0 animate-shimmer" />
    </div>
  )
}

function FeedPostSkeleton() {
  return (
    <div className="ig-feed-card p-0 mb-4 overflow-hidden border border-white/10 rounded-sm">
      {/* Header Skeleton */}
      <div className="flex items-center p-3 gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2 w-16" />
        </div>
      </div>
      
      {/* Media Skeleton */}
      <Skeleton className="aspect-square w-full rounded-none" />
      
      {/* Footer Skeleton */}
      <div className="p-3 space-y-3">
        <div className="flex gap-4">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
        </div>
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

function ProfileGridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-1 sm:gap-6 md:gap-7">
      {Array.from({ length: 9 }).map((_, i) => (
        <Skeleton key={i} className="aspect-square w-full rounded-sm" />
      ))}
    </div>
  )
}

export { Skeleton, FeedPostSkeleton, ProfileGridSkeleton }
