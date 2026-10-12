import { cn } from '@/lib/utils'
import { gradeLabel } from '@/lib/scoring/aggregate'
import type { Grade } from '@/lib/scoring/types'

/**
 * 흰 텍스트를 얹으므로 700 계열로 통일한다.
 * 600 계열은 teal 3.74:1, amber 3.18:1 로 WCAG AA(4.5:1)에 미달했다.
 */
const GRADE_COLOR: Record<Grade, string> = {
  S: 'bg-teal-700',
  A: 'bg-blue-700',
  B: 'bg-violet-700',
  C: 'bg-amber-700',
  D: 'bg-red-700',
  E: 'bg-gray-600',
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
    sm: 'size-12 text-sm',
    md: 'size-16 text-lg',
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
        {formatScore(score)}
        <span className="text-[10px] font-semibold">{grade}등급</span>
      </div>
      {size === 'lg' && (
        <span className="text-xs font-medium text-[var(--color-muted)]">
          {gradeLabel(grade)}
        </span>
      )}
    </div>
  )
}

/**
 * 등급 임계값이 소수 1자리 점수 위에 걸려 있으므로, 등급과 같이 보여주는 숫자를
 * 정수로 뭉개면 안 된다 — 84.9(A)와 85.0(S)이 둘 다 "85"로 떠서 같은 숫자에 다른
 * 등급이 붙는다. 소수점이 의미 없을 때만 떼어 자릿수를 아낀다.
 */
function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
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
