import 'server-only'
/**
 * 세션 쿠키 기반 사용자 식별
 * 설계 근거: docs/02-ARCHITECTURE.md §4
 *
 * 데모 모드(./auth-mode.ts 판정)에서는 데모 쿠키로 방문자별 사용자를 제공한다.
 * 키 없이도 UI 전체를 시연할 수 있게 하기 위한 장치이며, firebase 모드에서는
 * 이 경로가 열리지 않는다.
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminAuth, isFirebaseMode } from './admin'
import { adminErrorLabel, classifyAdminError } from './auth-mode'
import { DEMO_ID } from './session-rules'

export const SESSION_COOKIE = '__session'
export const DEMO_COOKIE = '__demo'
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

export interface SessionUser {
  uid: string
  email: string
  displayName: string
  photoURL: string | null
  isDemo: boolean
}

/**
 * 데모 세션 식별자는 방문자별 난수다 (발급: ./session-rules.ts 의 newDemoId).
 *
 * 예전에는 고정 uid 하나('demo-user')를 썼다. 로컬에서는 문제가 없지만 공개
 * 주소에 올리면 **모든 방문자가 같은 워크스페이스를 공유한다** — A 가 입력한
 * 직장 주소와 후보 단지를 B 가 그대로 보고, B 가 지우면 A 의 것도 사라진다.
 * 이 값은 문서 경로가 되므로 읽을 때도 발급과 같은 DEMO_ID 규칙으로 좁힌다.
 */
function demoUser(id: string): SessionUser {
  return {
    uid: `demo_${id}`,
    email: 'demo@homefit.local',
    displayName: '데모 사용자',
    photoURL: null,
    isDemo: true,
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies()

  if (!isFirebaseMode()) {
    const id = jar.get(DEMO_COOKIE)?.value ?? ''
    return DEMO_ID.test(id) ? demoUser(id) : null
  }

  const cookie = jar.get(SESSION_COOKIE)?.value
  if (!cookie) return null

  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, true)
    return {
      uid: decoded.uid,
      email: decoded.email ?? '',
      displayName: (decoded.name as string | undefined) ?? '사용자',
      photoURL: (decoded.picture as string | undefined) ?? null,
      isDemo: false,
    }
  } catch (e) {
    // 만료·폐기 같은 토큰 문제는 정상적인 비로그인이다. 설정 문제(IAM 권한, projectId
    // 탐지 실패)는 모든 사용자가 로그인 못 하는 장애이므로 로그로 드러낸다.
    // 쿠키 값은 로그에 넣지 않는다.
    if (classifyAdminError(e) === 'config') {
      console.error('[session] config', adminErrorLabel(e))
    }
    return null
  }
}

/**
 * 서버 액션·라우트 핸들러용. 미인증이면 예외를 던진다.
 * 페이지에서는 requireUserOrRedirect 를 쓴다 — 예외가 그대로 500 오류 화면이 되기 때문이다.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new Error('UNAUTHENTICATED')
  return user
}

/** 서버 컴포넌트(페이지)용. 미인증이면 랜딩으로 보낸다. */
export async function requireUserOrRedirect(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect('/')
  return user
}
