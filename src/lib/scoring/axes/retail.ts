/**
 * RETAIL — 대형마트 접근성 (w=5)
 * 도보 접근과 차량 접근 중 유리한 쪽을 채택한다(차량은 0.85 계수).
 * 설계 근거: docs/01-ALGORITHM.md §5.6
 */
import { formatDistance, piecewise, walkMinutes } from '../normalize'
import type { AxisResult } from '../types'
import { countWithin, missing, nearest, ok, type AxisContext } from './shared'

const WALK_CURVE = [
  [5, 100],
  [10, 85],
  [15, 65],
  [20, 40],
  [30, 10],
  [40, 0],
] as const

/** 차량 접근 — 입력은 km */
const DRIVE_CURVE = [
  [1, 100],
  [2, 90],
  [3, 75],
  [5, 55],
  [8, 25],
  [12, 0],
] as const

const DRIVE_DISCOUNT = 0.85
const MULTI_MART_RADIUS_M = 1500
const WAREHOUSE_PATTERN = /코스트코|트레이더스|이마트\s?트레이더스|빅마켓/

export function scoreRetail(ctx: AxisContext): AxisResult {
  const weight = ctx.weights.RETAIL
  const marts = ctx.observations.marts

  if (!marts) {
    return missing('RETAIL', weight, '주변 대형마트 정보를 조회하지 못했습니다.')
  }

  const near = nearest(marts)
  if (!near) {
    return ok({
      axis: 'RETAIL',
      weight,
      score: 0,
      raw: { nearestMart: null },
      reason: '반경 내 대형마트 없음',
      details: ['조회 반경(3km) 내 대형마트가 없습니다.'],
      sources: [{ label: '카카오 로컬 (대형마트 MT1)', asOf: '' }],
    })
  }

  const walkMin = walkMinutes(near.distanceM)
  const walkScore = piecewise(walkMin, WALK_CURVE)
  const driveScore = piecewise(near.distanceM / 1000, DRIVE_CURVE) * DRIVE_DISCOUNT

  let score = Math.max(walkScore, driveScore)
  const details: string[] = [
    `${near.name} — 직선 ${formatDistance(near.distanceM)} · 도보 약 ${Math.round(walkMin)}분`,
    `도보 기준 ${Math.round(walkScore)}점 / 차량 기준 ${Math.round(driveScore)}점 — 유리한 쪽 채택`,
  ]

  const martCount = countWithin(marts, MULTI_MART_RADIUS_M)
  if (martCount >= 2) {
    score = Math.min(100, score + 5)
    details.push(`반경 1.5km 내 대형마트 ${martCount}개 — 5점 가산`)
  }
  const warehouse = marts.find((m) => WAREHOUSE_PATTERN.test(m.name))
  if (warehouse) {
    score = Math.min(100, score + 5)
    details.push(`창고형 매장(${warehouse.name}) 인접 — 5점 가산`)
  }

  return ok({
    axis: 'RETAIL',
    weight,
    score,
    raw: {
      nearestMart: near.name,
      distanceM: Math.round(near.distanceM),
      walkMinutes: Math.round(walkMin * 10) / 10,
      walkScore,
      driveScore,
      martCount,
    },
    reason: `${near.name} 도보 ${Math.round(walkMin)}분 (${formatDistance(near.distanceM)})`,
    details,
    sources: [{ label: '카카오 로컬 (대형마트 MT1)', asOf: '' }],
  })
}
