import { describe, expect, it } from 'vitest'
import {
  CACHE_POLICY,
  DAY_MS,
  coordKey,
  geocodeKey,
  marketKey,
  marketTtl,
  normalizeAddress,
  poiKey,
  quotaKey,
  quotaLimit,
  routeKey,
} from '@/lib/cache-keys'

describe('캐시 키', () => {
  it('좌표를 소수 4자리로 뭉쳐 적중률을 높인다', () => {
    expect(coordKey(37.49794234, 127.02762199)).toBe('37.4979,127.0276')
    // 11m 이내 차이는 같은 키가 되어야 한다
    expect(coordKey(37.497942, 127.027621)).toBe(coordKey(37.49794, 127.02762))
  })

  it('주소 표기 차이가 캐시를 가르지 않는다', () => {
    expect(normalizeAddress('  서울 강남구   도곡동 ')).toBe('서울 강남구 도곡동')
    expect(geocodeKey('kakao', '서울 강남구 도곡동')).toBe(
      geocodeKey('kakao', ' 서울  강남구 도곡동 '),
    )
  })

  it('다른 주소는 다른 키', () => {
    expect(geocodeKey('kakao', '서울 강남구')).not.toBe(
      geocodeKey('kakao', '서울 노원구'),
    )
  })

  it('POI 키는 카테고리·반경까지 구분한다', () => {
    const a = poiKey('kakao', 'SUBWAY', 37.5, 127, 2000)
    expect(a).not.toBe(poiKey('kakao', 'MART', 37.5, 127, 2000))
    expect(a).not.toBe(poiKey('kakao', 'SUBWAY', 37.5, 127, 3000))
  })

  it('경로 키는 방향과 수단을 구분한다', () => {
    const from = { lat: 37.5, lng: 127 }
    const to = { lat: 37.6, lng: 127.1 }
    expect(routeKey('odsay', from, to, 'BUS')).not.toBe(
      routeKey('odsay', to, from, 'BUS'),
    )
    expect(routeKey('odsay', from, to, 'BUS')).not.toBe(
      routeKey('odsay', from, to, 'SUBWAY'),
    )
  })

  it('실거래 키는 법정동·월 단위', () => {
    expect(marketKey('molit', '11680', '202608')).toBe('market_molit_11680_202608')
  })

  it('모의 구현과 실구현이 같은 칸을 쓰지 않는다', () => {
    // 키 없이 배포해 캐시가 찬 뒤 API 키를 넣으면 모의 값이 계속 나오던 문제.
    // geo 는 TTL 이 무기한이라 손으로 지우기 전까지 영원히 그랬다.
    const at = { lat: 37.5, lng: 127 }
    expect(geocodeKey('mock-geo', '서울')).not.toBe(geocodeKey('kakao', '서울'))
    expect(poiKey('mock-geo', 'MART', 37.5, 127, 2000)).not.toBe(
      poiKey('kakao', 'MART', 37.5, 127, 2000),
    )
    expect(routeKey('mock-transit', at, at, 'ALL')).not.toBe(
      routeKey('odsay', at, at, 'ALL'),
    )
    expect(marketKey('mock-market', '11680', '202608')).not.toBe(
      marketKey('molit', '11680', '202608'),
    )
  })

  it('정류장 조회 소스가 바뀌면 키도 바뀐다', () => {
    // ODSAY_API_KEY 유무에 따라 ODsay 정류장 API 와 카카오 키워드 검색이 갈린다.
    expect(poiKey('odsay', 'BUS_STOP', 37.5, 127, 800)).not.toBe(
      poiKey('kakao', 'BUS_STOP', 37.5, 127, 800),
    )
  })
})

describe('실거래 TTL', () => {
  const now = new Date('2026-09-15T00:00:00Z')

  it('최근 두 달은 신고가 계속 들어오므로 짧게 잡는다', () => {
    expect(marketTtl('202609', now)).toBe(DAY_MS)
    expect(marketTtl('202608', now)).toBe(DAY_MS)
    expect(marketTtl('202607', now)).toBe(7 * DAY_MS)
  })

  it('확정된 과거 월은 무기한', () => {
    expect(marketTtl('202603', now)).toBeNull()
    expect(marketTtl('202512', now)).toBeNull()
  })

  it('잘못된 형식은 하루로 방어', () => {
    expect(marketTtl('bad', now)).toBe(DAY_MS)
  })
})

describe('캐시 정책', () => {
  it('지오코딩은 무기한, 나머지는 만료가 있다', () => {
    expect(CACHE_POLICY.geo.ttlMs).toBeNull()
    expect(CACHE_POLICY.poi.ttlMs).toBe(90 * DAY_MS)
    expect(CACHE_POLICY.route.ttlMs).toBe(30 * DAY_MS)
  })

  it('컬렉션 이름이 서로 겹치지 않는다', () => {
    const names = Object.values(CACHE_POLICY).map((p) => p.collection)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('쿼터', () => {
  it('날짜별 키를 만든다', () => {
    expect(quotaKey('molit', new Date('2026-09-09T12:00:00'))).toBe('molit_20260909')
  })

  it('기본 상한은 무료 티어 안쪽', () => {
    // 국토부 개발계정 일 10,000회 — 여유를 둔다
    expect(quotaLimit('molit')).toBeLessThan(10_000)
    expect(quotaLimit('odsay')).toBeGreaterThan(0)
  })
})
