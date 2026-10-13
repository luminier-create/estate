/**
 * Firebase 웹 설정을 빌드 환경에서 NEXT_PUBLIC_FIREBASE_* 로 옮긴다.
 *
 * next.config.ts 가 import 하므로 외부 의존성 없이 상대경로만 쓴다(./auth-mode 도 순수
 * 모듈이다). 단위 테스트 대상이다.
 *
 * App Hosting 은 백엔드에 웹 앱이 연결돼 있으면 **빌드 때만** FIREBASE_WEBAPP_CONFIG
 * (JSON)를 넣는다. 이 값들은 공개 값이라 비밀로 둘 이유가 없고, 사용자가 콘솔에서
 * 옮겨 적다 틀릴 일도 없앤다. 값은 번들에 굳으므로 웹 앱 설정을 바꾸면 다시 빌드한다.
 */
import { resolveAuthMode } from './auth-mode'

type Env = Readonly<Record<string, string | undefined>>

const MAP = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'apiKey',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'authDomain',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'projectId',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'storageBucket',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: 'messagingSenderId',
  NEXT_PUBLIC_FIREBASE_APP_ID: 'appId',
} as const

/** 브라우저에서 구글 로그인을 띄우는 데 없으면 안 되는 값 */
const REQUIRED = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
] as const

function filled(v: string | undefined): v is string {
  return typeof v === 'string' && v.trim() !== ''
}

export function webEnvFromAppHosting(env: Env): {
  env: Record<string, string>
  missing: string[]
  parseError: boolean
} {
  let src: Record<string, unknown> = {}
  let parseError = false
  const raw = env.FIREBASE_WEBAPP_CONFIG
  if (filled(raw)) {
    try {
      const v: unknown = JSON.parse(raw)
      if (v && typeof v === 'object') src = v as Record<string, unknown>
    } catch {
      parseError = true
    }
  }
  const out: Record<string, string> = {}
  for (const [key, field] of Object.entries(MAP)) {
    // .env.local·콘솔에서 명시한 값이 이긴다. next.config 의 env 는 .env 파일보다
    // 우선하므로 여기서 덮어쓰면 명시한 값이 무시된다.
    if (filled(env[key])) continue
    const v = src[field]
    if (typeof v === 'string' && v !== '') out[key] = v
  }
  const missing = REQUIRED.filter((k) => !filled(env[k]) && !(k in out))
  return { env: out, missing, parseError }
}

/**
 * firebase 모드로 빌드하는데 웹 설정이 비면 null 이 아닌 메시지를 돌려준다.
 *
 * 그대로 배포되면 로그인 버튼은 뜨는데 누르면 브라우저 초기화가 실패한다. 깨진 채로
 * 배포되는 것보다 빌드가 멈추는 편이 원인을 찾기 쉽다. 판정은 런타임과 같은
 * resolveAuthMode 를 쓴다 — 기준이 다르면 런타임은 firebase 인데 가드를 건너뛴다.
 * next.config 는 `next dev` 에서도 평가되므로 개발 서버도 같은 조건에서 멈춘다.
 */
export function webConfigBuildError(env: Env): string | null {
  if (resolveAuthMode(env).mode !== 'firebase') return null
  const r = webEnvFromAppHosting(env)
  if (r.missing.length === 0) return null
  return (
    `Firebase 웹 설정이 없습니다 (${r.missing.join(', ')}). ` +
    'App Hosting 백엔드에 웹 앱이 연결돼 있는지 확인하십시오.' +
    (r.parseError ? ' FIREBASE_WEBAPP_CONFIG 를 JSON 으로 읽지 못했습니다.' : '')
  )
}
