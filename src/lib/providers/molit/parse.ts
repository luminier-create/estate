/**
 * 국토부 실거래가 응답 변환 — 순수 함수.
 *
 * `index.ts` 는 `server-only` 라 vitest 에서 import 할 수 없다. 이 API 가 실제로
 * 틀리는 지점(인증키 인코딩·해제 건·오류를 200 으로 돌려주는 응답)은 전부 여기
 * 변환부에 있으므로, 경계 밖으로 빼서 테스트로 고정한다.
 */
import { XMLParser } from 'fast-xml-parser'
import type { Trade } from '../../scoring/types'

/** data.go.kr 오픈API 공통 호스트. 서비스명이 경로와 오퍼레이션 이름을 함께 결정한다. */
const HOST = 'https://apis.data.go.kr/1613000'

/**
 * 기본값은 **일반** 자료(15126469)다.
 * data.go.kr 인증키는 활용신청한 서비스 단위로만 유효해서, 상세(…Dev) 자료를
 * 따로 신청하지 않은 키로 상세를 부르면 SERVICE ACCESS DENIED 가 난다.
 * 상세를 신청했다면 `MOLIT_SERVICE_NAME=RTMSDataSvcAptTradeDev` 로 바꾼다.
 */
export const DEFAULT_SERVICE_NAME = 'RTMSDataSvcAptTrade'

/** 파서가 기대하는 응답 필드. probe 스크립트가 실응답과 대조할 때 쓴다. */
export const EXPECTED_FIELDS = [
  'aptNm',
  'excluUseAr',
  'dealAmount',
  'dealYear',
  'dealMonth',
  'dealDay',
  'floor',
  'buildYear',
] as const

/** 있으면 쓰지만 없어도 동작하는 필드 — 없으면 해제 건을 걸러낼 수 없다. */
export const OPTIONAL_FIELDS = ['cdealType', 'umdNm'] as const

export interface MolitItem {
  aptNm?: string
  excluUseAr?: number | string
  dealAmount?: string | number
  dealYear?: number | string
  dealMonth?: number | string
  dealDay?: number | string
  floor?: number | string
  buildYear?: number | string
  cdealType?: string
  umdNm?: string
}

/**
 * 포털은 같은 키를 Encoding/Decoding 두 형태로 보여준다.
 *
 * 인코딩 키(`%2F`·`%3D` 포함)를 다시 인코딩하면 `%252F` 가 되어 인증이 실패하고,
 * 디코딩 키(`+`·`/`·`=` 원문)를 그대로 붙이면 `+` 가 공백으로 해석되어 역시 실패한다.
 * 어느 쪽을 넣어도 동작하도록 한 번만 인코딩된 형태로 맞춘다 —
 * base64 문자집합에는 `%` 가 없으므로 `%` 유무로 확실히 구분된다.
 */
export function normalizeServiceKey(raw: string): string {
  const key = raw.trim()
  return key.includes('%') ? key : encodeURIComponent(key)
}

export function buildTradeUrl(params: {
  serviceKey: string
  lawdCd: string
  yyyymm: string
  serviceName?: string
  numOfRows?: number
  pageNo?: number
}): string {
  const name = params.serviceName || DEFAULT_SERVICE_NAME
  const url = new URL(`${HOST}/${name}/get${name}`)
  url.searchParams.set('LAWD_CD', params.lawdCd)
  url.searchParams.set('DEAL_YMD', params.yyyymm)
  url.searchParams.set('numOfRows', String(params.numOfRows ?? 1000))
  url.searchParams.set('pageNo', String(params.pageNo ?? 1))
  // serviceKey 만 문자열로 붙인다. URLSearchParams 에 넣으면 `%2F` 가 다시 인코딩된다.
  return `${url.toString()}&serviceKey=${normalizeServiceKey(params.serviceKey)}`
}

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
})

/** " 123,000" → 123000 */
export function parseAmount(raw: string | number | undefined): number {
  if (typeof raw === 'number') return raw
  if (!raw) return Number.NaN
  return Number(String(raw).replace(/[,\s]/g, ''))
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return []
  return Array.isArray(v) ? v : [v]
}

interface MolitResponse {
  response?: {
    header?: { resultCode?: string | number; resultMsg?: string }
    body?: { items?: { item?: MolitItem | MolitItem[] } | '' }
  }
}

/** 응답 XML 을 구조만 파싱한다. 오류 응답은 여기서 throw 된다. */
export function parseTradeResponse(text: string): MolitItem[] {
  const parsed = parser.parse(text) as MolitResponse

  // data.go.kr 은 키 오류·한도 초과를 HTTP 200 + <OpenAPI_ServiceResponse> 로 돌려준다.
  // 그 응답에는 `response` 키가 아예 없어서, 형태만 보고 넘기면 "거래 0건"으로
  // 읽히고 그 빈 배열이 과거 월 무기한 캐시에 굳는다.
  if (!parsed.response) {
    throw new Error(`국토부 실거래가 API 응답 형식 오류: ${text.slice(0, 200)}`)
  }
  const code = String(parsed.response.header?.resultCode ?? '')
  if (code && code !== '00' && code !== '000') {
    throw new Error(
      `국토부 실거래가 API 응답 오류: ${parsed.response.header?.resultMsg ?? code}`,
    )
  }

  const items = parsed.response.body?.items
  // 거래 0건이면 `<items/>` 로 와서 빈 문자열이 된다 — 오류가 아니다.
  if (!items || typeof items === 'string') return []
  return toArray(items.item)
}

/** 응답 항목을 스코어링이 쓰는 Trade 로 변환한다. 해제 건과 손상된 행은 버린다. */
export function toTrades(items: MolitItem[]): Trade[] {
  return (
    items
      // 계약 해제 건 제외 — 포함하면 시세가 왜곡된다
      .filter((it) => String(it.cdealType ?? '').trim().toUpperCase() !== 'O')
      .map((it) => {
        const y = Number(it.dealYear)
        const m = Number(it.dealMonth)
        const d = Number(it.dealDay)
        return {
          aptName: String(it.aptNm ?? '').trim(),
          exclusiveM2: Number(it.excluUseAr),
          amountManwon: parseAmount(it.dealAmount),
          dealDate: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
          floor: Number(it.floor) || 0,
          buildYear: Number(it.buildYear) || 0,
        } satisfies Trade
      })
      .filter(
        (t) =>
          Number.isFinite(t.amountManwon) &&
          t.amountManwon > 0 &&
          Number.isFinite(t.exclusiveM2) &&
          t.exclusiveM2 > 0,
      )
  )
}

export function parseTradeXml(text: string): Trade[] {
  return toTrades(parseTradeResponse(text))
}

/**
 * 시세 조회 대상 월 목록.
 * 실거래 신고 기한이 계약일로부터 30일이라 당월 데이터는 불완전하므로
 * 직전월부터 거슬러 올라간다.
 */
export function recentMonths(count: number, from = new Date()): string[] {
  const months: string[] = []
  const d = new Date(from.getFullYear(), from.getMonth(), 1)
  d.setMonth(d.getMonth() - 1) // 당월 제외
  for (let i = 0; i < count; i++) {
    months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() - 1)
  }
  return months
}
