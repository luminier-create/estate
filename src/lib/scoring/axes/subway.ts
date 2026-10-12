/**
 * SUBWAY — 지하철 접근성 (w=13)
 * = 0.50 × 근접성 + 0.30 × 사무실직결성 + 0.20 × 자주가는장소직결성
 * 설계 근거: docs/01-ALGORITHM.md §5.3
 */
import { formatDistance, piecewise, walkMinutes } from '../normalize'
import type { AxisResult } from '../types'
import {
  blend,
  importanceWeightedAverage,
  missing,
  nearest,
  ok,
  transferScore,
  SUBWAY_TRANSFER_TABLE,
  countWithin,
  type AxisContext,
} from './shared'

const PROXIMITY_CURVE = [
  [3, 100],
  [5, 95],
  [8, 80],
  [10, 70],
  [15, 40],
  [20, 15],
  [25, 0],
] as const

const DOUBLE_STATION_RADIUS_M = 800

export function scoreSubway(ctx: AxisContext): AxisResult {
  const weight = ctx.weights.SUBWAY
  const stations = ctx.observations.subwayStations

  if (!stations) {
    return missing('SUBWAY', weight, '주변 지하철역 정보를 조회하지 못했습니다.')
  }

  const details: string[] = []
  const near = nearest(stations)

  // (a) 근접성
  let proximity: number | null = null
  let walkMin = 0
  if (near) {
    walkMin = walkMinutes(near.distanceM)
    proximity = piecewise(walkMin, PROXIMITY_CURVE)

    const stationCount = countWithin(stations, DOUBLE_STATION_RADIUS_M)
    if (stationCount >= 2) {
      proximity = Math.min(100, proximity + 5)
      details.push(`반경 800m 내 역 ${stationCount}개 (더블역세권) — 5점 가산`)
    }
    if (/환승/.test(near.name) || (near.category ?? '').includes('환승')) {
      proximity = Math.min(100, proximity + 5)
      details.push('환승역 — 5점 가산')
    }
    details.push(
      `최근접 ${near.name} 도보 ${Math.round(walkMin)}분 (직선 ${formatDistance(near.distanceM)})`,
    )
  } else {
    proximity = 0
    details.push('반경 내 지하철역 없음')
  }

  // (b) 사무실 직결성
  let officeLink: number | null = null
  const officeRoute = ctx.observations.officeSubwayRoute
  if (officeRoute) {
    officeLink = transferScore(officeRoute.transferCount, SUBWAY_TRANSFER_TABLE)
    const label =
      officeRoute.transferCount === 0
        ? '직통'
        : `환승 ${officeRoute.transferCount}회`
    details.push(`사무실까지 지하철 ${label} (${officeRoute.summary})`)
  }

  // (c) 자주 가는 장소 직결성
  let placeLink: number | null = null
  const placeRoutes = ctx.observations.placeSubwayRoutes
  if (placeRoutes && ctx.user.frequentPlaces.length > 0) {
    const entries = ctx.user.frequentPlaces
      .map((place) => {
        const r = placeRoutes[place.id]
        if (!r) return null
        return {
          importance: place.importance,
          score: transferScore(r.transferCount, SUBWAY_TRANSFER_TABLE),
          label: place.label,
          transfers: r.transferCount,
        }
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)

    placeLink = importanceWeightedAverage(entries)
    for (const e of entries) {
      details.push(
        `${e.label}까지 지하철 ${e.transfers === 0 ? '직통' : `환승 ${e.transfers}회`}`,
      )
    }
  }

  const score = blend([
    { weight: 0.5, score: proximity },
    { weight: 0.3, score: officeLink },
    { weight: 0.2, score: placeLink },
  ])

  if (score === null) {
    return missing('SUBWAY', weight, '지하철 접근성을 평가할 데이터가 없습니다.')
  }

  const reason = near
    ? `${near.name} 도보 ${Math.round(walkMin)}분` +
      (officeRoute
        ? ` · 사무실까지 ${officeRoute.transferCount === 0 ? '직통' : `환승 ${officeRoute.transferCount}회`}`
        : '')
    : '주변 지하철역 없음'

  return ok({
    axis: 'SUBWAY',
    weight,
    score,
    raw: {
      nearestStation: near?.name ?? null,
      nearestDistanceM: near?.distanceM ?? null,
      walkMinutes: Math.round(walkMin * 10) / 10,
      proximityScore: proximity,
      officeLinkScore: officeLink,
      placeLinkScore: placeLink,
    },
    reason,
    details,
    sources: [
      { label: '카카오 로컬 (지하철역 SW8)', asOf: '' },
      { label: 'ODsay 대중교통 경로', asOf: '' },
    ],
  })
}
