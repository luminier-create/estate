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
  EMPTY_RESULT_TTL_MS,
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

  // 같은 키를 동시에 요청하면 원본을 한 번만 호출한다. 재분석은 같은 법정동의
  // 같은 월을 여러 단지가 동시에 조회하는 형태라, 병합하지 않으면 캐시가
  // 막으려던 바로 그 폭주가 캐시 미적중 순간에 그대로 일어난다.
  const inFlight = pending.get(path)
  if (inFlight) return inFlight as Promise<T>

  const run = load(policy, key, path, fn, ttlOverrideMs)
  pending.set(path, run as Promise<unknown>)
  try {
    return await run
  } finally {
    pending.delete(path)
  }
}

/** 진행 중인 원본 호출. 키당 하나만 돈다. */
const pending = new Map<string, Promise<unknown>>()

async function load<T>(
  policy: CachePolicy,
  key: string,
  path: string,
  fn: () => Promise<T>,
  ttlOverrideMs?: number | null,
): Promise<T> {
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

  const requested = ttlOverrideMs === undefined ? policy.ttlMs : ttlOverrideMs
  const ttlMs = isEmptyResult(value) ? cappedEmptyTtl(requested) : requested
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

/** 관측이 아니라 "아무것도 못 얻었다"에 해당하는 결과인지 */
function isEmptyResult(value: unknown): boolean {
  return value === null || value === undefined || (Array.isArray(value) && value.length === 0)
}

function cappedEmptyTtl(requested: number | null): number {
  return requested === null
    ? EMPTY_RESULT_TTL_MS
    : Math.min(requested, EMPTY_RESULT_TTL_MS)
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

/**
 * 호출 1건을 선점한다. 상한을 넘겼으면 선점을 되돌리고 false 를 돌려준다.
 *
 * 예전에는 "읽어서 남았는지 보고 → 따로 1 올리기" 였다. 그 사이에 다른 요청이
 * 끼어들면 갱신이 통째로 사라져서, 상한 5 에 동시 40건을 던지면 40건이 전부
 * 통과하고 카운터는 1까지만 올라갔다. 분석 파이프라인이 24개월치를 Promise.all
 * 로 동시에 쏘므로 이건 예외 상황이 아니라 정상 경로다.
 */
async function reserve(provider: QuotaProvider): Promise<boolean> {
  const key = quotaKey(provider)
  const path = `quota/${key}`
  const limit = quotaLimit(provider)
  const meta = {
    provider,
    day: key.split('_')[1] ?? '',
    updatedAt: new Date().toISOString(),
  }

  let next: number
  try {
    next = await store().increment(path, 'count', 1, meta)
  } catch {
    // 카운터를 못 쓰면 막지 않는다 — 과금이 없는 무료 API 라 잘못 막는 쪽이 더 나쁘다
    return true
  }

  if (next > limit) {
    await store()
      .increment(path, 'count', -1, meta)
      .catch(() => undefined)
    return false
  }
  return true
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
  if (!(await reserve(provider))) {
    throw new QuotaExceededError(provider)
  }
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
