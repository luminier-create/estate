/**
 * Mock Provider 구현
 *
 * 핵심 원칙: **결정적(deterministic)**. 동일 입력 → 동일 출력.
 * 랜덤을 쓰면 골든 테스트가 성립하지 않는다.
 */
import { haversineM, m2ToPyeong } from '../../scoring/normalize'
import type { GeoPoint, PlaceHit, Trade, TransitRoute } from '../../scoring/types'
import type {
  AptInfoProvider,
  AptInfoResult,
  CategoryCode,
  GeocodeResult,
  GeoProvider,
  MarketProvider,
  PlaceSearchResult,
  TransitMode,
  TransitProvider,
} from '../types'
import { seedByCategory, SEED_PLACES } from './seed-places'

/** 문자열 → 32bit 결정적 해시 */
function hash32(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

// ─── Geo ─────────────────────────────────────────────────────

/** 시드 지역 앵커. 주소 문자열에 포함된 지역명으로 좌표를 결정한다. */
const REGION_ANCHORS: readonly {
  keyword: string
  lat: number
  lng: number
  legalCode: string
  regionName: string
}[] = [
  { keyword: '도곡', lat: 37.490858, lng: 127.048225, legalCode: '1168010700', regionName: '서울특별시 강남구 도곡동' },
  { keyword: '대치', lat: 37.499308, lng: 127.056164, legalCode: '1168010600', regionName: '서울특별시 강남구 대치동' },
  { keyword: '역삼', lat: 37.500622, lng: 127.036456, legalCode: '1168010100', regionName: '서울특별시 강남구 역삼동' },
  { keyword: '강남', lat: 37.497942, lng: 127.027621, legalCode: '1168010100', regionName: '서울특별시 강남구 역삼동' },
  { keyword: '상계', lat: 37.658294, lng: 127.058310, legalCode: '1135010600', regionName: '서울특별시 노원구 상계동' },
  { keyword: '중계', lat: 37.644504, lng: 127.064524, legalCode: '1135010500', regionName: '서울특별시 노원구 중계동' },
  { keyword: '노원', lat: 37.655128, lng: 127.061368, legalCode: '1135010600', regionName: '서울특별시 노원구 상계동' },
  { keyword: '판교', lat: 37.394761, lng: 127.109217, legalCode: '4113511000', regionName: '경기도 성남시 분당구 백현동' },
  { keyword: '분당', lat: 37.382673, lng: 127.118182, legalCode: '4113510800', regionName: '경기도 성남시 분당구 정자동' },
  { keyword: '여의도', lat: 37.521624, lng: 126.924191, legalCode: '1156011000', regionName: '서울특별시 영등포구 여의도동' },
]

const DEFAULT_ANCHOR = REGION_ANCHORS[0]!

export class MockGeoProvider implements GeoProvider {
  readonly name = 'mock-geo'

  async geocode(address: string): Promise<GeocodeResult> {
    const anchor =
      REGION_ANCHORS.find((a) => address.includes(a.keyword)) ?? DEFAULT_ANCHOR
    // 주소 해시로 앵커 주변 ±400m 내 결정적 오프셋을 준다
    const h = hash32(address)
    const dLat = (((h % 1000) / 1000) - 0.5) * 0.007
    const dLng = ((((h >> 10) % 1000) / 1000) - 0.5) * 0.009

    return {
      lat: anchor.lat + dLat,
      lng: anchor.lng + dLng,
      address,
      roadAddress: null,
      legalCode: anchor.legalCode,
      lawdCd: anchor.legalCode.slice(0, 5),
      regionName: anchor.regionName,
    }
  }

  async searchPlaces(query: string, near?: GeoPoint): Promise<PlaceSearchResult[]> {
    const matched = SEED_PLACES.filter((p) => p.name.includes(query))
    const base = matched.length > 0 ? matched : SEED_PLACES.slice(0, 5)
    const results = base.map((p, i) => ({
      id: `mock-${hash32(p.name)}-${i}`,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      address: p.name,
      roadAddress: null,
      categoryName: p.category,
    }))
    if (!near) return results
    return results.sort(
      (a, b) => haversineM(near, a) - haversineM(near, b),
    )
  }

  async nearbyByCategory(
    category: CategoryCode,
    at: GeoPoint,
    radiusM: number,
  ): Promise<PlaceHit[]> {
    return seedByCategory(category)
      .map((p) => ({
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        distanceM: Math.round(haversineM(at, p)),
        category: p.category,
      }))
      .filter((p) => p.distanceM <= radiusM)
      .sort((a, b) => a.distanceM - b.distanceM)
  }
}

// ─── Transit ─────────────────────────────────────────────────

/**
 * 거리 기반 결정적 경로 생성.
 * 도심 대중교통 평균 속도(약 25km/h) + 접근·대기 고정시간 8분으로 근사한다.
 */
export class MockTransitProvider implements TransitProvider {
  readonly name = 'mock-transit'

  async route(
    from: GeoPoint,
    to: GeoPoint,
    mode: TransitMode,
  ): Promise<TransitRoute> {
    const km = haversineM(from, to) / 1000
    const key = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}-${to.lat.toFixed(4)},${to.lng.toFixed(4)}-${mode}`
    const h = hash32(key)

    // 모드별 속도 계수: 지하철이 가장 빠르고 버스가 가장 느리다
    const factor = mode === 'SUBWAY' ? 2.1 : mode === 'BUS' ? 3.0 : 2.4
    const overhead = mode === 'BUS' ? 6 : 8
    const totalMinutes = Math.max(5, Math.round(km * factor + overhead))

    const maxTransfers = km < 5 ? 1 : km < 12 ? 2 : 3
    const transferCount = h % (maxTransfers + 1)

    const walkMeters = 300 + (h % 700)
    const pathType: 1 | 2 | 3 = mode === 'SUBWAY' ? 1 : mode === 'BUS' ? 2 : 3

    const modeText = mode === 'SUBWAY' ? '지하철' : mode === 'BUS' ? '버스' : '대중교통'
    const summary =
      transferCount === 0
        ? `${modeText} 직통 · ${km.toFixed(1)}km`
        : `${modeText} 환승 ${transferCount}회 · ${km.toFixed(1)}km`

    return { totalMinutes, transferCount, walkMeters, pathType, summary }
  }
}

// ─── Market ──────────────────────────────────────────────────

/** 법정동별 기준 평단가 (만원/평) */
const BASE_PRICE_PER_PYEONG: Record<string, number> = {
  '11680': 7200, // 강남구
  '11350': 3100, // 노원구
  '41135': 5400, // 성남 분당구
  '11560': 4900, // 영등포구
}
const FALLBACK_PRICE_PER_PYEONG = 3800

const MOCK_APT_NAMES = [
  '래미안 도곡카운티',
  '도곡렉슬',
  '개포우성4차',
  '한신아파트',
  '삼성래미안',
] as const

export class MockMarketProvider implements MarketProvider {
  readonly name = 'mock-market'

  async trades(lawdCd: string, yyyymm: string): Promise<Trade[]> {
    const base = BASE_PRICE_PER_PYEONG[lawdCd] ?? FALLBACK_PRICE_PER_PYEONG
    const areas = [59.9, 74.5, 84.9, 99.6, 114.8]
    const trades: Trade[] = []

    for (let i = 0; i < 24; i++) {
      const h = hash32(`${lawdCd}-${yyyymm}-${i}`)
      const area = areas[h % areas.length]!
      // ±12% 결정적 변동
      const variance = 1 + (((h >> 8) % 240) - 120) / 1000
      const perPyeong = base * variance
      const amount = Math.round(perPyeong * m2ToPyeong(area))
      const day = (h % 28) + 1

      trades.push({
        aptName: MOCK_APT_NAMES[h % MOCK_APT_NAMES.length]!,
        exclusiveM2: area,
        amountManwon: amount,
        dealDate: `${yyyymm.slice(0, 4)}-${yyyymm.slice(4, 6)}-${String(day).padStart(2, '0')}`,
        floor: ((h >> 4) % 25) + 1,
        buildYear: 1995 + ((h >> 6) % 28),
      })
    }
    return trades
  }
}

// ─── AptInfo ─────────────────────────────────────────────────

export class MockAptInfoProvider implements AptInfoProvider {
  readonly name = 'mock-aptinfo'

  async info(aptName: string, lawdCd: string): Promise<AptInfoResult> {
    const h = hash32(`${aptName}-${lawdCd}`)
    return {
      buildYear: 1990 + (h % 33),
      totalHouseholds: 300 + ((h >> 5) % 2200),
      parkingPerHousehold: Math.round((0.7 + ((h >> 9) % 120) / 100) * 100) / 100,
      monthlyFeePerM2: 1800 + ((h >> 13) % 1400),
      regionAvgFeePerM2: 2400,
    }
  }
}

export const mockProviders = {
  geo: new MockGeoProvider(),
  transit: new MockTransitProvider(),
  market: new MockMarketProvider(),
  aptInfo: new MockAptInfoProvider(),
}
