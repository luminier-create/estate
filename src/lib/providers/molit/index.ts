import 'server-only'
/**
 * 국토교통부 아파트 매매 실거래가 Provider
 * 스펙: docs/03-DATA-SOURCES.md §3
 *
 * 변환·URL 조립·오류 판정은 전부 `parse.ts` 에 있다 (테스트 가능하게 하기 위함).
 * 여기는 네트워크 호출과 타임아웃만 담당한다.
 */
import type { Trade } from '../../scoring/types'
import type { MarketProvider } from '../types'
import { DEFAULT_SERVICE_NAME, buildTradeUrl, parseTradeXml } from './parse'

// 순수 함수라 parse.ts 에 있지만, 호출부는 Provider 모듈에서 가져다 쓴다.
export { recentMonths } from './parse'

const TIMEOUT_MS = 8000

export class MolitMarketProvider implements MarketProvider {
  readonly name = 'molit'
  private readonly serviceName: string

  constructor(
    private readonly serviceKey: string,
    serviceName?: string,
  ) {
    this.serviceName = serviceName || DEFAULT_SERVICE_NAME
  }

  async trades(lawdCd: string, yyyymm: string): Promise<Trade[]> {
    const url = buildTradeUrl({
      serviceKey: this.serviceKey,
      serviceName: this.serviceName,
      lawdCd,
      yyyymm,
    })

    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: 86_400 },
    })
    if (!res.ok) {
      throw new Error(`국토부 실거래가 API 오류 ${res.status}`)
    }

    return parseTradeXml(await res.text())
  }
}
