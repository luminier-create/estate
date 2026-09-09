'use client'
/** 축별 비교표 + 가중치 슬라이더. 슬라이더 조작 시 클라이언트에서 즉시 재집계한다. */
import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Badge, Button, Card } from '@/components/ui'
import { ScoreBadge } from './ScoreBadge'
import { recomputeWithWeights } from '@/lib/scoring/aggregate'
import { formatManwon, m2ToPyeong } from '@/lib/scoring/normalize'
import { PRESETS, normalizeWeights } from '@/lib/scoring/presets'
import { saveWeightsAction } from '@/app/(app)/actions'
import {
  AXIS_CODES,
  AXIS_LABEL,
  AXIS_LABEL_SHORT,
  type AxisCode,
  type AxisResult,
  type Weights,
} from '@/lib/scoring/types'

export interface CompareRow {
  id: string
  name: string
  priceManwon: number
  exclusiveM2: number
  axes: AxisResult[]
  riskPenalty: number
}

export function CompareTable({
  rows,
  initialWeights,
  initialPresetId,
  areaUnit,
}: {
  rows: CompareRow[]
  initialWeights: Weights
  initialPresetId: string
  areaUnit: 'PYEONG' | 'M2'
}) {
  const [weights, setWeights] = useState<Weights>(initialWeights)
  const [presetId, setPresetId] = useState(initialPresetId)
  const [saving, startSaving] = useTransition()
  const [saved, setSaved] = useState(false)

  const ranked = useMemo(() => {
    return rows
      .map((row) => ({
        row,
        result: recomputeWithWeights(row.axes, weights, row.riskPenalty),
      }))
      .sort((a, b) => b.result.totalScore - a.result.totalScore)
  }, [rows, weights])

  const weightSum = AXIS_CODES.reduce((s, c) => s + weights[c], 0)

  function applyPreset(id: string) {
    const preset = PRESETS.find((p) => p.id === id)
    if (!preset) return
    setPresetId(id)
    setWeights(preset.weights)
    setSaved(false)
  }

  function setWeight(axis: AxisCode, value: number) {
    setPresetId('custom')
    setWeights((w) => ({ ...w, [axis]: value }))
    setSaved(false)
  }

  function persist() {
    startSaving(async () => {
      await saveWeightsAction({
        presetId,
        custom: presetId === 'custom' ? normalizeWeights(weights) : undefined,
      })
      setSaved(true)
    })
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">기준</span>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              aria-pressed={presetId === p.id}
              className={`min-h-11 rounded-full border px-3.5 text-sm transition-colors ${
                presetId === p.id
                  ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] font-medium text-[var(--color-brand)]'
                  : 'border-[var(--color-border)] text-[var(--color-muted)]'
              }`}
            >
              {p.label}
            </button>
          ))}
          {presetId === 'custom' && <Badge tone="brand">사용자 설정</Badge>}
        </div>

        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-medium">
            가중치 직접 조절
            <span className="text-xs text-[var(--color-muted)]">
              합계 {Math.round(weightSum)} (100으로 자동 환산)
            </span>
          </summary>
          <div className="mt-3 space-y-2.5">
            {AXIS_CODES.map((axis) => (
              <div key={axis} className="flex items-center gap-3">
                <label
                  htmlFor={`w-${axis}`}
                  className="w-20 shrink-0 text-xs text-[var(--color-muted)]"
                >
                  {AXIS_LABEL[axis]}
                </label>
                <input
                  id={`w-${axis}`}
                  type="range"
                  min={0}
                  max={40}
                  step={1}
                  value={Math.round(weights[axis])}
                  onChange={(e) => setWeight(axis, Number(e.target.value))}
                  className="h-11 flex-1 accent-[var(--color-brand)]"
                />
                <span className="w-7 shrink-0 text-right text-xs font-semibold tabular-nums">
                  {Math.round(weights[axis])}
                </span>
              </div>
            ))}
          </div>
        </details>

        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={persist} disabled={saving}>
            {saving ? '저장 중…' : '이 기준을 내 기본값으로 저장'}
          </Button>
          {saved && (
            <span className="text-xs text-[var(--color-positive)]">
              저장되었습니다. 전체 단지를 재분석했습니다.
            </span>
          )}
        </div>
      </Card>

      {/* 순위 카드 — 모바일 우선 */}
      <ul className="space-y-3">
        {ranked.map(({ row, result }, i) => (
          <li key={row.id}>
            <Link href={`/properties/${row.id}`}>
              <Card className="flex items-center gap-4 transition-colors hover:border-[var(--color-brand)]">
                <span className="w-6 text-center text-sm font-bold text-[var(--color-muted)]">
                  {i + 1}
                </span>
                <ScoreBadge score={result.totalScore} grade={result.grade} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {row.name}
                  </span>
                  <span className="block text-xs text-[var(--color-muted)] tabular-nums">
                    {formatManwon(row.priceManwon)} ·{' '}
                    {areaUnit === 'PYEONG'
                      ? `${m2ToPyeong(row.exclusiveM2).toFixed(1)}평`
                      : `${row.exclusiveM2}㎡`}
                    {row.riskPenalty > 0 && ` · 리스크 −${row.riskPenalty}`}
                  </span>
                </span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      {/* 축별 상세 비교표 — 좁은 화면에서는 가로 스크롤 */}
      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="sticky left-0 bg-[var(--color-surface)] p-3 text-left text-xs font-semibold text-[var(--color-muted)]">
                  축
                </th>
                {ranked.map(({ row }) => (
                  <th
                    key={row.id}
                    className="max-w-28 truncate p-3 text-center text-xs font-semibold"
                  >
                    {row.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AXIS_CODES.map((axis) => {
                const scores = ranked.map(
                  ({ row }) => row.axes.find((a) => a.axis === axis)?.score ?? null,
                )
                const valid = scores.filter((s): s is number => s !== null)
                const best = valid.length > 0 ? Math.max(...valid) : null

                return (
                  <tr key={axis} className="border-b border-[var(--color-border)]">
                    <th className="sticky left-0 bg-[var(--color-surface)] p-3 text-left text-xs font-normal text-[var(--color-muted)]">
                      <span className="hidden sm:inline">{AXIS_LABEL[axis]}</span>
                      <span className="sm:hidden">{AXIS_LABEL_SHORT[axis]}</span>
                      <span className="ml-1.5 text-[10px] text-[var(--color-subtle)]">
                        {Math.round(weights[axis])}
                      </span>
                    </th>
                    {scores.map((s, i) => (
                      <td
                        key={ranked[i]!.row.id}
                        className={`p-3 text-center tabular-nums ${
                          s !== null && s === best
                            ? 'font-bold text-[var(--color-brand)]'
                            : 'text-[var(--color-fg)]'
                        }`}
                      >
                        {s === null ? (
                          <span className="text-xs text-[var(--color-subtle)]">—</span>
                        ) : (
                          Math.round(s)
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
              <tr className="bg-[var(--color-bg)]">
                <th className="sticky left-0 bg-[var(--color-bg)] p-3 text-left text-xs font-semibold">
                  총점
                </th>
                {ranked.map(({ row, result }) => (
                  <td key={row.id} className="p-3 text-center font-bold tabular-nums">
                    {result.totalScore}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <p className="px-1 text-xs text-[var(--color-muted)]">
        표의 강조 표시는 각 축에서 가장 높은 점수입니다. — 표시는 해당 단지에서 그 축의
        데이터를 얻지 못했음을 뜻하며, 그 단지의 총점 계산에서는 해당 축의 가중치가
        제외되고 나머지가 재정규화됩니다.
      </p>
    </div>
  )
}
