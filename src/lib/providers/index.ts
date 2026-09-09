import 'server-only'
/**
 * Provider 선택
 *
 * 환경변수에 키가 있으면 실 구현을, 없으면 Mock 을 쓴다.
 * 덕분에 키 없이도 앱 전체가 동작하고, .env 에 키를 넣는 순간 실데이터로 전환된다.
 * 설계 근거: docs/02-ARCHITECTURE.md §6
 */
import { KakaoGeoProvider } from './kakao'
import { MolitMarketProvider } from './molit'
import { OdsayTransitProvider } from './odsay'
import {
  MockAptInfoProvider,
  MockGeoProvider,
  MockMarketProvider,
  MockTransitProvider,
} from './mock'
import type {
  AptInfoProvider,
  GeoProvider,
  MarketProvider,
  TransitProvider,
} from './types'

const kakaoKey = process.env.KAKAO_REST_API_KEY
const molitKey = process.env.MOLIT_SERVICE_KEY
const odsayKey = process.env.ODSAY_API_KEY

export const providerStatus = {
  geo: kakaoKey ? 'kakao' : 'mock',
  market: molitKey ? 'molit' : 'mock',
  transit: odsayKey ? 'odsay' : 'mock',
  aptInfo: 'mock',
} as const

export const isAllMock =
  providerStatus.geo === 'mock' &&
  providerStatus.market === 'mock' &&
  providerStatus.transit === 'mock'

let geoCache: GeoProvider | null = null
let marketCache: MarketProvider | null = null
let transitCache: TransitProvider | null = null
let aptInfoCache: AptInfoProvider | null = null

export function geoProvider(): GeoProvider {
  geoCache ??= kakaoKey ? new KakaoGeoProvider(kakaoKey) : new MockGeoProvider()
  return geoCache
}

export function marketProvider(): MarketProvider {
  marketCache ??= molitKey
    ? new MolitMarketProvider(molitKey)
    : new MockMarketProvider()
  return marketCache
}

export function transitProvider(): TransitProvider {
  transitCache ??= odsayKey
    ? new OdsayTransitProvider(odsayKey)
    : new MockTransitProvider()
  return transitCache
}

export function aptInfoProvider(): AptInfoProvider {
  aptInfoCache ??= new MockAptInfoProvider()
  return aptInfoCache
}

/** ODsay 정류장 조회는 인터페이스 밖의 확장 기능이라 별도로 노출한다. */
export function odsayStops(): OdsayTransitProvider | null {
  return odsayKey ? (transitProvider() as OdsayTransitProvider) : null
}

export * from './types'
