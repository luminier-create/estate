import 'server-only'
/**
 * 세션 쿠키 기반 사용자 식별
 * 설계 근거: docs/02-ARCHITECTURE.md §4
 *
 * Firebase Admin 이 설정되지 않은 환경에서는 데모 쿠키로 고정 사용자를 제공한다.
 * 키 없이도 UI 전체를 시연할 수 있게 하기 위한 장치이며, 프로덕션에서는
 * isAdminConfigured 가 true 이므로 이 경로가 열리지 않는다.
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminAuth, isAdminConfigured } from './admin'

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

const DEMO_USER: SessionUser = {
  uid: 'demo-user',
  email: 'demo@homefit.local',
  displayName: '데모 사용자',
  photoURL: null,
  isDemo: true,
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies()

  if (!isAdminConfigured) {
    return jar.get(DEMO_COOKIE)?.value === '1' ? DEMO_USER : null
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
  } catch {
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
