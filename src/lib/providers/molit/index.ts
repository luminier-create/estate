import 'server-only'
/**
 * 국토교통부 아파트 매매 실거래가 상세 Provider
 * 스펙: docs/03-DATA-SOURCES.md §3
 *
 * 구현 주의점
 * - dealAmount 는 " 123,000" 형태 문자열이므로 콤마·공백을 제거해야 한다
 * - cdealType === 'O' 는 계약 해제 건이므로 시세 계산에서 반드시 제외한다
 * - serviceKey 이중 인코딩이 대표적 실패 원인이다. 디코딩 키를 받아 한 번만 인코딩한다
 */
import { XMLParser } from 'fast-xml-parser'
import type { Trade } from '../../scoring/types'
import type { MarketProvider } from '../types'

const ENDPOINT =
  'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev'
const TIMEOUT_MS = 8000

interface MolitItem {
  aptNm?: string
  excluUseAr?: number | string
  dealAmount?: string | number
  dealYear?: number
  dealMonth?: number
  dealDay?: number
  floor?: number | string
  buildYear?: number
  cdealType?: string
  umdNm?: string
}

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
})

/** " 123,000" → 123000 */
function parseAmount(raw: string | number | undefined): number {
  if (typeof raw === 'number') return raw
  if (!raw) return Number.NaN
  return Number(String(raw).replace(/[,\s]/g, ''))
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return []
  return Array.isArray(v) ? v : [v]
}

export class MolitMarketProvider implements MarketProvider {
  readonly name = 'molit'

  constructor(private readonly serviceKey: string) {}

  async trades(lawdCd: string, yyyymm: string): Promise<Trade[]> {
    const url = new URL(ENDPOINT)
    // serviceKey 는 인코딩 키를 그대로 붙인다. URLSearchParams 를 쓰면 이중 인코딩된다.
    url.searchParams.set('LAWD_CD', lawdCd)
    url.searchParams.set('DEAL_YMD', yyyymm)
    url.searchParams.set('numOfRows', '1000')
    url.searchParams.set('pageNo', '1')
    const finalUrl = `${url.toString()}&serviceKey=${this.serviceKey}`

    const res = await fetch(finalUrl, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: 86_400 },
    })
    if (!res.ok) {
      throw new Error(`국토부 실거래가 API 오류 ${res.status}`)
    }

    const text = await res.text()
    const parsed = parser.parse(text) as {
      response?: {
        header?: { resultCode?: string; resultMsg?: string }
        body?: { items?: { item?: MolitItem | MolitItem[] } }
      }
    }

    const code = parsed.response?.header?.resultCode
    if (code && code !== '00' && code !== '000') {
      throw new Error(
        `국토부 실거래가 API 응답 오류: ${parsed.response?.header?.resultMsg ?? code}`,
      )
    }

    return toArray(parsed.response?.body?.items?.item)
      // 계약 해제 건 제외 — 포함하면 시세가 왜곡된다
      .filter((it) => String(it.cdealType ?? '').trim().toUpperCase() !== 'O')
      .map((it) => {
        const amount = parseAmount(it.dealAmount)
        const area = Number(it.excluUseAr)
        const y = Number(it.dealYear)
        const m = Number(it.dealMonth)
        const d = Number(it.dealDay)
        return {
          aptName: String(it.aptNm ?? '').trim(),
          exclusiveM2: area,
          amountManwon: amount,
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
  }
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
    months.push(
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`,
    )
    d.setMonth(d.getMonth() - 1)
  }
  return months
}
