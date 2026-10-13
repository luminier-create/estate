/**
 * 세션 발급 규칙 — 순수 함수. server-only 밖에 두어 단위 테스트한다 (CLAUDE.md 규칙 3).
 */
import { z } from 'zod'

/**
 * 데모 세션 식별자 형식.
 *
 * 이 값은 문서 경로(`users/demo_<id>/...`)가 되므로 **발급할 때와 읽을 때 같은
 * 규칙으로 좁힌다.** 형식에 맞지 않으면 세션이 없는 것으로 본다 — 쿠키는 사용자가
 * 고칠 수 있는 입력이다.
 */
export const DEMO_ID = /^[a-z0-9]{8,32}$/

/**
 * 128비트 암호학적 난수, 32자 [0-9a-f].
 *
 * 예전에는 Date.now() + Math.random() 이었다. 서명이 없는 쿠키 값이 곧 저장 공간의
 * 열쇠이므로 예측할 수 없어야 한다 (Math.random 은 암호용 난수가 아니다).
 */
export function newDemoId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 세션 쿠키는 최근 5분 안에 로그인한 ID 토큰으로만 발급한다.
 *
 * Firebase 공식 세션 쿠키 예제와 같은 기준이다. ID 토큰(유효 1시간)을 탈취해도
 * 14일짜리 세션으로 바꾸기 어렵게 한다. auth_time 은 초 단위다.
 */
export const RECENT_SIGN_IN_SEC = 5 * 60

export function isRecentSignIn(authTimeSec: number, nowMs: number): boolean {
  return Number.isFinite(authTimeSec) && nowMs / 1000 - authTimeSec < RECENT_SIGN_IN_SEC
}

/**
 * strict — `<form enctype="text/plain">` 이 JSON 을 흉내 내려고 끼워 넣는 여분 키
 * (`{"idToken":"…","x":"="}` 의 "x")를 거부한다. idToken 과 demo 를 동시에 받지 않는다.
 */
export const sessionBodySchema = z.union([
  z.object({ idToken: z.string().min(10).max(16_384) }).strict(),
  z.object({ demo: z.literal(true) }).strict(),
])
