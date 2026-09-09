/**
 * DEVELOPMENT — 호재 (w=7)
 * 호재 유형별 배점 × 확실성 계수의 합. 악재는 감점.
 * 호재가 없어도 결측이 아니라 중립 40점을 준다.
 * 설계 근거: docs/01-ALGORITHM.md §5.9
 */
import type {
  AxisResult,
  DevelopmentItem,
  DevelopmentStage,
  DevelopmentType,
} from '../types'
import { ok, type AxisContext } from './shared'

/** 유형별 기본 배점과 영향 반경(m) */
export const DEVELOPMENT_POINTS: Record<
  DevelopmentType,
  { points: number; radiusM: number; label: string }
> = {
  REDEVELOPMENT_SELF: { points: 40, radiusM: 0, label: '본 단지 재건축·재개발' },
  GTX_NEW_STATION: { points: 35, radiusM: 1000, label: 'GTX·신설 지하철역' },
  SUBWAY_EXTENSION: { points: 25, radiusM: 1000, label: '노선 연장·신설' },
  LARGE_DISTRICT: { points: 25, radiusM: 3000, label: '대규모 개발지구' },
  CORPORATE_CAMPUS: { points: 20, radiusM: 3000, label: '대기업 사옥·산업단지' },
  REDEVELOPMENT_NEARBY: { points: 15, radiusM: 500, label: '인근 정비사업' },
  PARK_WATERFRONT: { points: 12, radiusM: 1000, label: '대형 공원·수변공간' },
  ROAD_BRIDGE: { points: 10, radiusM: 1000, label: '도로·교량 신설' },
  SCHOOL_NEW: { points: 10, radiusM: 1000, label: '학교 신설' },
  AVOIDED_FACILITY: { points: -20, radiusM: 1000, label: '혐오·기피시설' },
}

/** 확실성 단계별 계수 */
export const STAGE_FACTOR: Record<DevelopmentStage, number> = {
  CONFIRMED: 1.0,
  APPROVED: 0.85,
  PLANNED: 0.6,
  PROPOSED: 0.35,
  RUMOR: 0.15,
}

export const STAGE_LABEL: Record<DevelopmentStage, string> = {
  CONFIRMED: '착공·확정 고시',
  APPROVED: '실시계획 인가',
  PLANNED: '기본계획·예타 통과',
  PROPOSED: '추진 발표·검토',
  RUMOR: '언론 보도 수준',
}

/** 호재가 하나도 없을 때의 중립 점수 */
const NEUTRAL_SCORE = 40

/**
 * 정의되지 않은 유형·단계를 걸러낸다.
 *
 * 저장된 문서에 알 수 없는 코드가 하나만 있어도 조회 결과가 undefined 가 되고
 * `.radiusM` 접근에서 스코어링 전체가 던진다. 축 하나가 결측되는 게 아니라
 * 그 단지의 분석이 통째로 실패한다. 코드를 추가·개명하면 구버전 문서에서
 * 바로 재현되므로, 모르는 항목은 무시하는 쪽이 맞다.
 */
function isKnown(item: DevelopmentItem): boolean {
  return item.type in DEVELOPMENT_POINTS && item.stage in STAGE_FACTOR
}

function isWithinRadius(item: DevelopmentItem): boolean {
  const spec = DEVELOPMENT_POINTS[item.type]
  if (spec.radiusM === 0) return true
  if (item.distanceM == null) return true // 거리 미상은 사용자가 관련 있다고 등록한 것으로 본다
  return item.distanceM <= spec.radiusM
}

export function scoreDevelopment(ctx: AxisContext): AxisResult {
  const weight = ctx.weights.DEVELOPMENT
  const items = (ctx.property.developments ?? []).filter(isKnown)

  const applicable = items.filter(isWithinRadius)
  const excluded = items.length - applicable.length

  if (applicable.length === 0) {
    return ok({
      axis: 'DEVELOPMENT',
      weight,
      score: NEUTRAL_SCORE,
      raw: { itemCount: 0, excluded },
      reason: '확인된 호재 없음 — 중립 기준점 적용',
      details: [
        '등록된 호재가 없어 중립 점수 40점을 적용했습니다.',
        '단지 상세에서 호재를 직접 등록하면 점수에 반영됩니다.',
        ...(excluded > 0 ? [`영향 반경을 벗어난 ${excluded}건은 제외되었습니다.`] : []),
      ],
      sources: [{ label: '사용자 입력 / 호재 큐레이션 DB', asOf: '' }],
      confidence: 'low',
    })
  }

  let total = 0
  const details: string[] = []
  const positives: string[] = []

  for (const item of applicable) {
    const spec = DEVELOPMENT_POINTS[item.type]
    const factor = item.type === 'AVOIDED_FACILITY' ? 1 : STAGE_FACTOR[item.stage]
    const contribution = spec.points * factor
    total += contribution

    const distText = item.distanceM != null ? ` · ${Math.round(item.distanceM)}m` : ''
    details.push(
      `${item.title} — ${spec.label} (${STAGE_LABEL[item.stage]}${distText}) → ${contribution >= 0 ? '+' : ''}${Math.round(contribution)}점` +
        (item.sourceUrl ? ` [출처 등록됨]` : ' [출처 없음]'),
    )
    if (contribution > 0) positives.push(item.title)
  }

  if (excluded > 0) {
    details.push(`영향 반경을 벗어난 ${excluded}건은 계산에서 제외되었습니다.`)
  }
  details.push('확실성이 낮은 단계일수록 계수가 낮게 적용됩니다. 출처가 없는 호재는 신중히 판단하십시오.')

  const score = Math.min(100, Math.max(0, total))
  const withoutSource = applicable.filter((i) => !i.sourceUrl).length

  return ok({
    axis: 'DEVELOPMENT',
    weight,
    score,
    raw: {
      itemCount: applicable.length,
      rawTotal: Math.round(total),
      excluded,
      withoutSource,
    },
    reason:
      positives.length > 0
        ? `호재 ${applicable.length}건 — ${positives.slice(0, 2).join(', ')}${positives.length > 2 ? ` 외 ${positives.length - 2}건` : ''}`
        : `악재 ${applicable.length}건 확인`,
    details,
    sources: [{ label: '사용자 입력 / 호재 큐레이션 DB', asOf: '' }],
    confidence: withoutSource === 0 ? 'high' : 'medium',
  })
}
