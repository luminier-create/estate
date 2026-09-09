/**
 * 가중치 프리셋
 * 설계 근거: docs/01-ALGORITHM.md §6
 */
import { AXIS_CODES, type AxisCode, type Weights } from './types'

export interface Preset {
  id: string
  label: string
  description: string
  weights: Weights
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'balanced',
    label: '균형',
    description: '통근·시세·교통·학군을 고르게 반영. 대부분의 실거주 매수에 적합.',
    weights: {
      COMMUTE: 20, VALUE: 15, SUBWAY: 13, SCHOOL: 12, BUS: 8,
      INVESTMENT: 8, AGE: 7, DEVELOPMENT: 7, RETAIL: 5, AMENITY: 5,
    },
  },
  {
    id: 'commute',
    label: '직주근접',
    description: '출퇴근 시간과 역세권을 최우선. 신혼·1인 가구, 장거리 통근 기피자용.',
    weights: {
      COMMUTE: 35, VALUE: 12, SUBWAY: 20, SCHOOL: 5, BUS: 10,
      INVESTMENT: 4, AGE: 5, DEVELOPMENT: 4, RETAIL: 3, AMENITY: 2,
    },
  },
  {
    id: 'school',
    label: '학군중심',
    description: '초·중·고 도보 접근성과 생활 인프라 비중 확대. 학령기 자녀 가구용.',
    weights: {
      COMMUTE: 12, VALUE: 10, SUBWAY: 8, SCHOOL: 35, BUS: 6,
      INVESTMENT: 5, AGE: 6, DEVELOPMENT: 5, RETAIL: 6, AMENITY: 7,
    },
  },
  {
    id: 'investment',
    label: '투자중심',
    description: '저평가 정도·상승 여력·호재를 최우선. 실거주 편의는 후순위.',
    weights: {
      COMMUTE: 8, VALUE: 22, SUBWAY: 10, SCHOOL: 6, BUS: 4,
      INVESTMENT: 25, AGE: 8, DEVELOPMENT: 15, RETAIL: 1, AMENITY: 1,
    },
  },
] as const

export const DEFAULT_PRESET_ID = 'balanced'

export function getPreset(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0]!
}

/** 커스텀 가중치를 쓰는 프로필의 프리셋 id */
export const CUSTOM_PRESET_ID = 'custom'

export function isKnownPresetId(id: string): boolean {
  return id === CUSTOM_PRESET_ID || PRESETS.some((p) => p.id === id)
}

/**
 * 알 수 없는 값은 기본 프리셋으로 되돌린다.
 *
 * getPreset 은 모르는 id 에 조용히 balanced 를 쓰지만, 원문 id 는 그대로
 * 분석 문서 ID 에 들어간다 — 임의 문자열로 문서를 무한 생성할 수 있고
 * 슬래시가 들어가면 경로 깊이까지 바뀐다.
 */
export function safePresetId(id: string | undefined): string {
  return id && isKnownPresetId(id) ? id : PRESETS[0]!.id
}

/**
 * 사용자 커스텀 가중치를 합 100으로 재정규화한다.
 * 슬라이더 조작 결과가 100이 아니어도 상대 비율만 유지하면 되므로 안전하다.
 */
export function normalizeWeights(input: Partial<Weights>): Weights {
  const filled = Object.fromEntries(
    AXIS_CODES.map((code) => [code, Math.max(0, input[code] ?? 0)]),
  ) as Weights

  const total = AXIS_CODES.reduce((sum, code) => sum + filled[code], 0)
  if (total <= 0) return getPreset(DEFAULT_PRESET_ID).weights

  const scaled = Object.fromEntries(
    AXIS_CODES.map((code) => [code, (filled[code] / total) * 100]),
  ) as Weights
  return scaled
}

/**
 * 가구 구성에 따른 학군 하위 가중치 (초/중/고).
 * 설계 근거: docs/01-ALGORITHM.md §5.5
 */
export const SCHOOL_SUB_WEIGHTS: Record<
  string,
  { elementary: number; middle: number; high: number }
> = {
  DEFAULT: { elementary: 0.45, middle: 0.3, high: 0.25 },
  WITH_PRESCHOOL: { elementary: 0.6, middle: 0.25, high: 0.15 },
  WITH_ELEMENTARY: { elementary: 0.7, middle: 0.2, high: 0.1 },
  WITH_SECONDARY: { elementary: 0.15, middle: 0.4, high: 0.45 },
  SINGLE: { elementary: 0.33, middle: 0.33, high: 0.34 },
  COUPLE: { elementary: 0.33, middle: 0.33, high: 0.34 },
  NO_CHILDREN: { elementary: 0.33, middle: 0.33, high: 0.34 },
}

export function schoolSubWeights(householdType: string) {
  return SCHOOL_SUB_WEIGHTS[householdType] ?? SCHOOL_SUB_WEIGHTS.DEFAULT!
}

export function axisWeight(weights: Weights, axis: AxisCode): number {
  return weights[axis] ?? 0
}
