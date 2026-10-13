/**
 * 인증 모드 판정 — firebase(실로그인·Firestore) 인지 demo(무인증·인메모리) 인지.
 *
 * server-only 를 import 하지 않는다. env 를 인자로 받는 순수 함수라 단위 테스트한다
 * (CLAUDE.md 규칙 3). 서버 코드는 전부 이 판정 하나를 따른다 — 저장소·세션·랜딩이
 * 서로 다른 기준을 쓰면 로그인은 Firebase 인데 저장은 메모리로 가는 식으로 갈린다.
 *
 * App Hosting 은 서비스 계정 키 없이 런타임 서비스 계정(ADC)으로 붙는다. ADC 는
 * initializeApp 시점에 성공·실패를 알 수 없어서(첫 API 호출에서야 드러난다)
 * "되면 firebase, 안 되면 demo" 로 고를 수 없다. 그래서 환경 선언으로만 정하고,
 * 애매하면 firebase 쪽으로 닫는다 — demo 가 열리면 공개 주소에서 누구나 로그인 없이
 * 들어온다. 설정이 틀린 firebase 모드는 로그인이 실패할 뿐 데이터가 새지 않는다.
 */
export type AuthMode = 'firebase' | 'demo'
export type AdminCredential = 'cert' | 'adc'

export interface AuthModeResult {
  mode: AuthMode
  /** firebase 모드에서 null 이면 설정 오류다. Admin 호출이 503 으로 끝난다 */
  credential: AdminCredential | null
  /** undefined 면 SDK 가 메타데이터 서버에서 찾는다 */
  projectId: string | undefined
  /** 서버 로그용. 사용자에게 보여주지 않는다 */
  problems: string[]
}

type Env = Readonly<Record<string, string | undefined>>

/** 빈 문자열·공백은 없는 것으로 본다 — .env.example 을 그대로 복사한 경우다 */
function val(env: Env, key: string): string | undefined {
  const v = env[key]?.trim()
  return v ? v : undefined
}

/** firebase-admin 은 '{' 로 시작하지 않으면 파일 경로로 읽는다. 여기서는 JSON 만 다룬다 */
export function projectIdFromFirebaseConfig(raw: string | undefined): string | undefined {
  if (!raw?.trim().startsWith('{')) return undefined
  try {
    const id = (JSON.parse(raw) as { projectId?: unknown }).projectId
    return typeof id === 'string' && id !== '' ? id : undefined
  } catch {
    return undefined
  }
}

export function resolveAuthMode(env: Env): AuthModeResult {
  const problems: string[] = []
  const declared = val(env, 'HOMEFIT_AUTH_MODE')
  const pid = val(env, 'FIREBASE_ADMIN_PROJECT_ID')
  const email = val(env, 'FIREBASE_ADMIN_CLIENT_EMAIL')
  const key = val(env, 'FIREBASE_ADMIN_PRIVATE_KEY')
  // Cloud Run(App Hosting 런타임)이 넣는 값. 운영 서버 위에서는 demo 를 열지 않는다.
  const onCloudRun = Boolean(val(env, 'K_SERVICE'))

  let mode: AuthMode
  if (declared === 'firebase') {
    mode = 'firebase'
  } else if (declared === 'demo') {
    mode = onCloudRun ? 'firebase' : 'demo'
    if (onCloudRun) problems.push('Cloud Run 위에서는 HOMEFIT_AUTH_MODE=demo 를 무시한다')
  } else if (declared) {
    mode = 'firebase'
    problems.push(`알 수 없는 HOMEFIT_AUTH_MODE 값 "${declared}" — firebase 로 닫는다`)
  } else if (
    pid ||
    email ||
    key ||
    onCloudRun ||
    val(env, 'FIREBASE_CONFIG') ||
    val(env, 'FIREBASE_APP_HOSTING')
  ) {
    mode = 'firebase'
  } else {
    mode = 'demo'
  }

  if (mode === 'demo') return { mode, credential: null, projectId: undefined, problems }

  let credential: AdminCredential | null = null
  if (pid && email && key) credential = 'cert' // cert() 는 project_id 가 없으면 거부한다
  else if (!email && !key) credential = 'adc' // PROJECT_ID 만 있으면 ADC 의 프로젝트 지정으로 본다
  else problems.push('FIREBASE_ADMIN_* 가 일부만 설정됐다 — 키 방식도 ADC 도 쓰지 않는다')

  const projectId =
    pid ??
    projectIdFromFirebaseConfig(env.FIREBASE_CONFIG) ??
    val(env, 'GOOGLE_CLOUD_PROJECT') ??
    val(env, 'GCLOUD_PROJECT')

  return { mode, credential, projectId, problems }
}

/**
 * 토큰 문제(401)와 서버 설정 문제(503)를 가른다.
 *
 * 설정 오류까지 401 "인증에 실패했습니다" 로 가리면 IAM 권한 누락 같은 원인을 찾을 수
 * 없다. 모르는 오류는 config 로 본다 — 어느 쪽이든 로그인은 실패하고, 로그만 다르다.
 * 코드 이름은 firebase-admin 13.x `lib/utils/error.js` 에 있는 것이다.
 */
const TOKEN_ERRORS = new Set([
  'auth/argument-error',
  'auth/invalid-id-token',
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/user-disabled',
  'auth/user-not-found',
  'auth/session-cookie-expired',
  'auth/session-cookie-revoked',
])

export function classifyAdminError(e: unknown): 'token' | 'config' {
  const code = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined
  return typeof code === 'string' && TOKEN_ERRORS.has(code) ? 'token' : 'config'
}

/** 로그에 남길 오류 식별자. 쿠키·토큰 값은 담기지 않는다 */
export function adminErrorLabel(e: unknown): string {
  if (typeof e === 'object' && e !== null) {
    const code = (e as { code?: unknown }).code
    if (typeof code === 'string') return code
    const message = (e as { message?: unknown }).message
    if (typeof message === 'string') return message.slice(0, 200)
  }
  return String(e).slice(0, 200)
}
