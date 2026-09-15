/**
 * 국토부 실거래가 API 실호출 점검 스크립트.
 *
 * 왜 필요한가 — 이 저장소를 개발하는 환경에서는 apis.data.go.kr 로 나가는 통신이
 * egress 허용목록에 막혀 있다(docs/10-KNOWLEDGE.md §1.7). 즉 어댑터를 써도
 * 여기서는 한 번도 실제 응답을 본 적이 없다. 네트워크가 열린 쪽에서 이 스크립트를
 * 한 번 돌리면 (1) 키가 어느 서비스에 유효한지 (2) 응답 필드가 파서 가정과
 * 맞는지 (3) 해제 건이 실제로 섞여 오는지가 한 번에 드러난다.
 *
 * 사용법:
 *   npm run probe:molit                 # 강남구, 직전월
 *   npm run probe:molit -- 11110 202606 # 법정동코드 5자리, 계약년월
 *
 * 인증키는 어떤 출력에도 원문으로 찍지 않는다.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { XMLParser } from 'fast-xml-parser'

const ROOT = process.cwd()
const OUT_DIR = resolve(ROOT, '.probe')
const HOST = 'https://apis.data.go.kr/1613000'

/** 키가 어느 서비스에 유효한지 모르므로 둘 다 시도한다. */
const SERVICES = [
  { name: 'RTMSDataSvcAptTrade', label: '일반 자료 (15126469)' },
  { name: 'RTMSDataSvcAptTradeDev', label: '상세 자료 (15126468)' },
]

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

/**
 * 파서가 기대하는 필드 목록을 `parse.ts` 에서 직접 읽는다.
 * 여기에 목록을 복사해 두면 코드가 바뀔 때 조용히 어긋난다.
 */
function expectedFields() {
  const src = readFileSync(resolve(ROOT, 'src/lib/providers/molit/parse.ts'), 'utf8')
  const pick = (constName) => {
    const m = src.match(new RegExp(`export const ${constName} = \\[([^\\]]*)\\]`))
    if (!m) return null
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
  }
  return { required: pick('EXPECTED_FIELDS'), optional: pick('OPTIONAL_FIELDS') }
}

/** 인코딩 키/디코딩 키 어느 쪽이 들어와도 한 번만 인코딩된 형태로 맞춘다. */
function normalizeServiceKey(raw) {
  const key = raw.trim()
  return key.includes('%') ? key : encodeURIComponent(key)
}

function maskKey(key) {
  return `${key.slice(0, 6)}…${key.slice(-6)} (${key.length}자)`
}

/** 출력·저장물에서 인증키를 지운다. */
function redact(text, key) {
  if (!text) return text
  let out = text
  for (const form of new Set([key, decodeURIComponent(key), encodeURIComponent(key)])) {
    if (form) out = out.split(form).join('<REDACTED>')
  }
  return out
}

function prevMonth() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
}

const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true })

async function call(serviceName, key, lawdCd, dealYmd) {
  const url = new URL(`${HOST}/${serviceName}/get${serviceName}`)
  url.searchParams.set('LAWD_CD', lawdCd)
  url.searchParams.set('DEAL_YMD', dealYmd)
  url.searchParams.set('numOfRows', '100')
  url.searchParams.set('pageNo', '1')
  const finalUrl = `${url.toString()}&serviceKey=${normalizeServiceKey(key)}`

  const res = await fetch(finalUrl, { signal: AbortSignal.timeout(15_000) })
  const text = await res.text()
  return { status: res.status, text }
}

function classify(text) {
  const parsed = parser.parse(text)
  if (parsed.OpenAPI_ServiceResponse) {
    const h = parsed.OpenAPI_ServiceResponse.cmmMsgHeader ?? {}
    return { kind: 'service-error', message: h.returnAuthMsg ?? h.errMsg ?? '알 수 없음', code: h.returnReasonCode }
  }
  if (!parsed.response) return { kind: 'unknown-shape' }
  const code = String(parsed.response.header?.resultCode ?? '')
  if (code && code !== '00' && code !== '000') {
    return { kind: 'result-error', message: parsed.response.header?.resultMsg, code }
  }
  const items = parsed.response.body?.items
  const list = !items || typeof items === 'string' ? [] : [items.item ?? []].flat()
  return { kind: 'ok', items: list, total: parsed.response.body?.totalCount }
}

