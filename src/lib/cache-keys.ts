/**
 * 캐시 키와 TTL 정책.
 * 설계 근거: docs/02-ARCHITECTURE.md §7
 *
 * 순수 함수만 두어 server-only 경계 밖에서 단위 테스트할 수 있게 한다.
 */
import { shortHash } from './utils'

export const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 결과를 얻지 못한 경우(`null`)의 최대 캐시 수명.
 *
 * ODsay 는 "그 수단으로는 경로가 없음"과 API 오류를 둘 다 null 로 돌려준다.
 * 이 값이 정책 TTL(경로 30일)로 굳으면 일시적 장애 한 번이 COMMUTE 축을 30일
 * 결측으로 만들고, 캐시를 손으로 지우기 전까지 자동 복구되지 않는다.
 *
 * 성공한 빈 결과(`[]`)에는 적용하지 않는다 — "주변에 없음"은 정상 관측이고,
 * 그것까지 매시간 다시 물으면 캐시가 막으려던 호출을 오히려 늘린다.
 */
export const UNKNOWN_RESULT_TTL_MS = 60 * 60 * 1000

/** TTL이 null 이면 무기한이다. */
export interface CachePolicy {
  collection: string
  ttlMs: number | null
}

/** 좌표를 소수 4자리(약 11m)로 뭉쳐 캐시 적중률을 높인다. */
export function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}

/** 주소 문자열 정규화 — 공백 차이로 캐시가 갈리지 않게 한다. */
export function normalizeAddress(address: string): string {
  return address.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * 어느 구현이 만든 값인지를 모든 키에 박는다.
 *
 * 이게 없으면 모의 데이터와 실데이터가 같은 칸을 쓴다. 키 없이 배포해 캐시가
 * 채워진 뒤 API 키를 넣으면 모의 값이 계속 나오고, geo 는 TTL 이 무기한이라
 * 영원히 그렇다. 정류장 조회처럼 키 유무에 따라 소스가 바뀌는 경로도 마찬가지다.
 */
function sourceTag(source: string): string {
  return source.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
}

export function geocodeKey(source: string, address: string): string {
  return `geo_${sourceTag(source)}_${shortHash(normalizeAddress(address))}`
}

export function poiKey(
  source: string,
  category: string,
  lat: number,
  lng: number,
  radiusM: number,
): string {
  return `poi_${sourceTag(source)}_${category}_${coordKey(lat, lng)}_${radiusM}`
}

export function routeKey(
  source: string,
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: string,
): string {
  return `route_${sourceTag(source)}_${coordKey(from.lat, from.lng)}_${coordKey(to.lat, to.lng)}_${mode}`
}

export function marketKey(
  source: string,
  lawdCd: string,
  yyyymm: string,
): string {
  return `market_${sourceTag(source)}_${lawdCd}_${yyyymm}`
}

/**
 * 실거래 TTL — 과거 월의 확정 데이터는 변하지 않지만, 최근 두 달은
 * 신고 기한(계약일로부터 30일) 때문에 계속 채워지므로 짧게 잡는다.
 */
export function marketTtl(yyyymm: string, now = new Date()): number | null {
  const year = Number(yyyymm.slice(0, 4))
  const month = Number(yyyymm.slice(4, 6))
  if (!Number.isFinite(year) || !Number.isFinite(month)) return DAY_MS

  const monthsAgo =
    (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month)

  if (monthsAgo <= 1) return DAY_MS // 아직 신고가 들어오는 중
  if (monthsAgo <= 2) return 7 * DAY_MS
  return null // 확정된 과거 데이터
}

export const CACHE_POLICY = {
  geo: { collection: 'cache_geo', ttlMs: null },
  poi: { collection: 'cache_poi', ttlMs: 90 * DAY_MS },
  route: { collection: 'cache_route', ttlMs: 30 * DAY_MS },
  market: { collection: 'cache_market', ttlMs: DAY_MS },
} as const satisfies Record<string, CachePolicy>

// ─── 쿼터 ────────────────────────────────────────────────────

export type QuotaProvider = 'kakao' | 'molit' | 'odsay'

/**
 * 일일 호출 상한.
 * 국토부 개발계정은 일 10,000회이며, 여유를 두고 잡는다.
 * ODsay 무료 티어 상한은 콘솔에서 확인해야 하므로 보수적으로 설정한다.
 */
export const DEFAULT_QUOTA: Record<QuotaProvider, number> = {
  kakao: 30_000,
  molit: 9_000,
  odsay: 800,
}

export function quotaLimit(provider: QuotaProvider): number {
  const fromEnv = Number(process.env[`QUOTA_${provider.toUpperCase()}`])
  return Number.isFinite(fromEnv) && fromEnv > 0
    ? fromEnv
    : DEFAULT_QUOTA[provider]
}

export function quotaKey(provider: QuotaProvider, now = new Date()): string {
  const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  return `${provider}_${day}`
}
