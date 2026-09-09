/** 축 계산기 공통 헬퍼 */
import type {
  AxisCode,
  AxisResult,
  Confidence,
  PlaceHit,
  ScoringInput,
  SourceRef,
} from '../types'
import { round1 } from '../normalize'

export type AxisContext = ScoringInput

/** 데이터 결측 결과. 총점 계산에서 가중치째 제외된다. */
export function missing(
  axis: AxisCode,
  weight: number,
  reason: string,
): AxisResult {
  return {
    axis,
    score: null,
    weight,
    raw: {},
    reason,
    details: ['이 항목은 총점 계산에서 제외되었습니다.'],
    sources: [],
    confidence: 'low',
  }
}

export function ok(params: {
  axis: AxisCode
  weight: number
  score: number
  raw: Record<string, unknown>
  reason: string
  details?: string[]
  sources?: SourceRef[]
  confidence?: Confidence
}): AxisResult {
  // 계산 불능(NaN·Infinity)은 결측으로 강등한다. 그대로 두면 총점이 NaN 이 되거나
  // clamp 를 거치며 그럴듯한 숫자로 위장된다 — 둘 다 순위를 조용히 망친다.
  //
  // 호출부의 reason 은 쓰지 않는다. 점수를 못 낸 상황이면 그 문장도 같은 값으로
  // 만들어졌을 가능성이 높아 "대중교통 NaN시간 NaN분" 같은 문구가 그대로
  // 사용자에게 나간다.
  if (!Number.isFinite(params.score)) {
    return missing(
      params.axis,
      params.weight,
      '필요한 값을 계산하지 못해 이 항목을 평가할 수 없습니다.',
    )
  }
  return {
    axis: params.axis,
    score: round1(Math.min(100, Math.max(0, params.score))),
    weight: params.weight,
    raw: params.raw,
    reason: params.reason,
    details: params.details ?? [],
    sources: params.sources ?? [],
    confidence: params.confidence ?? 'high',
  }
}

/** 거리순 최근접 장소. 빈 배열이면 null. */
export function nearest(places: readonly PlaceHit[] | null): PlaceHit | null {
  if (!places || places.length === 0) return null
  return places.reduce((min, p) => (p.distanceM < min.distanceM ? p : min))
}

/** 반경 내 장소 개수 */
export function countWithin(
  places: readonly PlaceHit[] | null,
  radiusM: number,
): number {
  if (!places) return 0
  return places.filter((p) => p.distanceM <= radiusM).length
}

/**
 * 환승 횟수 → 직결성 점수.
 * 설계 근거: docs/01-ALGORITHM.md §5.3(b), §5.4(b)
 */
export function transferScore(
  transferCount: number,
  table: readonly number[],
): number {
  const idx = Math.min(Math.max(0, Math.round(transferCount)), table.length - 1)
  return table[idx]!
}

export const SUBWAY_TRANSFER_TABLE = [100, 70, 45, 20] as const
export const BUS_TRANSFER_TABLE = [100, 60, 25, 25] as const

/**
 * 자주 가는 장소별 점수를 중요도 가중 평균한다.
 * 등록된 장소가 없으면 null (해당 서브스코어를 재정규화로 제외).
 */
export function importanceWeightedAverage(
  entries: readonly { importance: number; score: number }[],
): number | null {
  const valid = entries.filter(
    (e) => Number.isFinite(e.score) && Number.isFinite(e.importance),
  )
  if (valid.length === 0) return null
  const totalWeight = valid.reduce((s, e) => s + e.importance, 0)
  if (totalWeight <= 0) return null
  return valid.reduce((s, e) => s + e.score * e.importance, 0) / totalWeight
}

/**
 * 서브스코어 가중 합성. null 인 항목은 제외하고 나머지 가중치를 재정규화한다.
 * 모든 항목이 null 이면 null 을 반환한다.
 */
export function blend(
  parts: readonly { weight: number; score: number | null }[],
): number | null {
  // NaN 서브스코어 하나가 축 전체를 오염시키지 않도록 null 과 함께 제외한다.
  const valid = parts.filter(
    (p): p is { weight: number; score: number } =>
      p.score !== null && Number.isFinite(p.score),
  )
  if (valid.length === 0) return null
  const totalWeight = valid.reduce((s, p) => s + p.weight, 0)
  if (totalWeight <= 0) return null
  return valid.reduce((s, p) => s + p.score * p.weight, 0) / totalWeight
}
