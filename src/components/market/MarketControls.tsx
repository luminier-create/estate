'use client'
/**
 * 지역·지표·기간 선택. 선택은 URL 쿼리에 남긴다 —
 * 새로고침·뒤로가기·링크 공유가 그대로 동작하고, 서버가 캐시된 값을 다시 준다.
 */
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Field, Select } from '@/components/ui'
import {
  MARKET_INDICATOR_LABEL,
  type MarketIndicator,
} from '@/lib/providers/types'

const MONTH_OPTIONS = [12, 24, 36, 60] as const

export function MarketControls({
  regions,
  indicators,
  regionCode,
  indicator,
  months,
}: {
  regions: { code: string; name: string }[]
  indicators: readonly MarketIndicator[]
  regionCode: string
  indicator: MarketIndicator
  months: number
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    next.set(key, value)
    startTransition(() => router.replace(`/market?${next.toString()}`))
  }

  return (
    <div
      className="grid gap-3 sm:grid-cols-3"
      aria-busy={pending}
      data-pending={pending ? '' : undefined}
    >
      <Field label="지역" htmlFor="region">
        <Select
          id="region"
          value={regionCode}
          onChange={(e) => update('region', e.target.value)}
        >
          {regions.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="지표" htmlFor="indicator">
        <Select
          id="indicator"
          value={indicator}
          onChange={(e) => update('indicator', e.target.value)}
        >
          {indicators.map((id) => (
            <option key={id} value={id}>
              {MARKET_INDICATOR_LABEL[id]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="기간" htmlFor="months">
        <Select
          id="months"
          value={String(months)}
          onChange={(e) => update('months', e.target.value)}
        >
          {MONTH_OPTIONS.map((m) => (
            <option key={m} value={m}>
              최근 {m}개월
            </option>
          ))}
        </Select>
      </Field>
    </div>
  )
}
