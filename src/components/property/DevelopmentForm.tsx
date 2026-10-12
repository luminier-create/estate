'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button, Field, Input, Select } from '@/components/ui'
import { addDevelopmentAction } from '@/app/(app)/actions'
import {
  DEVELOPMENT_POINTS,
  STAGE_FACTOR,
  STAGE_LABEL,
} from '@/lib/scoring/axes/development'
import type { DevelopmentStage, DevelopmentType } from '@/lib/scoring/types'

const TYPES = Object.keys(DEVELOPMENT_POINTS) as DevelopmentType[]
const STAGES = Object.keys(STAGE_LABEL) as DevelopmentStage[]

export function DevelopmentForm({ propertyId }: { propertyId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [type, setType] = useState<DevelopmentType>('GTX_NEW_STATION')
  const [stage, setStage] = useState<DevelopmentStage>('PLANNED')
  const [sourceUrl, setSourceUrl] = useState('')
  const [distanceM, setDistanceM] = useState<number | null>(null)

  const spec = DEVELOPMENT_POINTS[type]
  const expected = Math.round(
    spec.points * (type === 'AVOIDED_FACILITY' ? 1 : STAGE_FACTOR[stage]),
  )

  async function submit() {
    setError(null)
    if (!title.trim()) return setError('호재명을 입력하십시오.')
    setBusy(true)
    try {
      const res = await addDevelopmentAction({
        propertyId,
        title: title.trim(),
        type,
        stage,
        sourceUrl: sourceUrl.trim(),
        distanceM: distanceM ?? undefined,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setTitle('')
      setSourceUrl('')
      setDistanceM(null)
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        호재·악재 추가
      </Button>
    )
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--color-border)] p-4">
      <Field label="호재·악재명" htmlFor="devtitle" required>
        <Input
          id="devtitle"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: GTX-C 노선 신설역"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="유형" htmlFor="devtype" hint={`영향 반경 ${spec.radiusM === 0 ? '해당 단지' : `${spec.radiusM}m`}`}>
          <Select
            id="devtype"
            value={type}
            onChange={(e) => setType(e.target.value as DevelopmentType)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {DEVELOPMENT_POINTS[t].label} ({DEVELOPMENT_POINTS[t].points >= 0 ? '+' : ''}
                {DEVELOPMENT_POINTS[t].points})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="확실성 단계" htmlFor="devstage" hint={`반영 계수 ${STAGE_FACTOR[stage]}`}>
          <Select
            id="devstage"
            value={stage}
            onChange={(e) => setStage(e.target.value as DevelopmentStage)}
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="단지로부터 거리 (m)" htmlFor="devdist" hint="비우면 관련 있는 것으로 처리합니다.">
          <Input
            id="devdist"
            type="number"
            inputMode="numeric"
            value={distanceM ?? ''}
            onChange={(e) => setDistanceM(e.target.value ? Number(e.target.value) : null)}
            placeholder="800"
          />
        </Field>

        <Field label="출처 URL" htmlFor="devsrc" hint="보도자료·고시 링크. 없으면 신뢰도가 낮게 표기됩니다.">
          <Input
            id="devsrc"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://"
          />
        </Field>
      </div>

      <p className="rounded-lg bg-[var(--color-bg)] p-3 text-xs text-[var(--color-muted)]">
        예상 반영 점수: {expected >= 0 ? '+' : ''}
        {expected}점 (호재 축 100점 만점 기준)
      </p>

      {error && <p className="text-sm text-[var(--color-negative)]">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={submit} disabled={busy} className="flex-1">
          {busy ? '등록 중…' : '등록하고 재분석'}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          취소
        </Button>
      </div>
    </div>
  )
}
