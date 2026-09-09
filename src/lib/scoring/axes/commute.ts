/**
 * COMMUTE — 사무실 통근 (w=20)
 * 요구사항: 30분 이내 최고, 1시간 30분 이상 최저
 * 설계 근거: docs/01-ALGORITHM.md §5.1
 */
import { formatMinutes, piecewise } from '../normalize'
import type { AxisResult } from '../types'
import { missing, ok, type AxisContext } from './shared'

const CURVE = [
  [0, 100],
  [30, 100],
  [45, 80],
  [60, 55],
  [75, 32],
  [90, 10],
  [120, 0],
] as const

/** 환승 0회 보너스 / 3회 이상 페널티 */
const NO_TRANSFER_BONUS = 1.05
const MANY_TRANSFER_PENALTY = 0.92

export function scoreCommute(ctx: AxisContext): AxisResult {
  const weight = ctx.weights.COMMUTE
  const { office } = ctx.user
  const route = ctx.observations.officeRoute

  if (!office) {
    return missing('COMMUTE', weight, '사무실 위치가 등록되지 않았습니다.')
  }
  if (!route) {
    return missing(
      'COMMUTE',
      weight,
      '통근 경로를 조회하지 못했습니다. 대중교통 경로 데이터가 없습니다.',
    )
  }

  const base = piecewise(route.totalMinutes, CURVE)
  let score = base
  const details: string[] = []

  if (route.transferCount === 0) {
    score *= NO_TRANSFER_BONUS
    details.push('환승 없는 직통 경로 — 5% 가산')
  } else if (route.transferCount >= 3) {
    score *= MANY_TRANSFER_PENALTY
    details.push(`환승 ${route.transferCount}회 — 8% 감산`)
  }

  const diff = route.totalMinutes - office.targetMinutes
  const diffText =
    diff <= 0
      ? `목표 ${office.targetMinutes}분 대비 ${formatMinutes(-diff)} 여유`
      : `목표 ${office.targetMinutes}분 대비 ${formatMinutes(diff)} 초과`

  details.push(`도보 포함 총 ${formatMinutes(route.totalMinutes)}`)
  details.push(`환승 ${route.transferCount}회 · 도보 ${route.walkMeters}m`)
  details.push(route.summary)
  details.push(diffText)

  const mode = office.commuteMode === 'CAR' ? '자차' : '대중교통'

  return ok({
    axis: 'COMMUTE',
    weight,
    score,
    raw: {
      totalMinutes: route.totalMinutes,
      transferCount: route.transferCount,
      walkMeters: route.walkMeters,
      targetMinutes: office.targetMinutes,
      baseScore: base,
    },
    reason: `${office.label}까지 ${mode} ${formatMinutes(route.totalMinutes)} (환승 ${route.transferCount}회) — ${diffText}`,
    details,
    sources: [
      { label: 'ODsay 대중교통 경로', url: 'https://lab.odsay.com', asOf: '' },
    ],
  })
}
