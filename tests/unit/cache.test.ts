import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  QuotaExceededError,
  cachedCall,
  remainingQuota,
  withCache,
  withQuota,
} from '@/lib/cache'
import { CACHE_POLICY, DAY_MS, quotaLimit } from '@/lib/cache-keys'

/** 인메모리 저장소는 globalThis 에 있으므로 테스트마다 비운다. */
function resetStore() {
  const g = globalThis as { __homefitStore?: Map<string, unknown> }
  g.__homefitStore?.clear()
}

beforeEach(resetStore)

describe('withCache', () => {
  it('두 번째 호출은 원본을 다시 부르지 않는다', async () => {
    const fn = vi.fn(async () => ({ value: 42 }))

    const first = await withCache(CACHE_POLICY.poi, 'k1', fn)
    const second = await withCache(CACHE_POLICY.poi, 'k1', fn)

    expect(first).toEqual({ value: 42 })
    expect(second).toEqual({ value: 42 })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('키가 다르면 각각 호출한다', async () => {
    const fn = vi.fn(async () => 1)
    await withCache(CACHE_POLICY.poi, 'a', fn)
    await withCache(CACHE_POLICY.poi, 'b', fn)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('TTL 이 지나면 다시 호출한다', async () => {
    const fn = vi.fn(async () => 1)
    // 이미 만료된 TTL 로 저장시킨다
    await withCache(CACHE_POLICY.poi, 'expired', fn, -1000)
    await withCache(CACHE_POLICY.poi, 'expired', fn, -1000)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('TTL 이 null 이면 만료되지 않는다', async () => {
    const fn = vi.fn(async () => 1)
    await withCache(CACHE_POLICY.geo, 'forever', fn, null)
    await withCache(CACHE_POLICY.geo, 'forever', fn, null)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('원본이 던진 오류는 캐시하지 않고 그대로 전파한다', async () => {
    const fn = vi.fn(async () => {
      throw new Error('API 오류')
    })
    await expect(withCache(CACHE_POLICY.poi, 'err', fn)).rejects.toThrow('API 오류')
    await expect(withCache(CACHE_POLICY.poi, 'err', fn)).rejects.toThrow('API 오류')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('컬렉션이 다르면 같은 키라도 섞이지 않는다', async () => {
    await withCache(CACHE_POLICY.poi, 'same', async () => 'poi')
    const other = await withCache(CACHE_POLICY.route, 'same', async () => 'route')
    expect(other).toBe('route')
  })
})

describe('withQuota', () => {
  it('상한에 도달하면 호출을 막는다', async () => {
    const limit = quotaLimit('odsay')
    const fn = vi.fn(async () => 'ok')

    for (let i = 0; i < limit; i++) {
      await withQuota('odsay', fn)
    }
    expect(await remainingQuota('odsay')).toBe(0)

    await expect(withQuota('odsay', fn)).rejects.toBeInstanceOf(QuotaExceededError)
    expect(fn).toHaveBeenCalledTimes(limit)
  })

  it('호출할 때마다 잔여가 줄어든다', async () => {
    const limit = quotaLimit('molit')
    await withQuota('molit', async () => 1)
    await withQuota('molit', async () => 1)
    expect(await remainingQuota('molit')).toBe(limit - 2)
  })

  it('Provider 별로 쿼터가 분리된다', async () => {
    await withQuota('kakao', async () => 1)
    expect(await remainingQuota('kakao')).toBe(quotaLimit('kakao') - 1)
    expect(await remainingQuota('molit')).toBe(quotaLimit('molit'))
  })
})

describe('cachedCall', () => {
  it('캐시에 적중하면 쿼터를 쓰지 않는다', async () => {
    const before = await remainingQuota('kakao')
    const fn = vi.fn(async () => 'v')

    await cachedCall(CACHE_POLICY.poi, 'q1', 'kakao', fn)
    const afterFirst = await remainingQuota('kakao')

    await cachedCall(CACHE_POLICY.poi, 'q1', 'kakao', fn)
    const afterSecond = await remainingQuota('kakao')

    expect(afterFirst).toBe(before - 1)
    expect(afterSecond).toBe(afterFirst) // 두 번째는 캐시 적중
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('provider 가 null 이면 (모의 구현) 쿼터를 소모하지 않는다', async () => {
    const before = await remainingQuota('kakao')
    await cachedCall(CACHE_POLICY.poi, 'q2', null, async () => 'v')
    expect(await remainingQuota('kakao')).toBe(before)
  })

  it('실거래 과거 월은 무기한 캐시된다', async () => {
    const fn = vi.fn(async () => [])
    await cachedCall(CACHE_POLICY.market, 'm1', null, fn, null)
    await cachedCall(CACHE_POLICY.market, 'm1', null, fn, null)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('하루짜리 TTL 은 그 안에서 재사용된다', async () => {
    const fn = vi.fn(async () => [])
    await cachedCall(CACHE_POLICY.market, 'm2', null, fn, DAY_MS)
    await cachedCall(CACHE_POLICY.market, 'm2', null, fn, DAY_MS)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('동시 요청', () => {
  it('같은 키 동시 요청은 원본을 한 번만 부른다', async () => {
    let running = 0
    let maxConcurrent = 0
    const fn = vi.fn(async () => {
      running += 1
      maxConcurrent = Math.max(maxConcurrent, running)
      await new Promise((r) => setTimeout(r, 5))
      running -= 1
      return 'v'
    })

    const results = await Promise.all(
      Array.from({ length: 10 }, () => withCache(CACHE_POLICY.market, 'same', fn)),
    )

    expect(results).toEqual(Array(10).fill('v'))
    expect(fn).toHaveBeenCalledTimes(1)
    expect(maxConcurrent).toBe(1)
  })

  it('병합된 요청이 실패하면 전원이 같은 오류를 받고 캐시는 비어 있다', async () => {
    const failing = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 5))
      throw new Error('원본 실패')
    })
    const settled = await Promise.allSettled(
      Array.from({ length: 5 }, () => withCache(CACHE_POLICY.market, 'boom', failing)),
    )
    expect(settled.every((s) => s.status === 'rejected')).toBe(true)
    expect(failing).toHaveBeenCalledTimes(1)

    // 실패는 캐시되지 않으므로 다음 요청은 다시 시도한다
    const ok = await withCache(CACHE_POLICY.market, 'boom', async () => 'recovered')
    expect(ok).toBe('recovered')
  })

  it('동시 요청이 쿼터 상한을 넘기지 못한다', async () => {
    const prev = process.env.QUOTA_ODSAY
    process.env.QUOTA_ODSAY = '5'
    try {
      const fn = vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 1))
        return 'ok'
      })

      const settled = await Promise.allSettled(
        Array.from({ length: 40 }, () => withQuota('odsay', fn)),
      )
      const passed = settled.filter((s) => s.status === 'fulfilled').length

      // 예전에는 read-then-write 라 40건이 전부 통과하고 카운터는 1까지만 올랐다
      expect(passed).toBe(5)
      expect(fn).toHaveBeenCalledTimes(5)
      expect(await remainingQuota('odsay')).toBe(0)
      expect(
        settled.filter((s) => s.status === 'rejected'),
      ).toSatisfy((rejected: PromiseRejectedResult[]) =>
        rejected.every((r) => r.reason instanceof QuotaExceededError),
      )
    } finally {
      if (prev === undefined) delete process.env.QUOTA_ODSAY
      else process.env.QUOTA_ODSAY = prev
    }
  })
})
