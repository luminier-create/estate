/**
 * RISK — 커뮤니티 확인 문제점 (감점, 최대 −15)
 * 가산 축이 아니라 총점에서 차감한다.
 * 설계 근거: docs/01-ALGORITHM.md §5.11
 */
import type { RiskCode, RiskItem, ScoringInput } from '../types'
import { nearest, countWithin } from './shared'

export const MAX_RISK_PENALTY = 15

export const RISK_SPEC: Record<RiskCode, { label: string; penalty: number }> = {
  NOISE_FLOOR: { label: '층간소음 우려', penalty: 4 },
  NOISE_ROAD: { label: '도로·철도 소음', penalty: 3 },
  NOISE_AIRCRAFT: { label: '항공기 소음권', penalty: 3 },
  STEEP_SLOPE: { label: '단지 진입 급경사', penalty: 3 },
  NIGHTLIFE: { label: '인근 유흥상권', penalty: 3 },
  AVOIDED_FACILITY: { label: '혐오·기피시설 인접', penalty: 4 },
  PARKING_SHORTAGE: { label: '주차 부족', penalty: 3 },
  SUNLIGHT_BLOCKED: { label: '일조·조망 침해', penalty: 2 },
  COMMUNITY_OTHER: { label: '커뮤니티 다수 지적 사항', penalty: 2 },
}

/** 간선도로 소음 판정 거리 */
const ROAD_NOISE_RADIUS_M = 50
/** 유흥상권 밀집 판정: 반경 300m 내 N개 이상 */
const NIGHTLIFE_RADIUS_M = 300
const NIGHTLIFE_THRESHOLD = 5
/** 급경사 판정 기준 (8%) */
const SLOPE_THRESHOLD = 0.08
/** 주차 부족 판정 (세대당 1.0대 미만) */
const PARKING_THRESHOLD = 1.0
const AVOIDED_FACILITY_RADIUS_M = 500

export function evaluateRisks(ctx: ScoringInput): {
  risks: RiskItem[]
  penalty: number
} {
  const risks: RiskItem[] = []
  const obs = ctx.observations
  const prop = ctx.property
  const seen = new Set<RiskCode>()

  const add = (code: RiskCode, origin: 'auto' | 'user', reason: string) => {
    if (seen.has(code)) return
    const spec = RISK_SPEC[code]
    // 저장된 문서의 알 수 없는 코드로 스코어링 전체가 던지지 않게 한다
    if (!spec) return
    seen.add(code)
    risks.push({ code, label: spec.label, penalty: spec.penalty, origin, reason })
  }

  // ─── 자동 판정 ───────────────────────────────────────────
  const road = nearest(obs.majorRoads)
  if (road && road.distanceM <= ROAD_NOISE_RADIUS_M) {
    add('NOISE_ROAD', 'auto', `${road.name} 약 ${Math.round(road.distanceM)}m — 소음 노출 가능`)
  }

  const nightlifeCount = countWithin(obs.nightlifeSpots, NIGHTLIFE_RADIUS_M)
  if (nightlifeCount >= NIGHTLIFE_THRESHOLD) {
    add('NIGHTLIFE', 'auto', `반경 300m 내 유흥업소 ${nightlifeCount}곳 밀집`)
  }

  const avoided = nearest(obs.avoidedFacilities)
  if (avoided && avoided.distanceM <= AVOIDED_FACILITY_RADIUS_M) {
    add(
      'AVOIDED_FACILITY',
      'auto',
      `${avoided.name} 약 ${Math.round(avoided.distanceM)}m`,
    )
  }

  if (obs.approachSlope != null && obs.approachSlope >= SLOPE_THRESHOLD) {
    add(
      'STEEP_SLOPE',
      'auto',
      `진입로 평균 경사 ${(obs.approachSlope * 100).toFixed(1)}% — 도보 접근 부담`,
    )
  }

  if (
    prop.parkingPerHousehold != null &&
    prop.parkingPerHousehold < PARKING_THRESHOLD
  ) {
    add(
      'PARKING_SHORTAGE',
      'auto',
      `세대당 주차 ${prop.parkingPerHousehold.toFixed(2)}대 — 1.0대 미만`,
    )
  }

  // 벽식구조 + 사용자 체크가 함께일 때만 층간소음 자동 가중
  if (prop.structureType === 'WALL' && (prop.userRisks ?? []).includes('NOISE_FLOOR')) {
    add('NOISE_FLOOR', 'auto', '벽식구조 + 사용자 확인 — 층간소음 전달 구조')
  }

  // ─── 사용자 입력 ─────────────────────────────────────────
  for (const code of prop.userRisks ?? []) {
    add(code, 'user', '사용자가 직접 확인한 사항')
  }

  const rawSum = risks.reduce((s, r) => s + r.penalty, 0)
  const penalty = Math.min(MAX_RISK_PENALTY, rawSum)

  return { risks, penalty }
}
