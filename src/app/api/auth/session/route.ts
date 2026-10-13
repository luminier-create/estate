/**
 * 세션 쿠키 발급/삭제
 * 설계 근거: docs/02-ARCHITECTURE.md §4
 */
import { NextResponse } from 'next/server'
import { adminAuth, getAuthMode } from '@/lib/firebase/admin'
import { adminErrorLabel, classifyAdminError } from '@/lib/firebase/auth-mode'
import {
  DEMO_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
} from '@/lib/firebase/session'
import { isRecentSignIn, newDemoId, sessionBodySchema } from '@/lib/firebase/session-rules'
import { checkSameOrigin } from '@/lib/http/same-origin'

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_MAX_AGE_MS / 1000,
} as const

export async function POST(req: Request) {
  // 교차 출처 요청은 본문을 읽기 전에 거른다 (login CSRF — src/lib/http/same-origin.ts)
  const guard = checkSameOrigin(req.headers, { requireJson: true })
  if (!guard.ok) {
    console.warn('[auth/session] 거부', guard.reason)
    return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: guard.status })
  }

  const parsed = sessionBodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const { mode } = getAuthMode()

  // 데모 모드 — Firebase 를 쓰지 않는 환경에서 UI 전체를 시연하기 위한 경로
  if ('demo' in parsed.data) {
    if (mode === 'firebase') {
      return NextResponse.json(
        { error: 'Firebase 가 설정된 환경에서는 데모 모드를 쓸 수 없습니다.' },
        { status: 400 },
      )
    }
    const res = NextResponse.json({ ok: true, mode: 'demo' })
    // 방문자마다 다른 값을 준다 — 공개 주소에서 저장 공간을 공유하지 않기 위함이다
    res.cookies.set(DEMO_COOKIE, newDemoId(), COOKIE_OPTIONS)
    return res
  }

  if (mode !== 'firebase') {
    return NextResponse.json(
      { error: 'Firebase Admin 이 설정되지 않았습니다.' },
      { status: 503 },
    )
  }

  try {
    // checkRevoked 없이 부르면 서명·클레임만 검증한다 (공개키 조회는 무인증)
    const decoded = await adminAuth().verifyIdToken(parsed.data.idToken)
    if (!isRecentSignIn(decoded.auth_time, Date.now())) {
      return NextResponse.json({ error: '다시 로그인해 주십시오.' }, { status: 401 })
    }
    const sessionCookie = await adminAuth().createSessionCookie(parsed.data.idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    })
    const res = NextResponse.json({ ok: true })
    res.cookies.set(SESSION_COOKIE, sessionCookie, COOKIE_OPTIONS)
    return res
  } catch (e) {
    // 토큰 문제는 401, 서버 설정 문제(IAM 권한·projectId 탐지 실패)는 503 으로 가른다.
    // 둘 다 401 로 가리면 배포 설정 오류를 사용자 잘못으로 오인한다.
    const kind = classifyAdminError(e)
    console.error(`[auth/session] ${kind}`, adminErrorLabel(e))
    return kind === 'token'
      ? NextResponse.json({ error: '인증에 실패했습니다.' }, { status: 401 })
      : NextResponse.json(
          { error: '로그인 서버 설정에 문제가 있습니다. 잠시 후 다시 시도해 주십시오.' },
          { status: 503 },
        )
  }
}

export async function DELETE(req: Request) {
  // 로그아웃은 본문 없이 온다 (client.ts). 출처만 본다.
  const guard = checkSameOrigin(req.headers, { requireJson: false })
  if (!guard.ok) {
    return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(SESSION_COOKIE)
  res.cookies.delete(DEMO_COOKIE)
  return res
}
