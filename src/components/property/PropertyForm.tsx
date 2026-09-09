'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button, Card, Field, Input, Select } from '@/components/ui'
import { PlacePicker, type PickedPlace } from '@/components/property/PlacePicker'
import { savePropertyAction } from '@/app/(app)/actions'
import { formatManwon, m2ToPyeong, pyeongToM2 } from '@/lib/scoring/normalize'
import { FACILITY_LABEL } from '@/lib/scoring/axes/amenity'
import { RISK_SPEC } from '@/lib/scoring/axes/risk'
import type { CommunityFacility, RiskCode } from '@/lib/scoring/types'
import type { StoredProperty } from '@/lib/repo/types'

const FACILITIES = Object.keys(FACILITY_LABEL) as CommunityFacility[]
/** 사용자가 직접 체크하는 리스크만 노출한다. 자동 판정 항목은 분석이 처리한다. */
const USER_RISKS: RiskCode[] = [
  'NOISE_FLOOR',
  'NOISE_ROAD',
  'NOISE_AIRCRAFT',
  'STEEP_SLOPE',
  'NIGHTLIFE',
  'SUNLIGHT_BLOCKED',
  'COMMUNITY_OTHER',
]

export function PropertyForm({
  defaultUnit,
  initial,
}: {
  defaultUnit: 'PYEONG' | 'M2'
  initial?: StoredProperty
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [advanced, setAdvanced] = useState(false)

  const [name, setName] = useState(initial?.name ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initial ? { lat: initial.lat, lng: initial.lng } : null,
  )
  const [unit, setUnit] = useState<'PYEONG' | 'M2'>(initial?.inputUnit ?? defaultUnit)
  const [areaValue, setAreaValue] = useState<number>(
    initial
      ? initial.inputUnit === 'PYEONG'
        ? Math.round(m2ToPyeong(initial.exclusiveM2) * 10) / 10
        : initial.exclusiveM2
      : 0,
  )
  const [price, setPrice] = useState(initial?.priceManwon ?? 0)
  const [priceType, setPriceType] = useState<'ASKING' | 'TARGET'>(
    initial?.priceType ?? 'ASKING',
  )

  const [buildYear, setBuildYear] = useState<number | null>(initial?.buildYear ?? null)
  const [households, setHouseholds] = useState<number | null>(
    initial?.totalHouseholds ?? null,
  )
  const [parking, setParking] = useState<number | null>(
    initial?.parkingPerHousehold ?? null,
  )
  const [fee, setFee] = useState<number | null>(initial?.monthlyFeePerM2 ?? null)
  const [structure, setStructure] = useState<'WALL' | 'RAHMEN' | null>(
    initial?.structureType ?? null,
  )
  const [facilities, setFacilities] = useState<CommunityFacility[]>(
    initial?.communityFacilities ?? [],
  )
  const [risks, setRisks] = useState<RiskCode[]>(initial?.userRisks ?? [])
  const [memo, setMemo] = useState(initial?.memo ?? '')

  function pickAddress(p: PickedPlace) {
    setAddress(p.address)
    setCoords({ lat: p.lat, lng: p.lng })
    if (!name) setName(p.name)
  }

  const exclusiveM2 = unit === 'PYEONG' ? pyeongToM2(areaValue) : areaValue
  const perPyeong = areaValue > 0 && price > 0 ? price / m2ToPyeong(exclusiveM2) : 0

  async function submit() {
    setError(null)
    if (!name.trim()) return setError('단지명을 입력하십시오.')
    if (!address.trim()) return setError('주소를 검색해 선택하십시오.')
    if (areaValue <= 0) return setError('전용면적을 입력하십시오.')
    if (price <= 0) return setError('금액을 입력하십시오.')

    setSaving(true)
    try {
      const res = await savePropertyAction({
        id: initial?.id,
        name: name.trim(),
        address: address.trim(),
        lat: coords?.lat,
        lng: coords?.lng,
        areaValue,
        inputUnit: unit,
        priceManwon: price,
        priceType,
        buildYear,
        totalHouseholds: households,
        parkingPerHousehold: parking,
        monthlyFeePerM2: fee,
        communityFacilities: facilities,
        structureType: structure,
        userRisks: risks,
        memo: memo.trim() || null,
      })
      if (!res.ok) {
        setError(res.error)
        setSaving(false)
        return
      }
      router.replace(`/properties/${res.id}`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.')
      setSaving(false)
    }
  }

  function toggle<T>(list: T[], value: T, set: (v: T[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-5">
        <Field label="주소 검색" htmlFor="addr" required
          hint="검색 결과를 선택하면 좌표와 법정동코드가 자동으로 채워집니다.">
          <PlacePicker
            id="addr"
            placeholder="예: 래미안 도곡카운티, 서울 강남구 도곡동"
            value={initial?.address}
            onPick={pickAddress}
          />
        </Field>

        {address && (
          <p className="rounded-lg bg-[var(--color-brand-soft)] p-3 text-xs text-[var(--color-muted)]">
            선택된 주소: {address}
          </p>
        )}

        <Field label="단지명" htmlFor="name" required>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="래미안 도곡카운티"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <Field
            label="전용면적"
            htmlFor="area"
            required
            hint={
              areaValue > 0
                ? unit === 'PYEONG'
                  ? `${exclusiveM2.toFixed(1)}㎡`
                  : `${m2ToPyeong(exclusiveM2).toFixed(1)}평`
                : '공급면적이 아닌 전용면적을 입력하십시오.'
            }
          >
            <Input
              id="area"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={areaValue || ''}
              onChange={(e) => setAreaValue(Number(e.target.value))}
              placeholder={unit === 'PYEONG' ? '25.7' : '84.9'}
            />
          </Field>
          <Field label="단위" htmlFor="unit">
            <Select
              id="unit"
              value={unit}
              onChange={(e) => {
                const next = e.target.value as 'PYEONG' | 'M2'
                // 단위를 바꾸면 입력값도 함께 환산해 사용자가 다시 계산하지 않게 한다
                if (areaValue > 0) {
                  setAreaValue(
                    next === 'M2'
                      ? Math.round(pyeongToM2(areaValue) * 10) / 10
                      : Math.round(m2ToPyeong(areaValue) * 10) / 10,
                  )
                }
                setUnit(next)
              }}
            >
              <option value="PYEONG">평</option>
              <option value="M2">㎡</option>
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Field
            label="금액 (만원)"
            htmlFor="price"
            required
            hint={
              price > 0
                ? `${formatManwon(price)}${perPyeong > 0 ? ` · 평당 ${Math.round(perPyeong).toLocaleString('ko-KR')}만원` : ''}`
                : '예: 18억 → 180000'
            }
          >
            <Input
              id="price"
              type="number"
              inputMode="numeric"
              value={price || ''}
              onChange={(e) => setPrice(Number(e.target.value))}
              placeholder="180000"
            />
          </Field>
          <Field label="금액 종류" htmlFor="ptype">
            <Select
              id="ptype"
              value={priceType}
              onChange={(e) => setPriceType(e.target.value as 'ASKING' | 'TARGET')}
            >
              <option value="ASKING">호가</option>
              <option value="TARGET">내 목표가</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          aria-expanded={advanced}
          className="flex min-h-11 w-full items-center justify-between text-left"
        >
          <span>
            <span className="block text-sm font-semibold">추가 정보 (선택)</span>
            <span className="block text-xs text-[var(--color-muted)]">
              연식·세대수·관리비·커뮤니티·리스크 — 입력하면 평가 축이 늘어납니다
            </span>
          </span>
          <span className="text-sm text-[var(--color-muted)]">{advanced ? '접기' : '펼치기'}</span>
        </button>

        {advanced && (
          <div className="mt-5 space-y-5 border-t border-[var(--color-border)] pt-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="건축년도" htmlFor="by" hint="비우면 실거래 데이터에서 자동 추정합니다.">
                <Input
                  id="by" type="number" inputMode="numeric"
                  value={buildYear ?? ''}
                  onChange={(e) => setBuildYear(e.target.value ? Number(e.target.value) : null)}
                  placeholder="2005"
                />
              </Field>
              <Field label="총 세대수" htmlFor="hh">
                <Input
                  id="hh" type="number" inputMode="numeric"
                  value={households ?? ''}
                  onChange={(e) => setHouseholds(e.target.value ? Number(e.target.value) : null)}
                  placeholder="1200"
                />
              </Field>
              <Field label="세대당 주차대수" htmlFor="pk" hint="1.0대 미만이면 리스크로 자동 감점됩니다.">
                <Input
                  id="pk" type="number" inputMode="decimal" step="0.01"
                  value={parking ?? ''}
                  onChange={(e) => setParking(e.target.value ? Number(e.target.value) : null)}
                  placeholder="1.35"
                />
              </Field>
              <Field label="㎡당 월 관리비 (원)" htmlFor="fee" hint="관리비 고지서의 공용관리비 ÷ 전용면적">
                <Input
                  id="fee" type="number" inputMode="numeric"
                  value={fee ?? ''}
                  onChange={(e) => setFee(e.target.value ? Number(e.target.value) : null)}
                  placeholder="2300"
                />
              </Field>
            </div>

            <Field label="구조 형식" htmlFor="st" hint="벽식구조는 층간소음 전달이 상대적으로 큽니다.">
              <Select
                id="st"
                value={structure ?? ''}
                onChange={(e) =>
                  setStructure((e.target.value || null) as 'WALL' | 'RAHMEN' | null)
                }
              >
                <option value="">모름</option>
                <option value="WALL">벽식구조</option>
                <option value="RAHMEN">라멘(기둥식)구조</option>
              </Select>
            </Field>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">커뮤니티 시설</legend>
              <div className="flex flex-wrap gap-2">
                {FACILITIES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={facilities.includes(f)}
                    onClick={() => toggle(facilities, f, setFacilities)}
                    className={`min-h-11 rounded-full border px-3.5 text-sm transition-colors ${
                      facilities.includes(f)
                        ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] font-medium text-[var(--color-brand)]'
                        : 'border-[var(--color-border)] text-[var(--color-muted)]'
                    }`}
                  >
                    {FACILITY_LABEL[f]}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-1 text-sm font-medium">직접 확인한 문제점</legend>
              <p className="mb-2 text-xs text-[var(--color-muted)]">
                커뮤니티·임장에서 확인한 항목만 체크하십시오. 총 감점은 15점을 넘지 않습니다.
              </p>
              <div className="flex flex-wrap gap-2">
                {USER_RISKS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={risks.includes(r)}
                    onClick={() => toggle(risks, r, setRisks)}
                    className={`min-h-11 rounded-full border px-3.5 text-sm transition-colors ${
                      risks.includes(r)
                        ? 'border-[var(--color-negative)] bg-red-50 font-medium text-[var(--color-negative)]'
                        : 'border-[var(--color-border)] text-[var(--color-muted)]'
                    }`}
                  >
                    {RISK_SPEC[r].label} −{RISK_SPEC[r].penalty}
                  </button>
                ))}
              </div>
            </fieldset>

            <Field label="메모" htmlFor="memo">
              <textarea
                id="memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 text-base outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20"
                placeholder="임장 메모, 매물 특징 등"
              />
            </Field>
          </div>
        )}
      </Card>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <Button onClick={submit} disabled={saving} className="w-full">
        {saving ? '분석 중… (최대 10초)' : initial ? '수정하고 재분석' : '등록하고 분석하기'}
      </Button>
    </div>
  )
}
