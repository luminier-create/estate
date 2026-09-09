/**
 * INVESTMENT — 투자 기회 (w=8)
 * = 0.35 상승모멘텀 + 0.25 상대저평가 + 0.20 거래유동성 + 0.20 공급희소성
 * 설계 근거: docs/01-ALGORITHM.md §5.10
 */
import { m2ToPyeong, piecewise } from '../normalize'
import type { AxisResult } from '../types'
import { blend, missing, ok, type AxisContext } from './shared'

const MOMENTUM_CURVE = [
  [-0.15, 0],
  [-0.05, 25],
  [0, 45],
  [0.05, 65],
  [0.1, 82],
  [0.2, 95],
  [0.3, 100],
] as const

const GAP_CURVE = [
  [0, 40],
  [0.1, 60],
  [0.2, 80],
  [0.3, 95],
  [0.45, 100],
] as const

const TURNOVER_CURVE = [
  [0.005, 10],
  [0.015, 45],
  [0.03, 75],
  [0.05, 95],
  [0.08, 100],
] as const

const SUPPLY_CURVE = [
  [0, 100],
  [0.05, 85],
  [0.1, 65],
  [0.2, 35],
  [0.35, 10],
  [0.5, 0],
] as const

export function scoreInvestment(ctx: AxisContext): AxisResult {
  const weight = ctx.weights.INVESTMENT
  const obs = ctx.observations
  const details: string[] = []

  // (a) 상승 모멘텀
  let momentum: number | null = null
  if (obs.marketMomentum != null) {
    momentum = piecewise(obs.marketMomentum, MOMENTUM_CURVE)
    const pct = Math.round(obs.marketMomentum * 1000) / 10
    details.push(`최근 12개월 인근 평단가 ${pct >= 0 ? '+' : ''}${pct}%`)
  }

  // (b) 상대 저평가 (생활권 상위 25% 대비 갭)
  let gapScore: number | null = null
  if (obs.premiumPricePerPyeong != null && obs.premiumPricePerPyeong > 0) {
    const own = ctx.property.priceManwon / m2ToPyeong(ctx.property.exclusiveM2)
    const gap = 1 - own / obs.premiumPricePerPyeong
    gapScore = piecewise(gap, GAP_CURVE)
    details.push(
      `생활권 상위 25% 평단가 ${Math.round(obs.premiumPricePerPyeong).toLocaleString('ko-KR')}만원 대비 갭 ${Math.round(gap * 1000) / 10}%`,
    )
    if (gap > 0.45) {
      details.push(
        '갭이 45%를 초과합니다. 따라 오를 여지보다 구조적 열위(입지·연식) 가능성을 먼저 점검하십시오.',
      )
    }
  }

  // (c) 거래 유동성
  let turnoverScore: number | null = null
  if (obs.tradeCount12m != null && ctx.property.totalHouseholds) {
    const turnover = obs.tradeCount12m / ctx.property.totalHouseholds
    turnoverScore = piecewise(turnover, TURNOVER_CURVE)
    details.push(
      `최근 12개월 거래 ${obs.tradeCount12m}건 / ${ctx.property.totalHouseholds}세대 — 회전율 ${(turnover * 100).toFixed(1)}%`,
    )
  }

  // (d) 공급 희소성
  let supplyScore: number | null = null
  if (obs.upcomingSupply != null && obs.existingHouseholds && obs.existingHouseholds > 0) {
    const ratio = obs.upcomingSupply / obs.existingHouseholds
    supplyScore = piecewise(ratio, SUPPLY_CURVE)
    details.push(
      `반경 2km 3년 내 입주예정 ${obs.upcomingSupply.toLocaleString('ko-KR')}세대 (기존 대비 ${(ratio * 100).toFixed(0)}%)`,
    )
  }

  const score = blend([
    { weight: 0.35, score: momentum },
    { weight: 0.25, score: gapScore },
    { weight: 0.2, score: turnoverScore },
    { weight: 0.2, score: supplyScore },
  ])

  if (score === null) {
    return missing(
      'INVESTMENT',
      weight,
      '투자 지표를 산출할 시계열 데이터가 없습니다.',
    )
  }

  const available = [momentum, gapScore, turnoverScore, supplyScore].filter(
    (v) => v !== null,
  ).length
  if (available < 4) {
    details.push(`4개 지표 중 ${available}개만 산출되어 나머지는 제외 후 재정규화했습니다.`)
  }

  return ok({
    axis: 'INVESTMENT',
    weight,
    score,
    raw: { momentum, gapScore, turnoverScore, supplyScore, availableIndicators: available },
    reason:
      obs.marketMomentum != null
        ? `인근 시세 12개월 ${obs.marketMomentum >= 0 ? '+' : ''}${Math.round(obs.marketMomentum * 1000) / 10}% · 투자 지표 ${available}/4개 반영`
        : `투자 지표 ${available}/4개 반영`,
    details,
    sources: [
      {
        label: '국토교통부 실거래가 시계열',
        url: 'https://www.data.go.kr/data/15126468/openapi.do',
        asOf: '',
      },
    ],
    confidence: available >= 3 ? 'high' : available >= 2 ? 'medium' : 'low',
  })
}
