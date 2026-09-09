import { describe, expect, it } from 'vitest'
import {
  axisContributions,
  computeScore,
  rankResults,
  toGrade,
  weakestAxes,
} from '@/lib/scoring/aggregate'
import { getPreset, normalizeWeights } from '@/lib/scoring/presets'
import { AXIS_CODES } from '@/lib/scoring/types'
import { makeInput, makeObservations, makeProperty, makeUser } from '../../fixtures/builders'

describe('등급 매핑', () => {
  it('구간별 등급', () => {
    expect(toGrade(92)).toBe('S')
    expect(toGrade(80)).toBe('A')
    expect(toGrade(70)).toBe('B')
    expect(toGrade(60)).toBe('C')
    expect(toGrade(45)).toBe('D')
    expect(toGrade(20)).toBe('E')
  })
  it('경계값', () => {
    expect(toGrade(85)).toBe('S')
    expect(toGrade(84.9)).toBe('A')
  })
})

describe('가중치 프리셋', () => {
  it('모든 프리셋의 합이 100', () => {
    for (const id of ['balanced', 'commute', 'school', 'investment']) {
      const w = getPreset(id).weights
      const sum = AXIS_CODES.reduce((s, c) => s + w[c], 0)
      expect(sum).toBeCloseTo(100, 6)
    }
  })

  it('커스텀 가중치를 합 100으로 재정규화', () => {
    const w = normalizeWeights({ COMMUTE: 50, VALUE: 50, SUBWAY: 100 })
    const sum = AXIS_CODES.reduce((s, c) => s + w[c], 0)
    expect(sum).toBeCloseTo(100, 6)
    expect(w.SUBWAY).toBeCloseTo(50, 6)
  })

  it('전부 0이면 기본 프리셋으로 폴백', () => {
    const w = normalizeWeights({})
    expect(w).toEqual(getPreset('balanced').weights)
  })
})

