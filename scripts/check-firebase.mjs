/**
 * Firebase 설정 점검 스크립트.
 *
 * .env.local 에 값을 넣은 뒤 `npm run check:firebase` 로 실행한다.
 * 어떤 값이 비었는지, Admin SDK 가 실제로 붙는지, Firestore 읽기·쓰기가
 * 되는지까지 확인해 콘솔 설정 실수를 조기에 잡는다.
 *
 * 이 스크립트는 임시 문서 하나를 쓰고 곧바로 지운다.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const ENV_FILES = ['.env.local', '.env']

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

const ok = (m) => console.log(`${GREEN}  OK${RESET}  ${m}`)
const fail = (m) => console.log(`${RED}  X ${RESET}  ${m}`)
const warn = (m) => console.log(`${YELLOW}  ! ${RESET}  ${m}`)
const dim = (m) => console.log(`${DIM}      ${m}${RESET}`)

/** .env 파일을 직접 읽는다 — 별도 의존성 없이 동작하게 하기 위함이다. */
function loadEnv() {
  for (const file of ENV_FILES) {
    const path = resolve(ROOT, file)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (value && !process.env[key]) process.env[key] = value
    }
    return file
  }
  return null
}

const WEB_KEYS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
]
const ADMIN_KEYS = [
  'FIREBASE_ADMIN_PROJECT_ID',
  'FIREBASE_ADMIN_CLIENT_EMAIL',
  'FIREBASE_ADMIN_PRIVATE_KEY',
]

let failed = 0

async function main() {
  const envFile = loadEnv()
  console.log(`\nFirebase 설정 점검${envFile ? ` (${envFile})` : ''}\n`)

  if (!envFile) {
    fail('.env.local 파일이 없습니다.')
    dim('cp .env.example .env.local 후 값을 채우십시오.')
    process.exit(1)
  }

  // 1. 웹 SDK 값
  console.log('1) 웹 SDK 설정')
  const missingWeb = WEB_KEYS.filter((k) => !process.env[k])
  if (missingWeb.length === 0) {
    ok(`6개 값 모두 설정됨 (프로젝트: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID})`)
  } else {
    failed++
    fail(`비어 있는 값 ${missingWeb.length}개`)
    missingWeb.forEach((k) => dim(k))
    dim('Firebase Console > 프로젝트 설정 > 내 앱 > 웹 앱 > SDK 설정 및 구성')
  }

  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  if (authDomain && !authDomain.includes('.')) {
    failed++
    fail(`AUTH_DOMAIN 형식이 이상합니다: ${authDomain}`)
    dim('보통 <프로젝트ID>.firebaseapp.com 형태입니다.')
  }

  // 2. Admin SDK 값
  console.log('\n2) Admin SDK 설정')
  const missingAdmin = ADMIN_KEYS.filter((k) => !process.env[k])
  if (missingAdmin.length > 0) {
    failed++
    fail(`비어 있는 값 ${missingAdmin.length}개`)
    missingAdmin.forEach((k) => dim(k))
    dim('Firebase Console > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성')
  } else {
    ok('3개 값 모두 설정됨')

    const pk = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? ''
    if (!pk.includes('BEGIN PRIVATE KEY')) {
      failed++
      fail('PRIVATE_KEY 에 인증서 본문이 없습니다.')
      dim('JSON 의 private_key 값을 통째로 넣어야 합니다.')
    } else if (!pk.includes('\\n') && !pk.includes('\n')) {
      failed++
      fail('PRIVATE_KEY 에 개행이 없습니다.')
      dim('개행을 \\n 으로 이스케이프해 한 줄로 넣으십시오.')
    } else {
      ok('PRIVATE_KEY 형식 정상')
    }

    const webPid = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    const adminPid = process.env.FIREBASE_ADMIN_PROJECT_ID
    if (webPid && adminPid && webPid !== adminPid) {
      failed++
      fail(`프로젝트 ID 불일치 — 웹 ${webPid} / Admin ${adminPid}`)
      dim('같은 Firebase 프로젝트의 값이어야 합니다.')
    }
  }

  if (failed > 0) {
    console.log(`\n${RED}설정값 점검에서 ${failed}건 실패. 연결 테스트를 건너뜁니다.${RESET}\n`)
    process.exit(1)
  }

  // 3. 실제 연결
  console.log('\n3) 연결 테스트')
  let admin
  try {
    admin = await import('firebase-admin/app')
  } catch {
    fail('firebase-admin 을 불러오지 못했습니다. npm install 을 먼저 실행하십시오.')
    process.exit(1)
  }

  const { cert, getApps, initializeApp } = admin
  const { getFirestore } = await import('firebase-admin/firestore')
  const { getAuth } = await import('firebase-admin/auth')

  let app
  try {
    app =
      getApps().length > 0
        ? getApps()[0]
        : initializeApp({
            credential: cert({
              projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
              clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
          })
    ok('Admin SDK 초기화 성공')
  } catch (e) {
    fail(`Admin SDK 초기화 실패: ${e.message}`)
    dim('서비스 계정 키가 이 프로젝트의 것인지 확인하십시오.')
    process.exit(1)
  }

  // Firestore 읽기·쓰기
  const db = getFirestore(app)
  const probe = db.collection('_setup_check').doc('probe')
  try {
    await probe.set({ at: new Date().toISOString(), by: 'check-firebase' })
    const snap = await probe.get()
    if (!snap.exists) throw new Error('쓴 문서를 다시 읽지 못했습니다.')
    await probe.delete()
    ok('Firestore 쓰기·읽기·삭제 성공')
  } catch (e) {
    fail(`Firestore 접근 실패: ${e.message}`)
    if (/NOT_FOUND|5 NOT_FOUND/.test(e.message)) {
      dim('Firestore 데이터베이스가 아직 생성되지 않았을 수 있습니다.')
      dim('Firebase Console > Firestore Database > 데이터베이스 만들기 (asia-northeast3)')
    }
    process.exit(1)
  }

  // Auth 제공자 확인 — 사용자 목록 조회로 접근 권한만 검증한다
  try {
    await getAuth(app).listUsers(1)
    ok('Authentication 접근 성공')
    warn('구글 로그인 제공자 사용 설정 여부는 콘솔에서 직접 확인하십시오.')
    dim('Console > Authentication > Sign-in method > Google > 사용 설정')
    dim('Console > Authentication > Settings > 승인된 도메인 > localhost 포함 확인')
  } catch (e) {
    fail(`Authentication 접근 실패: ${e.message}`)
    dim('Console > Authentication > 시작하기 를 눌러 활성화했는지 확인하십시오.')
    process.exit(1)
  }

  console.log(`\n${GREEN}Firebase 설정 정상. npm run dev 로 구글 로그인을 확인하십시오.${RESET}\n`)
}

main().catch((e) => {
  console.error(`\n${RED}점검 중 오류: ${e.message}${RESET}\n`)
  process.exit(1)
})
