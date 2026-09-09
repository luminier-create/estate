/**
 * 캐시 키와 TTL 정책.
 * 설계 근거: docs/02-ARCHITECTURE.md §7
 *
 * 순수 함수만 두어 server-only 경계 밖에서 단위 테스트할 수 있게 한다.
 */
import { shortHash } from './utils'

export const DAY_MS = 24 * 60 * 60 * 1000

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

export function geocodeKey(address: string): string {
  return `geo_${shortHash(normalizeAddress(address))}`
}

export function poiKey(
  category: string,
  lat: number,
  lng: number,
  radiusM: number,
): string {
  return `poi_${category}_${coordKey(lat, lng)}_${radiusM}`
}

export function routeKey(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: string,
): string {
  return `route_${coordKey(from.lat, from.lng)}_${coordKey(to.lat, to.lng)}_${mode}`
}

export function marketKey(lawdCd: string, yyyymm: string): string {
  return `market_${lawdCd}_${yyyymm}`
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
