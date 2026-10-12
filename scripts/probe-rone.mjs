/**
 * R-ONE(한국부동산원 부동산통계정보) 응답 스키마 탐침 스크립트.
 *
 * 왜 이런 형태인가 — 이 저장소를 개발하는 환경에서는 reb.or.kr 로 나가는 통신이
 * 조직 egress 정책에 막혀 있다(docs/10-KNOWLEDGE.md §1.6). 즉 응답을 눈으로
 * 확인할 수 없고, 그 상태에서 필드명·엔드포인트를 코드에 넣는 것은 CLAUDE.md 가
 * 금지하는 방식이다. 그래서 네트워크가 열린 쪽(사용자 로컬)에서 한 번 찔러본
 * 결과로 어댑터를 만든다.
 *
 * 사용법:
 *   1. .env.local 에 REB_API_KEY=... 를 넣는다
 *   2. R-ONE 개발가이드 페이지의 "요청 예시 URL" 을 통째로 복사해 인자로 넘긴다
 *
 *      npm run probe:rone -- "https://.../…?KEY=인증키&STATBL_ID=...&..."
 *
 * 출력은 응답 **구조**(경로·타입·표본값)와 저장된 원본 파일 경로다.
 * 인증키는 어떤 출력에도 찍지 않는다.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const OUT_DIR = resolve(ROOT, '.probe')

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
  for (const file of ['.env.local', '.env']) {
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

/** 문서 예시 URL 에 들어 있는 키 자리를 실제 키로 바꾼다. */
const PLACEHOLDER = /^(인증키|발급받은[_ ]?키|서비스키|YOUR[_-]?KEY|KEY|API[_-]?KEY|xxx+|\.\.\.)$/i
const KEY_PARAM = /(^|_)(key|apikey|servicekey|인증키)($|_)/i

function injectKey(rawUrl, apiKey) {
  const url = new URL(rawUrl)
  let target = null

  // 1순위: 값이 자리표시자인 파라미터
  for (const [name, value] of url.searchParams) {
    if (PLACEHOLDER.test(value.trim())) { target = name; break }
  }
  // 2순위: 이름이 키처럼 생긴 파라미터
  if (!target) {
    for (const [name] of url.searchParams) {
      if (KEY_PARAM.test(name)) { target = name; break }
    }
  }
  if (!target) return { url, keyParam: null }

  url.searchParams.set(target, apiKey)
  return { url, keyParam: target }
}

/** 로그·출력용. 키 값을 절대 노출하지 않는다. */
function redact(url, keyParam) {
  const clone = new URL(url.toString())
  if (keyParam) clone.searchParams.set(keyParam, '<REDACTED>')
  return clone.toString()
}

/**
 * 응답 구조를 요약한다. 값 자체가 아니라 **경로·타입·표본**을 뽑는 것이 목적이다 —
 * 어댑터를 쓰려면 "어떤 필드가 어떤 타입으로 오는가"만 알면 되고,
 * 전문을 그대로 옮기면 읽는 쪽이 감당이 안 된다.
 */
function summarize(value, path = '$', out = [], depth = 0) {
  if (depth > 6) return out

  if (Array.isArray(value)) {
    out.push({ path: `${path}[]`, type: `array(${value.length})`, sample: '' })
    if (value.length > 0) summarize(value[0], `${path}[0]`, out, depth + 1)
    return out
  }
  if (value !== null && typeof value === 'object') {
    out.push({ path, type: 'object', sample: Object.keys(value).join(', ').slice(0, 120) })
    for (const [k, v] of Object.entries(value)) {
      summarize(v, `${path}.${k}`, out, depth + 1)
    }
    return out
  }

  const type = value === null ? 'null' : typeof value
  const sample = value === null ? '' : String(value).slice(0, 60)
  out.push({ path, type, sample })
  return out
}

