import 'server-only'
/**
 * 외부 API 응답 캐시와 일일 쿼터 가드.
 *
 * 외부 API는 모두 무료 티어라 호출 수가 제한된다. 캐시로 재호출을 줄이고,
 * 쿼터 상한에 도달하면 호출을 막아 해당 축만 결측 처리되게 한다
 * (스코어링이 결측을 견디므로 앱 전체가 멈추지 않는다).
 *
 * 설계 근거: docs/02-ARCHITECTURE.md §7
 */
import { store } from './repo/store'
import {
  quotaKey,
  quotaLimit,
  type CachePolicy,
  type QuotaProvider,
} from './cache-keys'

interface CacheDoc<T> {
  key: string
  value: T
  createdAt: string
  /** null 이면 무기한 */
  expiresAt: string | null
  hits: number
}

/**
 * 캐시를 조회하고, 없으면 fn 을 실행해 저장한다.
 * 캐시 계층에서 발생한 오류는 삼키고 원본 호출로 진행한다 —
 * 캐시 문제로 기능이 죽으면 안 된다.
 */
export async function withCache<T>(
  policy: CachePolicy,
  key: string,
  fn: () => Promise<T>,
  ttlOverrideMs?: number | null,
): Promise<T> {
  const path = `${policy.collection}/${key}`

  try {
    const hit = await store().get<CacheDoc<T>>(path)
    if (hit && (hit.expiresAt === null || new Date(hit.expiresAt) > new Date())) {
      // 적중 횟수는 비용 절감 효과를 재는 용도이며 실패해도 무시한다
      void store()
        .update<CacheDoc<T>>(path, { hits: (hit.hits ?? 0) + 1 })
        .catch(() => undefined)
      return hit.value
    }
  } catch {
    // 캐시 조회 실패 — 원본 호출로 진행
  }

  const value = await fn()

  const ttlMs = ttlOverrideMs === undefined ? policy.ttlMs : ttlOverrideMs
  try {
    await store().set<CacheDoc<T>>(path, {
      key,
      value,
      createdAt: new Date().toISOString(),
      expiresAt: ttlMs === null ? null : new Date(Date.now() + ttlMs).toISOString(),
      hits: 0,
    })
  } catch {
    // 캐시 저장 실패 — 결과는 그대로 반환한다
  }

  return value
}

// ─── 쿼터 ────────────────────────────────────────────────────

interface QuotaDoc {
  provider: string
  day: string
  count: number
  updatedAt: string
}

/** 오늘 남은 호출 가능 횟수. 상한을 넘었으면 0. */
export async function remainingQuota(
  provider: QuotaProvider,
): Promise<number> {
  const limit = quotaLimit(provider)
  try {
    const doc = await store().get<QuotaDoc>(`quota/${quotaKey(provider)}`)
    return Math.max(0, limit - (doc?.count ?? 0))
  } catch {
    // 쿼터 조회 실패 시에는 막지 않는다 — 과금이 없는 무료 API 이므로
    // 잘못 막는 쪽이 더 나쁘다
    return limit
  }
}

async function increment(provider: QuotaProvider): Promise<void> {
  const key = quotaKey(provider)
  const path = `quota/${key}`
  try {
    const doc = await store().get<QuotaDoc>(path)
    await store().set<QuotaDoc>(path, {
      provider,
      day: key.split('_')[1] ?? '',
      count: (doc?.count ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    })
  } catch {
    // 카운트 실패는 무시한다
  }
}

export class QuotaExceededError extends Error {
  constructor(readonly provider: QuotaProvider) {
    super(`${provider} 일일 조회 한도에 도달했습니다.`)
    this.name = 'QuotaExceededError'
  }
}

/**
 * 쿼터를 차감하고 fn 을 실행한다. 상한 도달 시 QuotaExceededError 를 던진다.
 * 호출부(analyze 파이프라인)가 이를 잡아 해당 축을 결측 처리한다.
 */
export async function withQuota<T>(
  provider: QuotaProvider,
  fn: () => Promise<T>,
): Promise<T> {
  if ((await remainingQuota(provider)) <= 0) {
    throw new QuotaExceededError(provider)
  }
  await increment(provider)
  return fn()
}

/** 캐시를 먼저 보고, 미적중일 때만 쿼터를 소모한다. */
export async function cachedCall<T>(
  policy: CachePolicy,
  key: string,
  provider: QuotaProvider | null,
  fn: () => Promise<T>,
  ttlOverrideMs?: number | null,
): Promise<T> {
  return withCache(
    policy,
    key,
    provider ? () => withQuota(provider, fn) : fn,
    ttlOverrideMs,
  )
}
