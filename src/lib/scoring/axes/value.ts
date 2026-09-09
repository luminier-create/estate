/**
 * VALUE — 가격 대비 주변 시세 (w=15)
 * 설계 근거: docs/01-ALGORITHM.md §5.2
 */
import {
  m2ToPyeong,
  median,
  piecewise,
  removeOutliers,
  formatManwon,
} from '../normalize'
import type { AxisResult } from '../types'
import { missing, ok, type AxisContext } from './shared'

const CURVE = [
  [0.75, 100],
  [0.85, 95],
  [0.95, 80],
  [1.0, 70],
  [1.05, 55],
  [1.15, 30],
  [1.3, 5],
  [1.5, 0],
] as const

/** 비교군 최소 표본 수. 미달 시 시세 판정 불가로 본다. */
const MIN_SAMPLES = 3

export function scoreValue(ctx: AxisContext): AxisResult {
  const weight = ctx.weights.VALUE
  const trades = ctx.observations.comparableTrades

  if (!trades || trades.length < MIN_SAMPLES) {
    return missing(
      'VALUE',
      weight,
      `비교 가능한 실거래가 ${MIN_SAMPLES}건 미만입니다. 시세 비교를 할 수 없습니다.`,
    )
  }

  const pyeong = m2ToPyeong(ctx.property.exclusiveM2)
  if (!(pyeong > 0)) {
    // 음수 면적은 비율을 음수로 만들고, piecewise 하한 clamp 를 타 만점이 된다
    // ("평당 -19,677만원 — 358.5% 저평가"). 0 은 Infinity 다. 둘 다 결측이 맞다.
    return missing('VALUE', weight, '전용면적이 올바르지 않아 평단가를 산출할 수 없습니다.')
  }
  const userPerPyeong = ctx.property.priceManwon / pyeong

  const rawUnitPrices = trades.map((t) => t.amountManwon / m2ToPyeong(t.exclusiveM2))
  const cleaned = removeOutliers(rawUnitPrices)
  const marketPerPyeong = median(cleaned)

  if (!Number.isFinite(marketPerPyeong) || marketPerPyeong <= 0) {
    return missing('VALUE', weight, '주변 시세 중앙값을 산출하지 못했습니다.')
  }

  const ratio = userPerPyeong / marketPerPyeong
  const score = piecewise(ratio, CURVE)

  const gapPct = Math.round((ratio - 1) * 1000) / 10
  const verdict =
    gapPct <= -3
      ? `시세 대비 ${Math.abs(gapPct)}% 저평가`
      : gapPct >= 3
        ? `시세 대비 ${gapPct}% 고평가`
        : '시세 수준'

  const removed = rawUnitPrices.length - cleaned.length
  const details = [
    `입력 금액 ${formatManwon(ctx.property.priceManwon)} · 전용 ${ctx.property.exclusiveM2}㎡ (${pyeong.toFixed(1)}평)`,
    `입력 평단가 ${Math.round(userPerPyeong).toLocaleString('ko-KR')}만원`,
    `비교군 중앙값 ${Math.round(marketPerPyeong).toLocaleString('ko-KR')}만원/평 (${cleaned.length}건)`,
  ]
  if (ctx.observations.comparableScope) {
    details.push(`비교 범위: ${ctx.observations.comparableScope}`)
  }
  if (removed > 0) {
    details.push(`이상치 ${removed}건 제외 (IQR 1.5배 밖)`)
  }

  return ok({
    axis: 'VALUE',
    weight,
    score,
    raw: {
      userPerPyeong: Math.round(userPerPyeong),
      marketPerPyeong: Math.round(marketPerPyeong),
      ratio: Math.round(ratio * 1000) / 1000,
      sampleCount: cleaned.length,
    },
    reason: `평당 ${Math.round(userPerPyeong).toLocaleString('ko-KR')}만원 — 비교군 중앙값 ${Math.round(marketPerPyeong).toLocaleString('ko-KR')}만원 대비 ${verdict}`,
    details,
    sources: [
      {
        label: '국토교통부 아파트 매매 실거래가',
        url: 'https://www.data.go.kr/data/15126468/openapi.do',
        asOf: '',
      },
    ],
    confidence: cleaned.length >= 10 ? 'high' : cleaned.length >= 5 ? 'medium' : 'low',
  })
}
