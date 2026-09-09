/**
 * SCHOOL — 학군 접근성 (w=12)
 * 가구 구성에 따라 초·중·고 하위 가중치를 동적 조정한다.
 * 설계 근거: docs/01-ALGORITHM.md §5.5
 */
import { piecewise, walkMinutes } from '../normalize'
import type { AxisResult, PlaceHit } from '../types'
import { schoolSubWeights } from '../presets'
import { blend, missing, nearest, ok, type AxisContext } from './shared'

/** 초등학교 — 도보 안전 최우선, 임계 가장 엄격 */
const ELEMENTARY_CURVE = [
  [3, 100],
  [5, 95],
  [8, 75],
  [10, 60],
  [15, 30],
  [20, 5],
  [25, 0],
] as const

const MIDDLE_CURVE = [
  [5, 100],
  [10, 85],
  [15, 65],
  [20, 40],
  [30, 10],
  [40, 0],
] as const

/** 고등학교 — 대중교통 통학 허용, 가장 완만 */
const HIGH_CURVE = [
  [5, 100],
  [10, 90],
  [15, 75],
  [20, 55],
  [30, 25],
  [45, 0],
] as const

function evaluate(
  schools: PlaceHit[] | null,
  curve: readonly (readonly [number, number])[],
): { score: number | null; place: PlaceHit | null; walkMin: number } {
  const near = nearest(schools)
  if (!near) return { score: null, place: null, walkMin: 0 }
  const walkMin = walkMinutes(near.distanceM)
  return { score: piecewise(walkMin, curve), place: near, walkMin }
}

export function scoreSchool(ctx: AxisContext): AxisResult {
  const weight = ctx.weights.SCHOOL
  const obs = ctx.observations
  const sub = schoolSubWeights(ctx.user.household.type)

  const elem = evaluate(obs.elementarySchools, ELEMENTARY_CURVE)
  const mid = evaluate(obs.middleSchools, MIDDLE_CURVE)
  const high = evaluate(obs.highSchools, HIGH_CURVE)

  const score = blend([
    { weight: sub.elementary, score: elem.score },
    { weight: sub.middle, score: mid.score },
    { weight: sub.high, score: high.score },
  ])

  if (score === null) {
    return missing('SCHOOL', weight, '주변 학교 정보를 조회하지 못했습니다.')
  }

  const details: string[] = []
  const parts: string[] = []
  for (const [label, r] of [
    ['초등학교', elem],
    ['중학교', mid],
    ['고등학교', high],
  ] as const) {
    if (r.place) {
      details.push(
        `${label} — ${r.place.name} 도보 ${Math.round(r.walkMin)}분 (${Math.round(r.place.distanceM)}m)`,
      )
      parts.push(`${r.place.name} ${Math.round(r.walkMin)}분`)
    } else {
      details.push(`${label} — 반경 내 없음 (해당 항목 제외)`)
    }
  }
  details.push(
    `가구 구성(${ctx.user.household.type}) 반영 가중치 — 초 ${sub.elementary} / 중 ${sub.middle} / 고 ${sub.high}`,
  )

  return ok({
    axis: 'SCHOOL',
    weight,
    score,
    raw: {
      elementary: { name: elem.place?.name ?? null, walkMinutes: Math.round(elem.walkMin * 10) / 10, score: elem.score },
      middle: { name: mid.place?.name ?? null, walkMinutes: Math.round(mid.walkMin * 10) / 10, score: mid.score },
      high: { name: high.place?.name ?? null, walkMinutes: Math.round(high.walkMin * 10) / 10, score: high.score },
      subWeights: sub,
    },
    reason: parts.length > 0 ? parts.join(' · ') : '주변 학교 없음',
    details,
    sources: [{ label: '카카오 로컬 (학교 SC4)', asOf: '' }],
  })
}
