/**
 * 외부 데이터 Provider 인터페이스
 *
 * 모든 구현은 이 인터페이스 뒤에 숨는다. 환경변수에 API 키가 없으면
 * Mock 구현으로 폴백하므로 키 없이도 앱 전체가 동작한다.
 *
 * 설계 근거: docs/02-ARCHITECTURE.md §6
 */
import type { GeoPoint, PlaceHit, TransitRoute, Trade } from '../scoring/types'

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

export interface ProviderBundle {
  geo: GeoProvider
  transit: TransitProvider
  market: MarketProvider
  aptInfo: AptInfoProvider
}
