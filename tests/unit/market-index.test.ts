/**
 * 지역 시장 지표 Mock Provider.
 *
 * 실구현(R-ONE)이 붙기 전까지 화면이 기대는 구현이므로, 화면이 깨지지 않을
 * 최소 보장을 여기서 고정한다. 특히 **결정성** — 같은 입력에 같은 출력이 아니면
 * 캐시가 의미를 잃고, 새로고침할 때마다 그래프가 춤춘다.
 */
import { describe, expect, it } from 'vitest'
import { MockMarketIndexProvider } from '@/lib/providers/mock'
import { MARKET_INDICATORS } from '@/lib/providers/types'

const provider = new MockMarketIndexProvider()

describe('MockMarketIndexProvider', () => {
  it('같은 입력에 같은 출력 (결정적)', async () => {
    const a = await provider.series('SALE_PRICE_INDEX', 'M11', 24)
    const b = await provider.series('SALE_PRICE_INDEX', 'M11', 24)
    expect(a).toEqual(b)
  })

  it('지표·지역이 다르면 값도 다르다', async () => {
    const seoul = await provider.series('SALE_PRICE_INDEX', 'M11', 24)
    const busan = await provider.series('SALE_PRICE_INDEX', 'M26', 24)
    const jeonse = await provider.series('JEONSE_PRICE_INDEX', 'M11', 24)

    expect(seoul!.points.map((p) => p.value)).not.toEqual(busan!.points.map((p) => p.value))
    expect(seoul!.points.map((p) => p.value)).not.toEqual(jeonse!.points.map((p) => p.value))
  })

  it('요청한 개월 수만큼, 오래된 것부터 돌려준다', async () => {
    for (const months of [12, 24, 60]) {
      const s = await provider.series('REAL_TRADE_INDEX', 'M11', months)
      expect(s!.points).toHaveLength(months)
      const periods = s!.points.map((p) => p.period)
      expect([...periods].sort()).toEqual(periods)
      expect(periods.every((p) => /^\d{6}$/.test(p))).toBe(true)
    }
  })

  it('지원 지표 전부가 유한한 값을 낸다', async () => {
    for (const indicator of MARKET_INDICATORS) {
      const s = await provider.series(indicator, 'M11', 12)
      expect(s, indicator).not.toBeNull()
      expect(s!.unit, indicator).toBeTruthy()
      expect(
        s!.points.every((p) => Number.isFinite(p.value) && p.value >= 0),
        indicator,
      ).toBe(true)
    }
  })

  it('모르는 지역은 null — 화면이 빈 상태를 보여줘야 한다', async () => {
    expect(await provider.series('SALE_PRICE_INDEX', '없는코드', 24)).toBeNull()
  })

  it('지역 목록이 비어 있지 않고 코드가 유일하다', async () => {
    const regions = await provider.regions()
    expect(regions.length).toBeGreaterThan(0)
    expect(new Set(regions.map((r) => r.code)).size).toBe(regions.length)
  })

  it('실데이터로 오해할 출처를 달지 않는다', async () => {
    const s = await provider.series('SALE_PRICE_INDEX', 'M11', 12)
    // 시드 데이터에 "한국부동산원" 같은 출처를 달면 추정이 실측처럼 읽힌다
    expect(s!.source.label).toMatch(/시드|실데이터 아님/)
  })
})
