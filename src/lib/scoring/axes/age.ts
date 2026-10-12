/**
 * AGE — 단지 노후도 (w=7)
 *
 * U자형 곡선을 채택한다. 신축이 최고점이나 30년 도달 시 재건축 기대가
 * 가격에 선반영되므로 42점 저점 후 반등한다.
 * 반등 상한을 68점으로 제한하여 DEVELOPMENT 축과의 이중 계상을 막는다.
 *
 * 설계 근거: docs/01-ALGORITHM.md §5.8
 */
import { piecewise } from '../normalize'
import type { AxisResult } from '../types'
import { missing, ok, type AxisContext } from './shared'

const CURVE = [
  [0, 100],
  [5, 97],
  [10, 88],
  [15, 74],
  [20, 60],
  [25, 48],
  [30, 42],
  [33, 52],
  [36, 62],
  [40, 68],
  [50, 60],
] as const

/** 도시정비법상 재건축 연한 (서울시 기준) */
const REDEVELOPMENT_THRESHOLD_YEARS = 30

export function scoreAge(ctx: AxisContext): AxisResult {
  const weight = ctx.weights.AGE
  const buildYear = ctx.property.buildYear

  if (buildYear == null || buildYear < 1900) {
    return missing(
      'AGE',
      weight,
      '건축년도 정보가 없습니다. 단지 수정 화면에서 입력하면 평가됩니다.',
    )
  }

  const currentYear = new Date().getFullYear()
  const age = currentYear - buildYear
  const score = piecewise(age, CURVE)

  const phase =
    age <= 5
      ? '신축'
      : age <= 10
        ? '준신축'
        : age <= 20
          ? '중간 연차'
          : age < REDEVELOPMENT_THRESHOLD_YEARS
            ? '노후 진입 — 재건축 연한 도달 전'
            : age < 40
              ? '재건축 연한 도달 — 정비사업 기대 구간'
              : '초고령 단지 — 정비사업 진행 여부가 가치를 좌우'

  const details = [
    `${buildYear}년 준공 · ${age}년차`,
    `구간 판정: ${phase}`,
  ]
  if (age >= REDEVELOPMENT_THRESHOLD_YEARS) {
    details.push(
      '재건축 연한(30년) 도달로 기대감이 반영되나, 실제 사업 진행 단계는 호재 항목에서 별도 평가됩니다.',
    )
  }

  return ok({
    axis: 'AGE',
    weight,
    score,
    raw: { buildYear, age, phase },
    reason: `${buildYear}년 준공 ${age}년차 — ${phase}`,
    details,
    sources: [{ label: '국토교통부 실거래가 상세(건축년도) / 사용자 입력', asOf: '' }],
  })
}
