'use client'

import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button, Card, Field, Input, Select } from '@/components/ui'
import { PlacePicker, type PickedPlace } from '@/components/property/PlacePicker'
import { saveProfileAction } from '@/app/(app)/actions'
import { formatManwon } from '@/lib/scoring/normalize'
import type { StoredProfile } from '@/lib/repo/types'

const HOUSEHOLD_OPTIONS = [
  { value: 'SINGLE', label: '1인 가구' },
  { value: 'COUPLE', label: '부부 (자녀 없음)' },
  { value: 'WITH_PRESCHOOL', label: '미취학 자녀' },
  { value: 'WITH_ELEMENTARY', label: '초등 자녀' },
  { value: 'WITH_SECONDARY', label: '중·고등 자녀' },
  { value: 'NO_CHILDREN', label: '기타 (자녀 없음)' },
] as const

const IMPORTANCE_LABEL = { 1: '보통', 2: '중요', 3: '매우 중요' } as const

interface PlaceRow {
  id: string
  label: string
  address: string
  lat: number
  lng: number
  importance: 1 | 2 | 3
}

export function OnboardingForm({
  profile,
  redirectTo = '/dashboard',
  submitLabel = '등록하고 시작하기',
}: {
  profile: StoredProfile
  redirectTo?: Route
  submitLabel?: string
}) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [targetAmount, setTargetAmount] = useState(profile.budget.targetAmount || 0)
  const [maxAmount, setMaxAmount] = useState<number | null>(profile.budget.maxAmount)

  const [office, setOffice] = useState(profile.office)
  const [officeMinutes, setOfficeMinutes] = useState(profile.office?.targetMinutes ?? 30)
  const [commuteMode, setCommuteMode] = useState<'TRANSIT' | 'CAR'>(
    profile.office?.commuteMode ?? 'TRANSIT',
  )

  const [places, setPlaces] = useState<PlaceRow[]>(
    profile.frequentPlaces.map((p) => ({ ...p })),
  )
  const [household, setHousehold] = useState(profile.household)

  function pickOffice(p: PickedPlace) {
    setOffice({
      label: p.name,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      commuteMode,
      targetMinutes: officeMinutes,
    })
  }

  function addPlace(p: PickedPlace) {
    if (places.length >= 10) return
    setPlaces((prev) => [
      ...prev,
      {
        id: `f_${Date.now().toString(36)}${prev.length}`,
        label: p.name,
        address: p.address,
        lat: p.lat,
        lng: p.lng,
        importance: 2,
      },
    ])
  }

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      await saveProfileAction({
        targetAmount,
        maxAmount,
        office: office
          ? { ...office, commuteMode, targetMinutes: officeMinutes }
          : null,
        frequentPlaces: places,
        household,
        completeOnboarding: true,
      })
      router.replace(redirectTo)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.')
      setSaving(false)
    }
  }

  const steps = ['예산', '사무실', '생활반경'] as const

  return (
    <div className="space-y-5">
      <ol className="flex gap-2">
        {steps.map((s, i) => (
          <li key={s} className="flex-1">
            <div
              className={`h-1 rounded-full ${i <= step ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-border)]'}`}
            />
            <p
              className={`mt-1.5 text-xs ${i === step ? 'font-semibold text-[var(--color-brand)]' : 'text-[var(--color-muted)]'}`}
            >
              {i + 1}. {s}
            </p>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card className="space-y-5">
          <Field
            label="목표 매입 금액"
            htmlFor="target"
            hint={
              targetAmount > 0
                ? `${formatManwon(targetAmount)} — 만원 단위로 입력합니다 (예: 12억 → 120000)`
                : '만원 단위로 입력합니다 (예: 12억 → 120000)'
            }
            required
          >
            <Input
              id="target"
              type="number"
              inputMode="numeric"
              value={targetAmount || ''}
              onChange={(e) => setTargetAmount(Number(e.target.value))}
              placeholder="120000"
            />
          </Field>

          <Field
            label="최대 감당 금액 (선택)"
            htmlFor="max"
            hint={maxAmount ? formatManwon(maxAmount) : '예산 초과 여부 표시에 사용됩니다.'}
          >
            <Input
              id="max"
              type="number"
              inputMode="numeric"
              value={maxAmount ?? ''}
              onChange={(e) =>
                setMaxAmount(e.target.value ? Number(e.target.value) : null)
              }
              placeholder="140000"
            />
          </Field>

          <Field label="가구 구성" htmlFor="household" hint="학군 축의 초·중·고 가중치가 이 값에 따라 조정됩니다.">
            <Select
              id="household"
              value={household.type}
              onChange={(e) =>
                setHousehold((h) => ({
                  ...h,
                  type: e.target.value as typeof h.type,
                }))
              }
            >
              {HOUSEHOLD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-5">
          <Field
            label="사무실 위치"
            htmlFor="office"
            hint="회사명이나 주소로 검색하십시오. 통근 시간 계산의 도착지가 됩니다."
            required
          >
            <PlacePicker
              id="office"
              placeholder="예: 강남역 삼성타운, 판교 테크노밸리"
              value={office?.label}
              onPick={pickOffice}
            />
          </Field>

          {office && (
            <p className="rounded-lg bg-[var(--color-brand-soft)] p-3 text-sm">
              <span className="font-medium">{office.label}</span>
              <br />
              <span className="text-xs text-[var(--color-muted)]">{office.address}</span>
            </p>
          )}

          <Field label="통근 수단" htmlFor="mode">
            <Select
              id="mode"
              value={commuteMode}
              onChange={(e) => setCommuteMode(e.target.value as 'TRANSIT' | 'CAR')}
            >
              <option value="TRANSIT">대중교통</option>
              <option value="CAR">자차</option>
            </Select>
          </Field>

          <Field
            label="목표 통근 시간"
            htmlFor="minutes"
            hint="30분 이내면 만점, 90분 이상이면 최저점입니다. 여기 입력한 값은 근거 문구의 기준선으로 표시됩니다."
          >
            <div className="flex items-center gap-3">
              <input
                id="minutes"
                type="range"
                min={10}
                max={120}
                step={5}
                value={officeMinutes}
                onChange={(e) => setOfficeMinutes(Number(e.target.value))}
                className="h-11 flex-1 accent-[var(--color-brand)]"
              />
              <span className="w-16 text-right text-sm font-semibold tabular-nums">
                {officeMinutes}분
              </span>
            </div>
          </Field>
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-5">
          <Field
            label="자주 가는 장소"
            htmlFor="place"
            hint="최대 10곳. 지하철·버스 접근성 평가에 반영됩니다."
          >
            <PlacePicker
              id="place"
              placeholder="예: 강남역, 잠실 롯데월드몰"
              onPick={addPlace}
            />
          </Field>

          {places.length === 0 ? (
            <p className="rounded-lg bg-[var(--color-bg)] p-3 text-sm text-[var(--color-muted)]">
              등록된 장소가 없습니다. 없어도 분석은 가능하지만, 등록하면 해당
              장소로의 접근성이 점수에 반영됩니다.
            </p>
          ) : (
            <ul className="space-y-2">
              {places.map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] p-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {p.label}
                    </span>
                    <span className="block truncate text-xs text-[var(--color-muted)]">
                      {p.address}
                    </span>
                  </span>
                  <Select
                    aria-label={`${p.label} 중요도`}
                    value={p.importance}
                    onChange={(e) =>
                      setPlaces((prev) =>
                        prev.map((q, j) =>
                          j === i
                            ? { ...q, importance: Number(e.target.value) as 1 | 2 | 3 }
                            : q,
                        ),
                      )
                    }
                    className="w-28 shrink-0"
                  >
                    {[1, 2, 3].map((v) => (
                      <option key={v} value={v}>
                        {IMPORTANCE_LABEL[v as 1 | 2 | 3]}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    onClick={() => setPlaces((prev) => prev.filter((_, j) => j !== i))}
                    className="min-h-11 shrink-0 px-2 text-sm text-[var(--color-negative)]"
                    aria-label={`${p.label} 삭제`}
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <div className="flex gap-3">
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)} className="flex-1">
            이전
          </Button>
        )}
        {step < 2 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 0 && targetAmount <= 0}
            className="flex-1"
          >
            다음
          </Button>
        ) : (
          <Button onClick={submit} disabled={saving} className="flex-1">
            {saving ? '저장 중…' : submitLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
