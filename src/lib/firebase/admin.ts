import 'server-only'
/**
 * Firebase Admin SDK — 서버 전용
 *
 * 자격증명은 두 가지다 (판정: ./auth-mode.ts).
 * - cert: FIREBASE_ADMIN_* 세 값 (로컬·Vercel)
 * - adc : 서비스 계정 키 없이 런타임 서비스 계정 (Firebase App Hosting)
 *
 * 판정은 지연 평가한다. 모듈 최상위에서 env 를 읽어 상수로 굳히면 next build 시점의
 * 값이 박히거나, 판정 실패가 import 단계 예외로 번진다.
 */
import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { resolveAuthMode, type AuthModeResult } from './auth-mode'

let modeCache: AuthModeResult | null = null

export function getAuthMode(): AuthModeResult {
  if (!modeCache) {
    modeCache = resolveAuthMode(process.env)
    for (const p of modeCache.problems) console.error(`[auth-mode] ${p}`)
  }
  return modeCache
}

export function isFirebaseMode(): boolean {
  return getAuthMode().mode === 'firebase'
}

export class AdminConfigError extends Error {
  /** classifyAdminError 에서 config 로 분류된다 */
  readonly code = 'homefit/admin-config'
}

let cached: App | null = null

export function getAdminApp(): App {
  if (cached) return cached
  const m = getAuthMode()
  if (m.mode !== 'firebase') {
    throw new AdminConfigError('데모 모드에서는 Firebase Admin 을 쓰지 않습니다.')
  }
  if (!m.credential) {
    throw new AdminConfigError('Firebase Admin 자격증명 설정이 불완전합니다. [auth-mode] 로그를 확인하십시오.')
  }
  // 무인자 initializeApp() 과 옵션 호출을 섞으면 "already exists with a different
  // configuration" 이 난다. 항상 명시 옵션 경로로 만든다 — 그래서 FIREBASE_CONFIG 는
  // SDK 가 아니라 resolveAuthMode 가 직접 읽어 projectId 로 넘긴다.
  cached =
    getApps()[0] ??
    initializeApp({
      credential:
        m.credential === 'cert'
          ? cert({
              projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
              clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            })
          : applicationDefault(),
      // undefined 면 키를 넣지 않는다 — SDK 가 메타데이터 서버에서 찾는다
      ...(m.projectId ? { projectId: m.projectId } : {}),
    })
  return cached
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp())
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp())
}
