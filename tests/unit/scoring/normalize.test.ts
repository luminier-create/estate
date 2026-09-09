import { describe, expect, it } from 'vitest'
import {
  clamp,
  formatManwon,
  formatMinutes,
  haversineM,
  m2ToPyeong,
  median,
  piecewise,
  pyeongToM2,
  quantile,
  removeOutliers,
  walkMinutes,
} from '@/lib/scoring/normalize'

describe('piecewise', () => {
  const curve = [
    [30, 100],
    [60, 55],
    [90, 10],
  ] as const

  it('첫 지점 이하는 첫 점수로 고정', () => {
    expect(piecewise(0, curve)).toBe(100)
    expect(piecewise(30, curve)).toBe(100)
  })

  it('마지막 지점 이상은 마지막 점수로 고정', () => {
    expect(piecewise(90, curve)).toBe(10)
    expect(piecewise(500, curve)).toBe(10)
  })

  it('구간 내부는 선형보간', () => {
    expect(piecewise(45, curve)).toBeCloseTo(77.5, 5)
    expect(piecewise(75, curve)).toBeCloseTo(32.5, 5)
  })

  it('경계 직전/직후가 연속', () => {
    expect(piecewise(59.99, curve)).toBeCloseTo(55.015, 2)
    expect(piecewise(60.01, curve)).toBeCloseTo(54.985, 2)
  })

  it('NaN 은 첫 점수로 처리 — 총점이 오염되지 않아야 함', () => {
    expect(piecewise(Number.NaN, curve)).toBe(100)
  })

  it('빈 구간은 오류', () => {
    expect(() => piecewise(1, [])).toThrow()
  })
})

describe('clamp', () => {
  it('범위를 벗어난 값을 가둔다', () => {
    expect(clamp(-10)).toBe(0)
    expect(clamp(150)).toBe(100)
    expect(clamp(55)).toBe(55)
  })
})

describe('walkMinutes', () => {
  it('직선 335m 는 우회계수 반영 시 약 6.25분', () => {
    expect(walkMinutes(335)).toBeCloseTo(6.25, 2)
  })
  it('거리가 늘면 시간도 단조 증가', () => {
    expect(walkMinutes(1000)).toBeGreaterThan(walkMinutes(500))
  })
})

describe('면적 환산', () => {
  it('84.9㎡ 는 약 25.7평', () => {
    expect(m2ToPyeong(84.9)).toBeCloseTo(25.68, 1)
  })
  it('왕복 변환이 원값을 보존', () => {
    expect(pyeongToM2(m2ToPyeong(84.9))).toBeCloseTo(84.9, 8)
  })
})

describe('haversineM', () => {
  it('강남역-역삼역 약 900m', () => {
    const d = haversineM(
      { lat: 37.497942, lng: 127.027621 },
      { lat: 37.500622, lng: 127.036456 },
    )
    expect(d).toBeGreaterThan(700)
    expect(d).toBeLessThan(1100)
  })
  it('같은 점은 0', () => {
    expect(haversineM({ lat: 37.5, lng: 127 }, { lat: 37.5, lng: 127 })).toBe(0)
  })
})

describe('통계', () => {
  it('median 홀수/짝수', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
  })
  it('quantile', () => {
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3)
    expect(quantile([1, 2, 3, 4, 5], 0)).toBe(1)
  })
  it('removeOutliers 가 극단값을 제거', () => {
    const v = [100, 102, 98, 101, 99, 100, 5000]
    expect(removeOutliers(v)).not.toContain(5000)
  })
  it('표본 4개 미만이면 그대로 반환 — 과소표본에서 제거는 위험', () => {
    expect(removeOutliers([1, 999])).toEqual([1, 999])
  })
})

describe('표기', () => {
  it('금액 한국식 표기', () => {
    expect(formatManwon(125_000)).toBe('12억 5,000만원')
    expect(formatManwon(120_000)).toBe('12억원')
    expect(formatManwon(8_500)).toBe('8,500만원')
  })
  it('시간 표기', () => {
    expect(formatMinutes(45)).toBe('45분')
    expect(formatMinutes(72)).toBe('1시간 12분')
    expect(formatMinutes(120)).toBe('2시간')
  })
})
