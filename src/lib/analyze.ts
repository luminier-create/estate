import 'server-only'
/**
 * 분석 파이프라인
 *
 * 외부 Provider 를 병렬 호출하고, 실패한 항목은 해당 축만 결측 처리한다.
 * 전체 실패로 번지지 않게 하는 것이 이 모듈의 핵심 책임이다.
 *
 * 설계 근거: docs/02-ARCHITECTURE.md §5
 */
import { computeScore } from './scoring/aggregate'
import { m2ToPyeong, median, quantile, removeOutliers } from './scoring/normalize'
import { getPreset, normalizeWeights } from './scoring/presets'
import { collectLandmarks } from './scoring/landmarks'
import type {
  Landmark,
  Observations,
  PropertyInput,
  ScoreResult,
  Trade,
  TransitRoute,
  UserContext,
} from './scoring/types'
import {
  geoProvider,
  marketProvider,
  odsayStops,
  transitProvider,
  providerStatus,
} from './providers'
import { recentMonths } from './providers/molit'
import type { StoredProfile, StoredProperty } from './repo/types'

const POI_RADIUS = {
  SUBWAY: 2000,
  BUS_STOP: 800,
  SCHOOL: 2000,
  MART: 3000,
  NIGHTLIFE: 400,
  AVOIDED: 1000,
  ROAD: 300,
} as const

/** 시세 비교 윈도우 (개월) */
const MARKET_WINDOW_MONTHS = 6
/** 면적 허용 오차 (㎡) */
const AREA_TOLERANCE = 5

/** Promise 를 안전하게 실행하고 실패 시 null 을 돌려준다. */
async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch {
    return null
  }
}

export function toPropertyInput(p: StoredProperty): PropertyInput {
  return {
    id: p.id,
    name: p.name,
    address: p.address,
    lat: p.lat,
    lng: p.lng,
    lawdCd: p.lawdCd,
    exclusiveM2: p.exclusiveM2,
    priceManwon: p.priceManwon,
    buildYear: p.buildYear,
    totalHouseholds: p.totalHouseholds,
    parkingPerHousehold: p.parkingPerHousehold,
    monthlyFeePerM2: p.monthlyFeePerM2,
    communityFacilities: p.communityFacilities,
    structureType: p.structureType,
    userRisks: p.userRisks,
    developments: p.developments,
  }
}

export function toUserContext(profile: StoredProfile): UserContext {
  return {
    budget: profile.budget,
    office: profile.office
      ? {
          label: profile.office.label,
          lat: profile.office.lat,
          lng: profile.office.lng,
          commuteMode: profile.office.commuteMode,
          targetMinutes: profile.office.targetMinutes,
        }
      : null,
    frequentPlaces: profile.frequentPlaces.map((p) => ({
      id: p.id,
      label: p.label,
      lat: p.lat,
      lng: p.lng,
      importance: p.importance,
    })),
    household: profile.household,
  }
}

/** 실거래 목록에서 시세 비교군을 추린다. 표본이 부족하면 조건을 단계적으로 완화한다. */
function selectComparables(
  trades: Trade[],
  targetM2: number,
): { trades: Trade[]; scope: string } {
  const strict = trades.filter(
    (t) => Math.abs(t.exclusiveM2 - targetM2) <= 3,
  )
  if (strict.length >= 5) {
    return { trades: strict, scope: `전용 ${targetM2}㎡ ±3㎡ · 최근 ${MARKET_WINDOW_MONTHS}개월` }
  }
  const loose = trades.filter(
    (t) => Math.abs(t.exclusiveM2 - targetM2) <= AREA_TOLERANCE,
  )
  if (loose.length >= 5) {
    return { trades: loose, scope: `전용 ${targetM2}㎡ ±${AREA_TOLERANCE}㎡ · 최근 ${MARKET_WINDOW_MONTHS}개월` }
  }
  const widest = trades.filter((t) => Math.abs(t.exclusiveM2 - targetM2) <= 10)
  return {
    trades: widest.length >= 3 ? widest : trades,
    scope:
      widest.length >= 3
        ? `전용 ${targetM2}㎡ ±10㎡ · 최근 ${MARKET_WINDOW_MONTHS}개월`
        : `동일 법정동 전체 · 최근 ${MARKET_WINDOW_MONTHS}개월`,
  }
}

/** 최근 12개월 vs 그 이전 12개월 평단가 변동률 */
function computeMomentum(recent: Trade[], older: Trade[]): number | null {
  if (recent.length < 5 || older.length < 5) return null
  const unit = (ts: Trade[]) =>
    median(removeOutliers(ts.map((t) => t.amountManwon / m2ToPyeong(t.exclusiveM2))))
  const now = unit(recent)
  const before = unit(older)
  if (!Number.isFinite(now) || !Number.isFinite(before) || before <= 0) return null
  return (now - before) / before
}

