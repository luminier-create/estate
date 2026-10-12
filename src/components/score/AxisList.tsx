'use client'
/** 축별 점수와 근거를 펼쳐 볼 수 있는 목록. */
import { useState } from 'react'
import { ScoreBar } from './ScoreBadge'
import { Badge } from '@/components/ui'
import { AXIS_LABEL, type AxisResult } from '@/lib/scoring/types'

export function AxisList({ axes }: { axes: AxisResult[] }) {
  const sorted = [...axes].sort((a, b) => b.weight - a.weight)
  return (
    <ul className="divide-y divide-[var(--color-border)]">
      {sorted.map((axis) => (
        <AxisRow key={axis.axis} axis={axis} />
      ))}
    </ul>
  )
}

function AxisRow({ axis }: { axis: AxisResult }) {
  const [open, setOpen] = useState(false)
  const score = axis.score
  const missing = score === null

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-1 py-3.5 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{AXIS_LABEL[axis.axis]}</span>
          <Badge tone="neutral">가중치 {Math.round(axis.weight)}</Badge>
          {missing && <Badge tone="warn">데이터 없음</Badge>}
          <span className="ml-auto text-xs text-[var(--color-muted)]" aria-hidden>
            {open ? '접기' : '펼치기'}
          </span>
        </div>

        {missing ? (
          <p className="mt-1.5 text-xs text-[var(--color-muted)]">{axis.reason}</p>
        ) : (
          <>
            <div className="mt-2">
              <ScoreBar score={score} />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-muted)]">
              {axis.reason}
            </p>
          </>
        )}
      </button>

      {open && (
        <div className="mb-3 rounded-xl bg-[var(--color-bg)] p-3.5">
          {axis.details.length > 0 ? (
            <ul className="space-y-1.5">
              {axis.details.map((d, i) => (
                <li key={i} className="text-xs leading-relaxed text-[var(--color-muted)]">
                  · {d}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[var(--color-muted)]">상세 정보가 없습니다.</p>
          )}
          {axis.sources.length > 0 && (
            <p className="mt-2.5 border-t border-[var(--color-border)] pt-2.5 text-[11px] text-[var(--color-subtle)]">
              출처: {axis.sources.map((s) => s.label).join(' / ')}
            </p>
          )}
        </div>
      )}
    </li>
  )
}
