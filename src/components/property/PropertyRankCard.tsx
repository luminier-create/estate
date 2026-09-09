import Link from 'next/link'
import { Badge, Card } from '@/components/ui'
import { ScoreBadge, ScoreBar } from '@/components/score/ScoreBadge'
import { CONFIDENCE_TEXT } from '@/lib/scoring/aggregate'
import { formatManwon, m2ToPyeong } from '@/lib/scoring/normalize'
import { AXIS_LABEL_SHORT, type AxisResult } from '@/lib/scoring/types'
import type { StoredAnalysis, StoredProperty } from '@/lib/repo/types'

function topAndBottom(axes: AxisResult[]) {
  const valid = axes.filter(
    (a): a is AxisResult & { score: number } => a.score !== null,
  )
  if (valid.length === 0) return { best: null, worst: null }
  const sorted = [...valid].sort((a, b) => b.score - a.score)
  return { best: sorted[0] ?? null, worst: sorted[sorted.length - 1] ?? null }
}

export function PropertyRankCard({
  rank,
  property,
  analysis,
  areaUnit,
}: {
  rank: number
  property: StoredProperty
  analysis: StoredAnalysis | null
  areaUnit: 'PYEONG' | 'M2'
}) {
  const areaText =
    areaUnit === 'PYEONG'
      ? `${m2ToPyeong(property.exclusiveM2).toFixed(1)}평`
      : `${property.exclusiveM2}㎡`
  const { best, worst } = analysis ? topAndBottom(analysis.axes) : { best: null, worst: null }

  return (
    <Link href={`/properties/${property.id}`} className="block">
      <Card className="transition-colors hover:border-[var(--color-brand)]">
        <div className="flex gap-4">
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-xs font-bold text-[var(--color-muted)]">
              {rank}위
            </span>
            {analysis ? (
              <ScoreBadge score={analysis.totalScore} grade={analysis.grade} />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-2xl bg-[var(--color-bg)] text-[11px] text-[var(--color-muted)]">
                분석 전
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">{property.name}</h2>
            <p className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
              {property.address}
            </p>
            <p className="mt-1.5 text-sm font-medium tabular-nums">
              {formatManwon(property.priceManwon)}
              <span className="ml-2 font-normal text-[var(--color-muted)]">
                전용 {areaText}
              </span>
            </p>

            {analysis && (
              <>
                <div className="mt-3 space-y-1.5">
                  {best && (
                    <div className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-xs text-[var(--color-muted)]">
                        {AXIS_LABEL_SHORT[best.axis]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <ScoreBar score={best.score} />
                      </div>
                    </div>
                  )}
                  {worst && worst.axis !== best?.axis && (
                    <div className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-xs text-[var(--color-muted)]">
                        {AXIS_LABEL_SHORT[worst.axis]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <ScoreBar score={worst.score} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <Badge tone={analysis.confidence >= 0.9 ? 'positive' : 'warn'}>
                    신뢰도 {CONFIDENCE_TEXT[analysis.confidenceLabel]}
                  </Badge>
                  {analysis.riskPenalty > 0 && (
                    <Badge tone="negative">리스크 −{analysis.riskPenalty}</Badge>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </Card>
    </Link>
  )
}
