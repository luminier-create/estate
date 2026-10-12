import 'server-only'
/** Firebase Admin SDK — 서버 전용 */
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')

export const isAdminConfigured = Boolean(projectId && clientEmail && privateKey)

let cached: App | null = null

export function getAdminApp(): App {
  if (!isAdminConfigured) {
    throw new Error(
      'Firebase Admin 환경변수가 없습니다. FIREBASE_ADMIN_* 를 설정하십시오.',
    )
  }
  if (cached) return cached
  cached =
    getApps().length > 0
      ? getApps()[0]!
      : initializeApp({
          credential: cert({ projectId, clientEmail, privateKey }),
        })
  return cached
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp())
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp())
}
