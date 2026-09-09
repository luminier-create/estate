'use client'
/** Firebase 클라이언트 SDK — 브라우저 전용 */
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  browserPopupRedirectResolver,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type Auth,
} from 'firebase/auth'

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId)

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error(
      'Firebase 환경변수가 설정되지 않았습니다. .env.local 을 확인하십시오.',
    )
  }
  return getApps().length > 0 ? getApp() : initializeApp(config)
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp())
}

/**
 * 구글 로그인 → ID 토큰을 서버로 보내 세션 쿠키를 발급받는다.
 * 서버 컴포넌트에서 사용자를 식별하려면 쿠키가 필요하다.
 */
export async function signInWithGoogle(): Promise<void> {
  const auth = getFirebaseAuth()
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })

  let idToken: string
  try {
    const cred = await signInWithPopup(auth, provider, browserPopupRedirectResolver)
    idToken = await cred.user.getIdToken()
  } catch (e) {
    // 모바일 브라우저에서 팝업이 차단되면 리다이렉트로 폴백한다
    const code = (e as { code?: string }).code ?? ''
    if (code.includes('popup')) {
      await signInWithRedirect(auth, provider)
      return
    }
    throw e
  }

  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  if (!res.ok) throw new Error('세션 생성에 실패했습니다.')
}

export async function signOut(): Promise<void> {
  await fetch('/api/auth/session', { method: 'DELETE' })
  if (isFirebaseConfigured) await fbSignOut(getFirebaseAuth())
}