async function main() {
  const envFile = loadEnv()
  console.log(`\n국토부 실거래가 API 점검\n${'─'.repeat(52)}`)
  if (envFile) ok(`${envFile} 로드`)
  else warn('.env.local 없음 — 환경변수에서 읽는다')

  const key = process.env.MOLIT_SERVICE_KEY
  if (!key) {
    fail('MOLIT_SERVICE_KEY 가 없다. .env.local 에 포털의 "일반 인증키" 를 넣는다')
    process.exit(1)
  }
  ok(`인증키 ${maskKey(key)}`)
  dim(key.includes('%') ? '인코딩 키로 인식 — 그대로 사용' : '디코딩 키로 인식 — 한 번 인코딩해 사용')

  const lawdCd = process.argv[2] ?? '11680'
  const dealYmd = process.argv[3] ?? prevMonth()
  ok(`대상 LAWD_CD=${lawdCd} DEAL_YMD=${dealYmd}`)

  mkdirSync(OUT_DIR, { recursive: true })
  let authorized = null

  for (const svc of SERVICES) {
    console.log(`\n▸ ${svc.label} — ${svc.name}`)
    let result
    try {
      result = await call(svc.name, key, lawdCd, dealYmd)
    } catch (e) {
      fail(`호출 실패: ${redact(String(e?.message ?? e), key)}`)
      continue
    }

    const raw = resolve(OUT_DIR, `molit-${svc.name}-${lawdCd}-${dealYmd}.xml`)
    writeFileSync(raw, redact(result.text, key), 'utf8')
    dim(`원본 저장: ${raw}`)

    if (result.status !== 200) {
      // egress 프록시가 막으면 API 가 거부한 것처럼 403 이 찍힌다. 원인이 전혀
      // 다르므로(키 문제가 아니라 망 설정) 여기서 갈라서 알린다.
      if (/not in allowlist|egress|blocked/i.test(result.text)) {
        fail('이 환경의 네트워크 정책이 호출을 막았다 — API 응답이 아니다')
        dim(result.text.trim().slice(0, 160))
        dim('호스트를 egress 허용목록에 추가하거나, 망이 열린 PC 에서 다시 돌린다')
      } else {
        fail(`HTTP ${result.status}`)
      }
      continue
    }

    const c = classify(result.text)
    if (c.kind === 'service-error') {
      fail(`${c.message}${c.code ? ` (코드 ${c.code})` : ''}`)
      if (String(c.message).includes('ACCESS_DENIED')) {
        dim('이 서비스는 활용신청되지 않았다. 포털에서 신청하거나 다른 서비스를 쓴다')
      }
      continue
    }
    if (c.kind === 'result-error') {
      fail(`응답 오류: ${c.message ?? ''} (resultCode ${c.code})`)
      continue
    }
    if (c.kind === 'unknown-shape') {
      fail('response 키가 없는 처음 보는 형태 — 저장된 원본을 확인한다')
      continue
    }

    ok(`정상 응답 · 총 ${c.total ?? '?'}건, 이번 페이지 ${c.items.length}건`)
    authorized ??= svc.name

    if (c.items.length === 0) {
      warn('거래 0건 — 필드 확인이 불가능하다. 다른 지역·월로 다시 돌린다')
      continue
    }

    const present = new Set()
    for (const it of c.items) for (const k of Object.keys(it)) present.add(k)

    const { required, optional } = expectedFields()
    if (!required) {
      warn('parse.ts 에서 기대 필드 목록을 읽지 못했다 — 아래 전체 필드로 직접 대조한다')
    } else {
      console.log('\n  파서가 기대하는 필드')
      for (const f of required) {
        if (present.has(f)) ok(`${f} = ${JSON.stringify(c.items[0][f])}`)
        else fail(`${f} 없음 — 파서 수정 필요`)
      }
      console.log('\n  있으면 쓰는 필드')
      for (const f of optional ?? []) {
        if (present.has(f)) ok(`${f} = ${JSON.stringify(c.items[0][f])}`)
        else warn(`${f} 없음${f === 'cdealType' ? ' — 계약 해제 건을 걸러낼 수 없다' : ''}`)
      }
    }

    const cancelled = c.items.filter(
      (it) => String(it.cdealType ?? '').trim().toUpperCase() === 'O',
    ).length
    console.log(`\n  해제 건: ${cancelled}건 / ${c.items.length}건`)

    const extra = [...present].filter(
      (f) => !(required ?? []).includes(f) && !(optional ?? []).includes(f),
    )
    console.log(`\n  응답에 있으나 쓰지 않는 필드 (${extra.length}개)`)
    dim(extra.join(', ') || '없음')
  }

  console.log(`\n${'─'.repeat(52)}`)
  if (authorized) {
    ok(`이 키로 호출 가능한 서비스: ${authorized}`)
    if (authorized !== 'RTMSDataSvcAptTrade') {
      dim(`.env.local 에 MOLIT_SERVICE_NAME=${authorized} 를 추가한다`)
    } else {
      dim('기본값과 같으므로 추가 설정이 필요 없다')
    }
  } else {
    fail('두 서비스 모두 호출에 실패했다. 위 메시지와 저장된 원본을 확인한다')
    process.exit(1)
  }
}

main().catch((e) => {
  fail(String(e?.message ?? e))
  process.exit(1)
})
