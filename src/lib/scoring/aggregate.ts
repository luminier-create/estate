/**
 * 총점 집계
 * 설계 근거: docs/01-ALGORITHM.md §3
 */
import { round1 } from './normalize'
import {
  ALGORITHM_VERSION,
  type AxisResult,
  type Confidence,
  type Grade,
  type ScoreResult,
  type ScoringInput,
} from './types'
import { scoreCommute } from './axes/commute'
import { scoreValue } from './axes/value'
import { scoreSubway } from './axes/subway'
import { scoreSchool } from './axes/school'
import { scoreBus } from './axes/bus'
import { scoreInvestment } from './axes/investment'
import { scoreAge } from './axes/age'
import { scoreDevelopment } from './axes/development'
import { scoreRetail } from './axes/retail'
import { scoreAmenity } from './axes/amenity'
import { evaluateRisks } from './axes/risk'

const GRADE_TABLE: readonly { min: number; grade: Grade; label: string }[] = [
  { min: 85, grade: 'S', label: '최적 입지' },
  { min: 75, grade: 'A', label: '우수' },
  { min: 65, grade: 'B', label: '양호' },
  { min: 55, grade: 'C', label: '보통' },
  { min: 40, grade: 'D', label: '조건 미흡' },
  { min: 0, grade: 'E', label: '부적합' },
]

export function toGrade(score: number): Grade {
  return GRADE_TABLE.find((g) => score >= g.min)?.grade ?? 'E'
}

export function gradeLabel(grade: Grade): string {
  return GRADE_TABLE.find((g) => g.grade === grade)?.label ?? '부적합'
}

export function confidenceLabel(ratio: number): Confidence {
  if (ratio >= 0.9) return 'high'
  if (ratio >= 0.7) return 'medium'
  return 'low'
}

export const CONFIDENCE_TEXT: Record<Confidence, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음 — 데이터 부족',
}

/**
 * 전체 축을 계산하고 총점을 산출한다.
 *
 * 결측 축은 가중치째 제외하고 나머지를 재정규화하므로,
 * 일부 외부 API가 실패해도 총점은 항상 0~100 범위로 산출된다.
 */
export function computeScore(input: ScoringInput): ScoreResult {
  const axes: AxisResult[] = [
    scoreCommute(input),
    scoreValue(input),
    scoreSubway(input),
    scoreSchool(input),
    scoreBus(input),
    scoreInvestment(input),
    scoreAge(input),
    scoreDevelopment(input),
    scoreRetail(input),
    scoreAmenity(input),
  ]

  const available = axes.filter(
    (a): a is AxisResult & { score: number } => a.score !== null,
  )
  const totalWeight = available.reduce((s, a) => s + a.weight, 0)

  const baseScore =
    totalWeight > 0
      ? available.reduce((s, a) => s + a.score * a.weight, 0) / totalWeight
      : 0

  const { risks, penalty } = evaluateRisks(input)
  const totalScore = Math.min(100, Math.max(0, baseScore - penalty))

  const declaredWeight = axes.reduce((s, a) => s + a.weight, 0)
  const confidence = declaredWeight > 0 ? totalWeight / declaredWeight : 0

  return {
    totalScore: round1(totalScore),
    grade: toGrade(totalScore),
    baseScore: round1(baseScore),
    riskPenalty: penalty,
    confidence: Math.round(confidence * 100) / 100,
    confidenceLabel: confidenceLabel(confidence),
    axes,
    risks,
    presetId: input.presetId,
    version: ALGORITHM_VERSION,
    computedAt: new Date().toISOString(),
  }
}

/** 총점 내림차순 정렬. 동점이면 신뢰도가 높은 쪽을 앞에 둔다. */
export function rankResults<T extends { score: ScoreResult }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const diff = b.score.totalScore - a.score.totalScore
    if (Math.abs(diff) > 0.05) return diff
    return b.score.confidence - a.score.confidence
  })
}

/** 축별 기여도 (총점에 몇 점 기여했는지). 상세 화면의 기여도 바 차트용. */
export function axisContributions(
  result: ScoreResult,
): { axis: string; contribution: number; score: number; weight: number }[] {
  const available = result.axes.filter(
    (a): a is AxisResult & { score: number } => a.score !== null,
  )
  const totalWeight = available.reduce((s, a) => s + a.weight, 0)
  if (totalWeight === 0) return []

  return available
    .map((a) => ({
      axis: a.axis,
      contribution: round1((a.score * a.weight) / totalWeight),
      score: a.score,
      weight: round1((a.weight / totalWeight) * 100),
    }))
    .sort((x, y) => y.contribution - x.contribution)
}

/**
 * 개선 여지가 큰 축을 찾는다 (가중치는 높은데 점수가 낮은 축).
 * "이 단지의 약점" 안내에 쓴다.
 */
export function weakestAxes(result: ScoreResult, limit = 3): AxisResult[] {
  return result.axes
    .filter((a): a is AxisResult & { score: number } => a.score !== null)
    .map((a) => ({ axis: a, loss: ((100 - a.score) * a.weight) / 100 }))
    .sort((x, y) => y.loss - x.loss)
    .slice(0, limit)
    .map((x) => x.axis)
}

/**
 * 이미 산출된 축 점수를 다른 가중치로 재집계한다.
 * 비교 화면의 가중치 슬라이더가 외부 API 재호출 없이 즉시 반응하도록 하기 위한 함수다.
 * 축 점수 자체는 가중치와 무관하므로 이 재계산은 정확하다.
 */
export function recomputeWithWeights(
  axes: readonly AxisResult[],
  weights: Record<string, number>,
  riskPenalty: number,
): { totalScore: number; grade: Grade; baseScore: number; confidence: number } {
  const available = axes.filter(
    (a): a is AxisResult & { score: number } => a.score !== null,
  )
  const totalWeight = available.reduce((s, a) => s + (weights[a.axis] ?? 0), 0)
  const baseScore =
    totalWeight > 0
      ? available.reduce((s, a) => s + a.score * (weights[a.axis] ?? 0), 0) /
        totalWeight
      : 0
  const declared = axes.reduce((s, a) => s + (weights[a.axis] ?? 0), 0)
  const totalScore = Math.min(100, Math.max(0, baseScore - riskPenalty))

  return {
    totalScore: round1(totalScore),
    grade: toGrade(totalScore),
    baseScore: round1(baseScore),
    confidence: declared > 0 ? Math.round((totalWeight / declared) * 100) / 100 : 0,
  }
}