export async function collectObservations(
  property: PropertyInput,
  user: UserContext,
): Promise<Observations> {
  const geo = geoProvider()
  const market = marketProvider()
  const transit = transitProvider()
  const stops = odsayStops()
  const at = { lat: property.lat, lng: property.lng }

  const [
    subwayStations,
    busStops,
    elementarySchools,
    middleSchools,
    highSchools,
    marts,
    nightlifeSpots,
    avoidedFacilities,
    majorRoads,
  ] = await Promise.all([
    safe(() => geo.nearbyByCategory('SUBWAY', at, POI_RADIUS.SUBWAY)),
    safe(() =>
      stops
        ? stops.nearbyStops(at, POI_RADIUS.BUS_STOP)
        : geo.nearbyByCategory('BUS_STOP', at, POI_RADIUS.BUS_STOP),
    ),
    safe(() => geo.nearbyByCategory('ELEMENTARY', at, POI_RADIUS.SCHOOL)),
    safe(() => geo.nearbyByCategory('MIDDLE', at, POI_RADIUS.SCHOOL)),
    safe(() => geo.nearbyByCategory('HIGH', at, POI_RADIUS.SCHOOL)),
    safe(() => geo.nearbyByCategory('MART', at, POI_RADIUS.MART)),
    safe(() => geo.nearbyByCategory('NIGHTLIFE', at, POI_RADIUS.NIGHTLIFE)),
    safe(() => geo.nearbyByCategory('AVOIDED', at, POI_RADIUS.AVOIDED)),
    safe(() => geo.nearbyByCategory('MAJOR_ROAD', at, POI_RADIUS.ROAD)),
  ])

  // 경로 조회 — 사무실 3종 + 자주 가는 장소 2종/개
  const office = user.office
  const [officeRoute, officeSubwayRoute, officeBusRoute] = office
    ? await Promise.all([
        safe(() => transit.route(at, office, 'ALL')),
        safe(() => transit.route(at, office, 'SUBWAY')),
        safe(() => transit.route(at, office, 'BUS')),
      ])
    : [null, null, null]

  const placeSubwayRoutes: Record<string, TransitRoute> = {}
  const placeBusRoutes: Record<string, TransitRoute> = {}
  await Promise.all(
    user.frequentPlaces.map(async (place) => {
      const [sub, bus] = await Promise.all([
        safe(() => transit.route(at, place, 'SUBWAY')),
        safe(() => transit.route(at, place, 'BUS')),
      ])
      if (sub) placeSubwayRoutes[place.id] = sub
      if (bus) placeBusRoutes[place.id] = bus
    }),
  )

  // 실거래 — 최근 6개월 + 모멘텀 산출을 위한 직전 12개월
  const months = recentMonths(MARKET_WINDOW_MONTHS + 18)
  const monthlyTrades = await Promise.all(
    months.map((m) => safe(() => market.trades(property.lawdCd, m))),
  )
  const anyMarketSuccess = monthlyTrades.some((t) => t !== null)

  const windowTrades = monthlyTrades
    .slice(0, MARKET_WINDOW_MONTHS)
    .flatMap((t) => t ?? [])
  const recent12 = monthlyTrades.slice(0, 12).flatMap((t) => t ?? [])
  const older12 = monthlyTrades.slice(12, 24).flatMap((t) => t ?? [])

  const comparable = anyMarketSuccess
    ? selectComparables(windowTrades, property.exclusiveM2)
    : null

  // 생활권 상위 25% 평단가
  const allUnitPrices = recent12
    .map((t) => t.amountManwon / m2ToPyeong(t.exclusiveM2))
    .filter((v) => Number.isFinite(v) && v > 0)
  const premiumPricePerPyeong =
    allUnitPrices.length >= 10 ? quantile(removeOutliers(allUnitPrices), 0.75) : null

  // 해당 단지 최근 12개월 거래건수
  const tradeCount12m = anyMarketSuccess
    ? recent12.filter((t) => t.aptName && t.aptName === property.name).length ||
      null
    : null

  // 건축년도 — 실거래 상세에서 동일 단지명 매칭
  const matched = recent12.find((t) => t.aptName === property.name)
  const inferredBuildYear = matched?.buildYear ?? null
  if (property.buildYear == null && inferredBuildYear) {
    property.buildYear = inferredBuildYear
  }

  return {
    subwayStations,
    busStops,
    elementarySchools,
    middleSchools,
    highSchools,
    marts,
    nightlifeSpots,
    avoidedFacilities,
    majorRoads,
    officeRoute,
    officeSubwayRoute,
    officeBusRoute,
    placeSubwayRoutes:
      Object.keys(placeSubwayRoutes).length > 0 ? placeSubwayRoutes : null,
    placeBusRoutes:
      Object.keys(placeBusRoutes).length > 0 ? placeBusRoutes : null,
    comparableTrades: comparable?.trades ?? null,
    comparableScope: comparable?.scope ?? null,
    marketMomentum: computeMomentum(recent12, older12),
    premiumPricePerPyeong,
    tradeCount12m,
    // 입주예정 물량은 공개 API 로 확보되지 않아 MVP 에서는 결측 처리한다
    upcomingSupply: null,
    existingHouseholds: null,
    regionAvgFeePerM2: 2400,
    approachSlope: null,
  }
}

export interface AnalyzeOutcome {
  result: ScoreResult
  /** 실거래 데이터에서 추정한 건축년도. 단지에 값이 없을 때만 채워진다. */
  inferredBuildYear: number | null
  /** 지도 표시용 주변 시설. 분석 시점의 관측을 그대로 남긴다. */
  landmarks: Landmark[]
}

export async function analyzeProperty(
  storedProperty: StoredProperty,
  profile: StoredProfile,
  presetId?: string,
): Promise<AnalyzeOutcome> {
  const property = toPropertyInput(storedProperty)
  const user = toUserContext(profile)
  const observations = await collectObservations(property, user)

  const activePreset = presetId ?? profile.weights.presetId
  const weights =
    activePreset === 'custom' && profile.weights.custom
      ? normalizeWeights(profile.weights.custom)
      : getPreset(activePreset).weights

  const result = computeScore({
    property,
    user,
    observations,
    weights,
    presetId: activePreset,
  })

  return {
    result,
    inferredBuildYear:
      storedProperty.buildYear == null ? (property.buildYear ?? null) : null,
    landmarks: collectLandmarks(observations),
  }
}

export { providerStatus }
