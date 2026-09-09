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
  UNKNOWN_RESULT_TTL_MS,
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
  const ttlMs = isUnknownResult(value) ? cappedUnknownTtl(requested) : requested
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

/**
 * "조회는 됐는데 결과가 없다"와 "얻지 못했다"를 구분한다.
 *
 * 빈 배열은 이제 믿을 수 있다 — 장애를 빈 결과로 오인하던 경로는 provider 에서
 * 막았다(카카오 키워드 전부 실패 시 throw, 국토부 응답 형식 오류 시 throw).
 * 그리고 "주변에 유흥시설 없음"은 조용한 주거지의 가장 흔하고 가장 좋은 답이다.
 * 그것까지 1시간마다 다시 물으면 캐시가 막으려던 호출을 오히려 늘린다.
 *
 * 반면 `null` 은 여전히 모호하다. ODsay 는 "경로 없음"과 API 오류를 둘 다 null
 * 로 돌려주므로, 일시 장애가 30일 결측으로 굳지 않도록 짧게 잡는다.
 */
function isUnknownResult(value: unknown): boolean {
  return value === null || value === undefined
}

function cappedUnknownTtl(requested: number | null): number {
  return requested === null
    ? UNKNOWN_RESULT_TTL_MS
    : Math.min(requested, UNKNOWN_RESULT_TTL_MS)
}

// ─── 쿼터 ────────────────────────────────────────────────────

interface QuotaDoc {
  provider: string
  day: string
  count: number
  updatedAt: string
}

/**
 * 이 프로세스가 오늘 선점한 건수. provider·날짜별로 하나씩 둔다.
 *
 * 상한 판정을 프로세스 안에서 먼저 하는 이유: 분석 한 번이 24개월치 실거래와
 * POI 9종을 `Promise.all` 로 동시에 쏘고, 전체 재분석은 그걸 단지 수만큼
 * 곱한다. 이 동시성은 거의 전부 한 인스턴스 안에서 발생하므로, 여기서 세면
 * 저장소 왕복 없이 정확히 막힌다.
 *
 * 인스턴스가 여러 개면 각자 세므로 상한을 인스턴스 수만큼 넘길 수 있다.
 * 그 초과분은 유계이고, 무료 API 라 "잘못 막는 쪽이 더 나쁘다"는 판단에 맞는다.
 * 원격 카운터는 원자적 증가로 정확히 유지되므로 실제 사용량은 항상 볼 수 있다.
 *
 * 값이 Promise 인 것은 최초 원격 읽기를 동시 호출들이 공유하게 하기 위함이다.
 */
const quotaState = new Map<string, Promise<{ count: number }>>()

function stateFor(key: string, path: string): Promise<{ count: number }> {
  const existing = quotaState.get(key)
  if (existing) return existing

  const created = (async () => {
    try {
      const doc = await store().get<QuotaDoc>(path)
      const n = Number(doc?.count ?? 0)
      return { count: Number.isFinite(n) && n > 0 ? n : 0 }
    } catch {
      // 못 읽으면 0에서 시작한다 — 막는 쪽으로 실패하지 않는다
      return { count: 0 }
    }
  })()

  // await 전에 넣어야 동시 호출이 같은 promise 를 본다
  quotaState.set(key, created)
  // 날짜가 바뀌면 지난 키는 필요 없다
  for (const k of quotaState.keys()) {
    if (k !== key && k.startsWith(`${key.split('_')[0]}_`)) quotaState.delete(k)
  }
  return created
}

/** 오늘 남은 호출 가능 횟수. 상한을 넘었으면 0. */
export async function remainingQuota(
  provider: QuotaProvider,
): Promise<number> {
  const key = quotaKey(provider)
  const limit = quotaLimit(provider)
  const state = await stateFor(key, `quota/${key}`)
  return Math.max(0, limit - state.count)
}

/**
 * 호출 1건을 선점한다. 상한에 도달했으면 false.
 *
 * 예전에는 "읽어서 남았는지 보고 → 따로 1 올리기" 였다. 그 사이에 다른 요청이
 * 끼어들면 갱신이 통째로 사라져서, 상한 5 에 동시 40건을 던지면 40건이 전부
 * 통과하고 카운터는 1까지만 올라갔다. 그 다음에는 트랜잭션으로 고쳤는데,
 * 외부 호출 1건마다 같은 문서에 트랜잭션을 걸어 단일 문서가 병목이 되고
 * 경합으로 실패하면 통과시키는 — 붐빌수록 상한이 풀리는 — 구조가 됐다.
 * 지금은 판정을 프로세스 안에서 하고 원격에는 읽지 않는 원자적 증가만 보낸다.
 */
async function reserve(provider: QuotaProvider): Promise<boolean> {
  const key = quotaKey(provider)
  const path = `quota/${key}`
  const limit = quotaLimit(provider)

  const state = await stateFor(key, path)
  if (state.count >= limit) return false
  state.count += 1

  try {
    await store().increment(path, 'count', 1, {
      provider,
      day: key.split('_')[1] ?? '',
      updatedAt: new Date().toISOString(),
    })
  } catch {
    // 원격 기록이 실패해도 프로세스 카운터는 이미 올라가 있어 상한은 지켜진다.
    // 사용량 집계만 부정확해진다.
  }
  return true
}

/** 테스트에서 프로세스 상태를 비운다. 저장소를 비우는 것만으로는 부족하다. */
export function __resetQuotaState(): void {
  quotaState.clear()
  pending.clear()
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
