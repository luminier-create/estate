import { cn } from '@/lib/utils'
import { gradeLabel } from '@/lib/scoring/aggregate'
import type { Grade } from '@/lib/scoring/types'

const GRADE_COLOR: Record<Grade, string> = {
  S: 'bg-teal-600',
  A: 'bg-blue-600',
  B: 'bg-violet-600',
  C: 'bg-amber-600',
  D: 'bg-red-600',
  E: 'bg-gray-500',
}

export function ScoreBadge({
  score,
  grade,
  size = 'md',
}: {
  score: number
  grade: Grade
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizes = {
    sm: 'size-12 text-base',
    md: 'size-16 text-xl',
    lg: 'size-24 text-3xl',
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          'flex shrink-0 flex-col items-center justify-center rounded-2xl font-bold text-white tabular-nums',
          GRADE_COLOR[grade],
          sizes[size],
        )}
      >
        {Math.round(score)}
        <span className="text-[10px] font-semibold opacity-90">{grade}등급</span>
      </div>
      {size === 'lg' && (
        <span className="text-xs font-medium text-[var(--color-muted)]">
          {gradeLabel(grade)}
        </span>
      )}
    </div>
  )
}

export function ScoreBar({ score, label }: { score: number; label?: string }) {
  const tone =
    score >= 80 ? 'bg-teal-500' : score >= 60 ? 'bg-blue-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-border)]">
        <div
          className={cn('h-full rounded-full transition-[width]', tone)}
          style={{ width: `${Math.max(2, Math.min(100, score))}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-[var(--color-muted)]">
        {label ?? Math.round(score)}
      </span>
    </div>
  )
}