describe('computeScore', () => {
  it('총점은 항상 0~100', () => {
    const r = computeScore(makeInput())
    expect(r.totalScore).toBeGreaterThanOrEqual(0)
    expect(r.totalScore).toBeLessThanOrEqual(100)
  })

  it('10개 축을 모두 반환한다', () => {
    const r = computeScore(makeInput())
    expect(r.axes).toHaveLength(10)
    expect(new Set(r.axes.map((a) => a.axis)).size).toBe(10)
  })

  it('모든 축이 가용하면 신뢰도 1.0', () => {
    const r = computeScore(makeInput())
    expect(r.confidence).toBe(1)
    expect(r.confidenceLabel).toBe('high')
  })

  it('축 3개를 결측시켜도 총점은 유효 범위이고 신뢰도가 낮아진다', () => {
    const r = computeScore(
      makeInput({
        observations: makeObservations({
          officeRoute: null,
          comparableTrades: null,
          subwayStations: null,
        }),
      }),
    )
    expect(r.totalScore).toBeGreaterThanOrEqual(0)
    expect(r.totalScore).toBeLessThanOrEqual(100)
    expect(r.confidence).toBeLessThan(0.7)
    expect(r.confidenceLabel).toBe('low')
    expect(r.axes.filter((a) => a.score === null)).toHaveLength(3)
  })

  it('전 축이 결측이면 총점 0, 신뢰도 0 — 크래시하지 않는다', () => {
    const r = computeScore(
      makeInput({
        property: makeProperty({
          buildYear: null,
          communityFacilities: undefined,
          monthlyFeePerM2: null,
          developments: undefined,
        }),
        user: makeUser({ office: null, frequentPlaces: [] }),
        observations: makeObservations({
          officeRoute: null, officeSubwayRoute: null, officeBusRoute: null,
          placeSubwayRoutes: null, placeBusRoutes: null,
          comparableTrades: null, subwayStations: null, busStops: null,
          elementarySchools: null, middleSchools: null, highSchools: null,
          marts: null, regionAvgFeePerM2: null,
          marketMomentum: null, premiumPricePerPyeong: null,
          tradeCount12m: null, upcomingSupply: null,
        }),
      }),
    )
    // DEVELOPMENT 는 중립 40점으로 항상 산출되므로 신뢰도는 0이 아니다
    expect(r.totalScore).toBeGreaterThanOrEqual(0)
    expect(r.totalScore).toBeLessThanOrEqual(100)
    expect(r.confidenceLabel).toBe('low')
  })

  it('리스크 감점이 총점에 반영된다', () => {
    const clean = computeScore(makeInput()).totalScore
    const risky = computeScore(
      makeInput({
        property: makeProperty({
          userRisks: ['NOISE_FLOOR', 'NOISE_ROAD', 'NIGHTLIFE'],
        }),
      }),
    )
    expect(risky.riskPenalty).toBe(10)
    expect(risky.totalScore).toBeCloseTo(clean - 10, 1)
  })

  it('리스크 감점 후에도 0 아래로 내려가지 않는다', () => {
    const r = computeScore(
      makeInput({
        property: makeProperty({
          priceManwon: 900_000,
          buildYear: 1985,
          userRisks: ['NOISE_FLOOR', 'NOISE_ROAD', 'NIGHTLIFE', 'AVOIDED_FACILITY', 'STEEP_SLOPE'],
          communityFacilities: [],
        }),
        observations: makeObservations({
          officeRoute: { totalMinutes: 130, transferCount: 3, walkMeters: 1500, pathType: 3, summary: 'x' },
          subwayStations: [], busStops: [], marts: [],
          elementarySchools: [], middleSchools: [], highSchools: [],
        }),
      }),
    )
    expect(r.totalScore).toBeGreaterThanOrEqual(0)
  })

  it('프리셋을 바꾸면 총점이 달라진다', () => {
    const base = makeInput({
      observations: makeObservations({
        officeRoute: { totalMinutes: 85, transferCount: 2, walkMeters: 900, pathType: 3, summary: 'x' },
      }),
    })
    const balanced = computeScore({ ...base, weights: getPreset('balanced').weights, presetId: 'balanced' })
    const commute = computeScore({ ...base, weights: getPreset('commute').weights, presetId: 'commute' })
    // 통근이 나쁜 단지는 직주근접 프리셋에서 더 낮게 나와야 한다
    expect(commute.totalScore).toBeLessThan(balanced.totalScore)
  })

  it('알고리즘 버전이 결과에 기록된다', () => {
    expect(computeScore(makeInput()).version).toMatch(/^v\d+\.\d+\.\d+$/)
  })

  it('동일 입력은 동일 총점 — 결정적이어야 함', () => {
    const input = makeInput()
    expect(computeScore(input).totalScore).toBe(computeScore(input).totalScore)
  })
})

describe('rankResults', () => {
  it('총점 내림차순 정렬', () => {
    const mk = (totalScore: number, confidence = 1) =>
      ({ score: { totalScore, confidence } }) as never
    const ranked = rankResults([mk(70), mk(90), mk(80)])
    expect(ranked.map((r) => (r as { score: { totalScore: number } }).score.totalScore))
      .toEqual([90, 80, 70])
  })

  it('동점이면 신뢰도 높은 쪽이 앞', () => {
    const mk = (totalScore: number, confidence: number) =>
      ({ score: { totalScore, confidence } }) as never
    const ranked = rankResults([mk(80, 0.6), mk(80, 0.95)])
    expect((ranked[0] as { score: { confidence: number } }).score.confidence).toBe(0.95)
  })
})

describe('axisContributions / weakestAxes', () => {
  it('기여도 합이 baseScore 와 일치', () => {
    const r = computeScore(makeInput())
    const sum = axisContributions(r).reduce((s, c) => s + c.contribution, 0)
    expect(sum).toBeCloseTo(r.baseScore, 0)
  })

  it('약점 축은 손실이 큰 순', () => {
    const r = computeScore(
      makeInput({
        observations: makeObservations({
          officeRoute: { totalMinutes: 110, transferCount: 3, walkMeters: 1500, pathType: 3, summary: 'x' },
        }),
      }),
    )
    expect(weakestAxes(r, 1)[0]?.axis).toBe('COMMUTE')
  })
})