function printTable(rows) {
  const w1 = Math.max(4, ...rows.map((r) => r.path.length))
  const w2 = Math.max(4, ...rows.map((r) => r.type.length))
  console.log(`\n  ${'경로'.padEnd(w1)}  ${'타입'.padEnd(w2)}  표본값`)
  console.log(`  ${'-'.repeat(w1)}  ${'-'.repeat(w2)}  ${'-'.repeat(30)}`)
  for (const r of rows) {
    console.log(`  ${r.path.padEnd(w1)}  ${r.type.padEnd(w2)}  ${r.sample}`)
  }
}

async function main() {
  const rawUrl = process.argv[2]
  if (!rawUrl) {
    fail('요청 URL 을 인자로 넘기십시오.')
    dim('R-ONE 개발가이드의 "요청 예시" URL 을 통째로 복사해 따옴표로 감싸 전달합니다.')
    dim('npm run probe:rone -- "https://.../…?KEY=인증키&STATBL_ID=…"')
    process.exit(1)
  }

  const envFile = loadEnv()
  const apiKey = process.env.REB_API_KEY
  console.log(`\nR-ONE 응답 스키마 탐침${envFile ? ` (${envFile})` : ''}\n`)

  if (!apiKey) {
    fail('REB_API_KEY 가 없습니다.')
    dim('.env.local 에 REB_API_KEY=발급받은키 를 넣으십시오. 이 파일은 git 에 올라가지 않습니다.')
    process.exit(1)
  }
  ok(`REB_API_KEY 확인 (${apiKey.length}자)`)

  let url, keyParam
  try {
    ;({ url, keyParam } = injectKey(rawUrl, apiKey))
  } catch {
    fail(`URL 형식이 올바르지 않습니다: ${rawUrl.slice(0, 80)}`)
    process.exit(1)
  }

  if (keyParam) ok(`인증키 파라미터: ${keyParam}`)
  else warn('키 파라미터를 찾지 못해 URL 을 그대로 호출합니다. 예시 URL 에 키 자리가 있는지 확인하십시오.')

  dim(redact(url, keyParam))

  let res, body
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
      headers: { Accept: 'application/json, text/xml;q=0.9, */*;q=0.8' },
    })
    body = await res.text()
  } catch (e) {
    fail(`호출 실패: ${e.message}`)
    dim('네트워크가 막혀 있거나 호스트에 닿지 못했습니다.')
    process.exit(1)
  }

  const contentType = res.headers.get('content-type') ?? '(없음)'
  console.log(`\n  HTTP ${res.status} · ${contentType} · ${body.length.toLocaleString('ko-KR')} bytes`)

  if (!res.ok) {
    fail(`오류 응답입니다. 본문 앞부분:`)
    console.log(body.slice(0, 600))
    process.exit(1)
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const isJson = body.trimStart().startsWith('{') || body.trimStart().startsWith('[')
  const rawPath = resolve(OUT_DIR, `rone-${stamp}.${isJson ? 'json' : 'xml'}`)
  writeFileSync(rawPath, body, 'utf8')
  ok(`원본 저장: ${rawPath}`)

  if (!isJson) {
    warn('JSON 이 아닙니다 (XML 로 보입니다). 구조 요약 대신 앞부분을 출력합니다.')
    console.log(`\n${body.slice(0, 2000)}`)
    console.log('\n위 출력과 저장된 파일을 그대로 전달해 주십시오.')
    return
  }

  let parsed
  try {
    parsed = JSON.parse(body)
  } catch (e) {
    fail(`JSON 파싱 실패: ${e.message}`)
    console.log(body.slice(0, 600))
    process.exit(1)
  }

  printTable(summarize(parsed))

  console.log(`\n${GREEN}위 표를 그대로 전달해 주십시오. 이 구조로 어댑터를 작성합니다.${RESET}`)
  dim('키 값은 출력 어디에도 찍히지 않습니다. 저장된 원본에는 응답만 들어 있습니다.')
}

main().catch((e) => {
  console.error(`\n${RED}탐침 중 오류: ${e.message}${RESET}\n`)
  process.exit(1)
})
