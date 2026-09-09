/**
 * 세션 쿠키 발급/삭제
 * 설계 근거: docs/02-ARCHITECTURE.md §4
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { adminAuth, isAdminConfigured } from '@/lib/firebase/admin'
import {
  DEMO_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
} from '@/lib/firebase/session'

const bodySchema = z.object({
  idToken: z.string().min(10).optional(),
  demo: z.literal(true).optional(),
})

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  // 데모 모드 — Firebase 미설정 환경에서 UI 전체를 시연하기 위한 경로
  if (parsed.data.demo) {
    if (isAdminConfigured) {
      return NextResponse.json(
        { error: 'Firebase 가 설정된 환경에서는 데모 모드를 쓸 수 없습니다.' },
        { status: 400 },
      )
    }
    const res = NextResponse.json({ ok: true, mode: 'demo' })
    res.cookies.set(DEMO_COOKIE, '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE_MS / 1000,
    })
    return res
  }

  if (!parsed.data.idToken) {
    return NextResponse.json({ error: 'idToken 이 필요합니다.' }, { status: 400 })
  }
  if (!isAdminConfigured) {
    return NextResponse.json(
      { error: 'Firebase Admin 이 설정되지 않았습니다.' },
      { status: 503 },
    )
  }

  try {
    const sessionCookie = await adminAuth().createSessionCookie(
      parsed.data.idToken,
      { expiresIn: SESSION_MAX_AGE_MS },
    )
    const res = NextResponse.json({ ok: true })
    res.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE_MS / 1000,
    })
    return res
  } catch {
    return NextResponse.json({ error: '인증에 실패했습니다.' }, { status: 401 })
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(SESSION_COOKIE)
  res.cookies.delete(DEMO_COOKIE)
  return res
}
