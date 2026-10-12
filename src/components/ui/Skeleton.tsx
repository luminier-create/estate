import { cn } from '@/lib/utils'

/** 로딩 자리표시자. 스크린리더에는 로딩 상태로 한 번만 알린다. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-pulse rounded-xl bg-[var(--color-border)]/60',
        className,
      )}
    />
  )
}

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-5" role="status" aria-label="불러오는 중">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-28 w-full" />
      ))}
      <span className="sr-only">불러오는 중입니다</span>
    </div>
  )
}
