/**
 * 외부 데이터 Provider 인터페이스
 *
 * 모든 구현은 이 인터페이스 뒤에 숨는다. 환경변수에 API 키가 없으면
 * Mock 구현으로 폴백하므로 키 없이도 앱 전체가 동작한다.
 *
 * 설계 근거: docs/02-ARCHITECTURE.md §6
 */
import type { GeoPoint, PlaceHit, SourceRef, TransitRoute, Trade } from '../scoring/types'

export type CategoryCode =
  | 'SUBWAY'
  | 'BUS_STOP'
  | 'MART'
  | 'ELEMENTARY'
  | 'MIDDLE'
  | 'HIGH'
  | 'NIGHTLIFE'
  | 'AVOIDED'
  | 'MAJOR_ROAD'

export interface GeocodeResult extends GeoPoint {
  address: string
  roadAddress: string | null
  /** 법정동코드 10자리 */
  legalCode: string
  /** 실거래가 조회용 앞 5자리 */
  lawdCd: string
  regionName: string
}

export interface PlaceSearchResult extends GeoPoint {
  id: string
  name: string
  address: string
  roadAddress: string | null
  categoryName: string | null
}

export interface GeoProvider {
  readonly name: string
  geocode(address: string): Promise<GeocodeResult | null>
  searchPlaces(query: string, near?: GeoPoint): Promise<PlaceSearchResult[]>
  nearbyByCategory(
    category: CategoryCode,
    at: GeoPoint,
    radiusM: number,
  ): Promise<PlaceHit[]>
}

export type TransitMode = 'ALL' | 'SUBWAY' | 'BUS'

export interface TransitProvider {
  readonly name: string
  route(
    from: GeoPoint,
    to: GeoPoint,
    mode: TransitMode,
  ): Promise<TransitRoute | null>
}

export interface MarketProvider {
  readonly name: string
  /** 법정동 5자리 + 계약년월(YYYYMM) 기준 실거래 목록 */
  trades(lawdCd: string, yyyymm: string): Promise<Trade[]>
}

export interface AptInfoResult {
  buildYear: number | null
  totalHouseholds: number | null
  parkingPerHousehold: number | null
  monthlyFeePerM2: number | null
  regionAvgFeePerM2: number | null
}

export interface AptInfoProvider {
  readonly name: string
  info(aptName: string, lawdCd: string): Promise<AptInfoResult | null>
}

// ─── 지역 시장 지표 ──────────────────────────────────────────

/**
 * 조회 가능한 지표.
 *
 * 단지 단위가 아니라 **지역 단위 시계열**이다. 개별 단지 점수와는 성격이 달라
 * 스코어링에 바로 넣지 않고 조회 화면에서 먼저 보여준다 — 숫자를 눈으로 확인한
 * 뒤에 점수 반영 여부를 판단하기 위해서다.
 */
export type MarketIndicator =
  | 'SALE_PRICE_INDEX'
  | 'JEONSE_PRICE_INDEX'
  | 'REAL_TRADE_INDEX'
  | 'JEONSE_CONVERSION_RATE'
  | 'LAND_PRICE_CHANGE'
  | 'UNSOLD_UNITS'

export const MARKET_INDICATORS: readonly MarketIndicator[] = [
  'SALE_PRICE_INDEX',
  'JEONSE_PRICE_INDEX',
  'REAL_TRADE_INDEX',
  'JEONSE_CONVERSION_RATE',
  'LAND_PRICE_CHANGE',
  'UNSOLD_UNITS',
] as const

export const MARKET_INDICATOR_LABEL: Record<MarketIndicator, string> = {
  SALE_PRICE_INDEX: '주택 매매가격지수',
  JEONSE_PRICE_INDEX: '주택 전세가격지수',
  REAL_TRADE_INDEX: '공동주택 실거래가격지수',
  JEONSE_CONVERSION_RATE: '전월세전환율',
  LAND_PRICE_CHANGE: '지가변동률',
  UNSOLD_UNITS: '미분양 주택',
}

/** 지표가 무엇을 말하는지. 화면에서 숫자 옆에 붙인다. */
export const MARKET_INDICATOR_NOTE: Record<MarketIndicator, string> = {
  SALE_PRICE_INDEX: '표본 조사 기반. 실제 체결가보다 완만하게 움직이는 경향이 있습니다.',
  JEONSE_PRICE_INDEX: '매매지수와 함께 보면 전세가율의 방향을 읽을 수 있습니다.',
  REAL_TRADE_INDEX: '실제 거래된 건으로 산출해 체감에 가깝지만, 거래가 적은 달은 흔들립니다.',
  JEONSE_CONVERSION_RATE: '전세를 월세로 돌릴 때의 비율. 높을수록 월세 부담이 큽니다.',
  LAND_PRICE_CHANGE: '건물이 아닌 토지 가격의 변동률입니다.',
  UNSOLD_UNITS: '공급 과잉 여부의 단서. 늘어나면 가격 하방 압력으로 읽힙니다.',
}

export interface IndexPoint {
  /** YYYYMM */
  period: string
  value: number
}

export interface MarketIndexSeries {
  indicator: MarketIndicator
  /** 지역 코드. 체계는 Provider 가 정한다 (실구현은 R-ONE 지역코드) */
  regionCode: string
  regionName: string
  /** 단위 표기. Provider 가 준 것을 그대로 쓴다 — 우리가 지어내지 않는다 */
  unit: string
  points: IndexPoint[]
  source: SourceRef
}

export interface MarketIndexProvider {
  readonly name: string
  /** 지원하는 지표. 구현마다 다를 수 있어 화면이 이걸 보고 선택지를 만든다 */
  readonly supported: readonly MarketIndicator[]
  /** 지역별 시계열. 최근 `months` 개월. 없으면 null */
  series(
    indicator: MarketIndicator,
    regionCode: string,
    months: number,
  ): Promise<MarketIndexSeries | null>
  /** 선택 가능한 지역 목록 */
  regions(): Promise<{ code: string; name: string }[]>
}

export interface ProviderBundle {
  geo: GeoProvider
  transit: TransitProvider
  market: MarketProvider
  aptInfo: AptInfoProvider
  marketIndex: MarketIndexProvider
}
