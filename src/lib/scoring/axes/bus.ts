/**
 * BUS — 버스 접근성 (w=8)
 * = 0.40 × 정류장근접성 + 0.35 × 사무실버스직결성 + 0.25 × 자주가는장소버스직결성
 * 설계 근거: docs/01-ALGORITHM.md §5.4
 */
import { formatDistance, piecewise, walkMinutes } from '../normalize'
import type { AxisResult } from '../types'
import {
  blend,
  countWithin,
  importanceWeightedAverage,
  missing,
  nearest,
  ok,
  transferScore,
  BUS_TRANSFER_TABLE,
  type AxisContext,
} from './shared'

const PROXIMITY_CURVE = [
  [2, 100],
  [4, 90],
  [6, 75],
  [10, 50],
  [15, 20],
  [20, 0],
] as const

const MULTI_STOP_RADIUS_M = 500

/** 광역/M버스 판별 — 노선명에 포함되면 광역 정차로 본다. */
const WIDE_AREA_PATTERN = /광역|M\d{4}|직행/

export function scoreBus(ctx: AxisContext): AxisResult {
  const weight = ctx.weights.BUS
  const stops = ctx.observations.busStops

  if (!stops) {
    return missing('BUS', weight, '주변 버스정류장 정보를 조회하지 못했습니다.')
  }

  const details: string[] = []
  const near = nearest(stops)

  // (a) 정류장 근접성
  let proximity: number | null = null
  let walkMin = 0
  if (near) {
    walkMin = walkMinutes(near.distanceM)
    proximity = piecewise(walkMin, PROXIMITY_CURVE)

    const stopCount = countWithin(stops, MULTI_STOP_RADIUS_M)
    if (stopCount >= 3) {
      proximity = Math.min(100, proximity + 5)
      details.push(`반경 500m 내 정류장 ${stopCount}개 — 5점 가산`)
    }
    if (stops.some((s) => WIDE_AREA_PATTERN.test(s.name))) {
      proximity = Math.min(100, proximity + 5)
      details.push('광역·직행버스 정차 — 5점 가산')
    }
    details.push(
      `최근접 ${near.name} 도보 ${Math.round(walkMin)}분 (직선 ${formatDistance(near.distanceM)})`,
    )
  } else {
    proximity = 0
    details.push('반경 내 버스정류장 없음')
  }

  // (b) 사무실 버스 직결성
  let officeLink: number | null = null
  const officeRoute = ctx.observations.officeBusRoute
  if (officeRoute) {
    officeLink = transferScore(officeRoute.transferCount, BUS_TRANSFER_TABLE)
    details.push(
      `사무실까지 버스 ${officeRoute.transferCount === 0 ? '한 번에 이동 가능' : `환승 ${officeRoute.transferCount}회`} — ${officeRoute.summary}`,
    )
  }

  // (c) 자주 가는 장소 버스 직결성
  let placeLink: number | null = null
  const placeRoutes = ctx.observations.placeBusRoutes
  if (placeRoutes && ctx.user.frequentPlaces.length > 0) {
    const entries = ctx.user.frequentPlaces
      .map((place) => {
        const r = placeRoutes[place.id]
        if (!r) return null
        return {
          importance: place.importance,
          score: transferScore(r.transferCount, BUS_TRANSFER_TABLE),
          label: place.label,
          transfers: r.transferCount,
        }
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)

    placeLink = importanceWeightedAverage(entries)
    for (const e of entries) {
      details.push(
        `${e.label}까지 버스 ${e.transfers === 0 ? '직통' : `환승 ${e.transfers}회`}`,
      )
    }
  }

  const score = blend([
    { weight: 0.4, score: proximity },
    { weight: 0.35, score: officeLink },
    { weight: 0.25, score: placeLink },
  ])

  if (score === null) {
    return missing('BUS', weight, '버스 접근성을 평가할 데이터가 없습니다.')
  }

  const reason = near
    ? `${near.name} 도보 ${Math.round(walkMin)}분` +
      (officeRoute
        ? ` · 사무실 ${officeRoute.transferCount === 0 ? '직통' : `환승 ${officeRoute.transferCount}회`}`
        : '')
    : '주변 버스정류장 없음'

  return ok({
    axis: 'BUS',
    weight,
    score,
    raw: {
      nearestStop: near?.name ?? null,
      nearestDistanceM: near?.distanceM ?? null,
      walkMinutes: Math.round(walkMin * 10) / 10,
      proximityScore: proximity,
      officeLinkScore: officeLink,
      placeLinkScore: placeLink,
    },
    reason,
    details,
    sources: [{ label: 'ODsay 정류장·버스 경로', asOf: '' }],
  })
}
