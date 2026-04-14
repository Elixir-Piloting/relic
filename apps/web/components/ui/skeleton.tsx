"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "bg-muted rounded-md animate-pulse",
        className
      )}
    />
  );
}

export function TableSkeleton({ 
  rows = 5, 
  columns = 4 
}: { 
  rows?: number; 
  columns?: number 
}) {
  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex gap-4 pb-2 border-b border-border">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-4 w-24" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex gap-4 py-2">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-card rounded-lg border border-border p-4 space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ 
  items = 5, 
  showIcon = true 
}: { 
  items?: number; 
  showIcon?: boolean 
}) {
  return (
    <div className="space-y-1">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          {showIcon && <Skeleton className="h-4 w-4 rounded" />}
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

export function InlineSkeleton({ className }: SkeletonProps) {
  return (
    <span className={cn("inline-block bg-muted rounded animate-pulse", className)}>
      &nbsp;
    </span>
  );
}