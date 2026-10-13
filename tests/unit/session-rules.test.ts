import { describe, expect, it } from 'vitest'
import {
  DEMO_ID,
  isRecentSignIn,
  newDemoId,
  RECENT_SIGN_IN_SEC,
  sessionBodySchema,
} from '@/lib/firebase/session-rules'

describe('newDemoId', () => {
  it('발급한 값은 전부 읽기 규칙(DEMO_ID)에 맞고 서로 겹치지 않는다', () => {
    const ids = Array.from({ length: 1000 }, newDemoId)
    for (const id of ids) expect(id).toMatch(DEMO_ID)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('32자 16진수 (128비트)', () => {
    expect(newDemoId()).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('isRecentSignIn', () => {
  const now = 1_800_000_000_000
  const sec = now / 1000

  it(`${RECENT_SIGN_IN_SEC}초 미만이면 통과, 이상이면 거부`, () => {
    expect(isRecentSignIn(sec - 299, now)).toBe(true)
    expect(isRecentSignIn(sec - 300, now)).toBe(false)
    expect(isRecentSignIn(sec - 3600, now)).toBe(false)
  })

  it('계산할 수 없는 값은 거부한다', () => {
    expect(isRecentSignIn(Number.NaN, now)).toBe(false)
    expect(isRecentSignIn(Number.POSITIVE_INFINITY, now)).toBe(false)
  })
})

describe('sessionBodySchema', () => {
  it('idToken 하나 또는 demo:true 하나만 받는다', () => {
    expect(sessionBodySchema.safeParse({ idToken: 'x'.repeat(20) }).success).toBe(true)
    expect(sessionBodySchema.safeParse({ demo: true }).success).toBe(true)
  })

  it('text/plain 폼이 끼워 넣는 여분 키를 거부한다', () => {
    expect(sessionBodySchema.safeParse({ demo: true, x: '=' }).success).toBe(false)
    expect(sessionBodySchema.safeParse({ idToken: 'x'.repeat(20), x: '=' }).success).toBe(false)
  })

  it('둘을 함께 보내거나 형식이 다르면 거부한다', () => {
    expect(sessionBodySchema.safeParse({ idToken: 'x'.repeat(20), demo: true }).success).toBe(false)
    expect(sessionBodySchema.safeParse({ demo: false }).success).toBe(false)
    expect(sessionBodySchema.safeParse({ idToken: 'short' }).success).toBe(false)
    expect(sessionBodySchema.safeParse(null).success).toBe(false)
  })
})
