/**
 * AMENITY — 커뮤니티 센터·관리비 (w=5)
 * = 0.55 × 커뮤니티시설 + 0.45 × 관리비
 * 설계 근거: docs/01-ALGORITHM.md §5.7
 */
import { piecewise } from '../normalize'
import type { AxisResult, CommunityFacility } from '../types'
import { blend, missing, ok, type AxisContext } from './shared'

/** 시설별 배점. 합계 상한 100. */
export const FACILITY_POINTS: Record<CommunityFacility, number> = {
  POOL: 20,
  GYM: 15,
  DAYCARE: 12,
  GOLF: 10,
  STUDY_ROOM: 10,
  CAFE_LOUNGE: 8,
  KIDS_ROOM: 8,
  GUEST_HOUSE: 7,
  SAUNA: 5,
  SPORTS_HALL: 5,
}

export const FACILITY_LABEL: Record<CommunityFacility, string> = {
  POOL: '실내 수영장',
  GYM: '피트니스센터',
  DAYCARE: '단지 내 어린이집',
  GOLF: '실내 골프연습장',
  STUDY_ROOM: '독서실·스터디룸',
  CAFE_LOUNGE: '카페·라운지',
  KIDS_ROOM: '실내 놀이터·키즈룸',
  GUEST_HOUSE: '게스트하우스',
  SAUNA: '사우나',
  SPORTS_HALL: '다목적체육관',
}

/** 관리비 — 지역 평균 대비 배율 */
const FEE_CURVE = [
  [0.7, 100],
  [0.85, 88],
  [1.0, 70],
  [1.15, 45],
  [1.35, 20],
  [1.6, 0],
] as const

export function scoreAmenity(ctx: AxisContext): AxisResult {
  const weight = ctx.weights.AMENITY
  const { communityFacilities, totalHouseholds, monthlyFeePerM2 } = ctx.property
  const regionAvg = ctx.observations.regionAvgFeePerM2

  const details: string[] = []

  // (a) 커뮤니티 시설
  let facilityScore: number | null = null
  if (communityFacilities && communityFacilities.length > 0) {
    const sum = communityFacilities.reduce(
      (s, f) => s + (FACILITY_POINTS[f] ?? 0),
      0,
    )
    facilityScore = Math.min(100, sum)

    if (totalHouseholds != null) {
      if (totalHouseholds < 500) {
        facilityScore *= 0.9
        details.push(`${totalHouseholds}세대 — 소규모 단지 시설 운영 지속성 고려 10% 감산`)
      } else if (totalHouseholds >= 1500) {
        facilityScore = Math.min(100, facilityScore * 1.05)
        details.push(`${totalHouseholds}세대 — 대단지 5% 가산`)
      }
    }
    details.push(
      `보유 시설: ${communityFacilities.map((f) => FACILITY_LABEL[f]).join(', ')}`,
    )
  } else {
    // 빈 배열은 "시설이 없다"가 아니라 "입력하지 않았다"로 본다.
    // 0점 처리하면 미입력 단지가 부당하게 낮은 점수를 받는다.
    details.push('커뮤니티 시설 미입력 — 단지 수정 화면에서 체크하면 반영됩니다')
  }

  // (b) 관리비
  let feeScore: number | null = null
  if (monthlyFeePerM2 != null && regionAvg != null && regionAvg > 0) {
    const ratio = monthlyFeePerM2 / regionAvg
    feeScore = piecewise(ratio, FEE_CURVE)
    const pct = Math.round((ratio - 1) * 100)
    details.push(
      `㎡당 관리비 ${monthlyFeePerM2.toLocaleString('ko-KR')}원 — 지역 평균 ${regionAvg.toLocaleString('ko-KR')}원 대비 ${pct >= 0 ? '+' : ''}${pct}%`,
    )
  } else if (monthlyFeePerM2 != null) {
    details.push(
      `㎡당 관리비 ${monthlyFeePerM2.toLocaleString('ko-KR')}원 입력됨 — 비교할 지역 평균이 없어 점수에는 반영하지 않았습니다`,
    )
  } else {
    details.push('관리비 정보 없음 — 커뮤니티 시설만으로 평가')
  }

  const score = blend([
    { weight: 0.55, score: facilityScore },
    { weight: 0.45, score: feeScore },
  ])

  if (score === null) {
    return missing(
      'AMENITY',
      weight,
      '커뮤니티 시설과 관리비 정보가 모두 없습니다. 단지 수정 화면에서 입력하면 평가됩니다.',
    )
  }

  details.push(
    '커뮤니티가 좋을수록 관리비가 오르는 것은 정상적인 교환관계입니다. 두 항목을 분리해 확인하십시오.',
  )

  const reason =
    facilityScore != null && feeScore != null
      ? `커뮤니티 ${Math.round(facilityScore)}점 · 관리비 ${Math.round(feeScore)}점`
      : facilityScore != null
        ? `커뮤니티 시설 ${communityFacilities?.length ?? 0}종`
        : '관리비 기준 평가'

  return ok({
    axis: 'AMENITY',
    weight,
    score,
    raw: {
      facilityScore,
      feeScore,
      facilities: communityFacilities ?? [],
      totalHouseholds: totalHouseholds ?? null,
      monthlyFeePerM2: monthlyFeePerM2 ?? null,
      regionAvgFeePerM2: regionAvg,
    },
    reason,
    details,
    sources: [
      { label: '사용자 입력', asOf: '' },
      ...(regionAvg != null
        ? [{ label: '공동주택관리정보시스템', asOf: '' }]
        : []),
    ],
    confidence: facilityScore != null && feeScore != null ? 'high' : 'medium',
  })
}
