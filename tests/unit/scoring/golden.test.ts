/**
 * 골든 케이스 회귀 테스트
 *
 * 명백히 우수한 단지가 명백히 열위 단지보다 높은 점수를 받는지,
 * 그리고 총점이 예상 범위 안에 있는지 검사한다.
 * 알고리즘을 고쳐 순서가 뒤집히면 즉시 실패한다.
 */
import { describe, expect, it } from 'vitest'
import { computeScore } from '@/lib/scoring/aggregate'
import { getPreset } from '@/lib/scoring/presets'
import type { Observations, PropertyInput, ScoringInput, UserContext } from '@/lib/scoring/types'
import { makeObservations, makeProperty, makeUser } from '../../fixtures/builders'

interface GoldenCase {
  label: string
  property: Partial<PropertyInput>
  user?: Partial<UserContext>
  observations: Partial<Observations>
  expectMin: number
  expectMax: number
}

const CASES: readonly GoldenCase[] = [
  {
    label: '역세권 신축 · 직주근접 · 시세 대비 저렴',
    property: {
      name: '이상적단지', buildYear: new Date().getFullYear() - 2,
      priceManwon: 150_000, totalHouseholds: 2000, parkingPerHousehold: 1.6,
      monthlyFeePerM2: 2100,
      communityFacilities: ['POOL', 'GYM', 'GOLF', 'STUDY_ROOM', 'DAYCARE', 'CAFE_LOUNGE'],
      developments: [{ title: 'GTX 신설역', type: 'GTX_NEW_STATION', stage: 'CONFIRMED', distanceM: 600, sourceUrl: 'https://example.gov' }],
    },
    observations: {
      officeRoute: { totalMinutes: 22, transferCount: 0, walkMeters: 400, pathType: 3, summary: '직통' },
      officeSubwayRoute: { totalMinutes: 20, transferCount: 0, walkMeters: 400, pathType: 1, summary: '직통' },
      officeBusRoute: { totalMinutes: 28, transferCount: 0, walkMeters: 300, pathType: 2, summary: '직통' },
      subwayStations: [
        { name: 'A역 환승', lat: 0, lng: 0, distanceM: 250 },
        { name: 'B역', lat: 0, lng: 0, distanceM: 700 },
      ],
      busStops: [
        { name: '광역 정류장', lat: 0, lng: 0, distanceM: 150 },
        { name: '지선 정류장', lat: 0, lng: 0, distanceM: 300 },
        { name: '간선 정류장', lat: 0, lng: 0, distanceM: 400 },
      ],
      elementarySchools: [{ name: 'E초', lat: 0, lng: 0, distanceM: 250 }],
      middleSchools: [{ name: 'M중', lat: 0, lng: 0, distanceM: 400 }],
      highSchools: [{ name: 'H고', lat: 0, lng: 0, distanceM: 600 }],
      marts: [{ name: '코스트코', lat: 0, lng: 0, distanceM: 700 }, { name: '이마트', lat: 0, lng: 0, distanceM: 1000 }],
      comparableTrades: Array.from({ length: 15 }, () => ({
        aptName: 'X', exclusiveM2: 84.9, amountManwon: 190_000, dealDate: '2026-06-01', floor: 10, buildYear: 2020,
      })),
      marketMomentum: 0.12, premiumPricePerPyeong: 9000, tradeCount12m: 60,
      upcomingSupply: 200, existingHouseholds: 15_000, regionAvgFeePerM2: 2400,
    },
    expectMin: 85,
    expectMax: 100,
  },
  {
    label: '외곽 노후 단지 · 장거리 통근 · 고평가',
    property: {
      name: '열위단지', buildYear: new Date().getFullYear() - 27,
      priceManwon: 260_000, totalHouseholds: 400, parkingPerHousehold: 0.7,
      monthlyFeePerM2: 3200, communityFacilities: [],
      developments: [],
      userRisks: ['NOISE_ROAD', 'STEEP_SLOPE'],
    },
    observations: {
      officeRoute: { totalMinutes: 105, transferCount: 3, walkMeters: 1600, pathType: 3, summary: '환승 3회' },
      officeSubwayRoute: { totalMinutes: 100, transferCount: 3, walkMeters: 1600, pathType: 1, summary: '환승 3회' },
      officeBusRoute: { totalMinutes: 120, transferCount: 2, walkMeters: 1200, pathType: 2, summary: '환승 2회' },
      subwayStations: [{ name: 'Z역', lat: 0, lng: 0, distanceM: 1600 }],
      busStops: [{ name: '마을 정류장', lat: 0, lng: 0, distanceM: 700 }],
      elementarySchools: [{ name: 'E초', lat: 0, lng: 0, distanceM: 1100 }],
      middleSchools: [{ name: 'M중', lat: 0, lng: 0, distanceM: 1800 }],
      highSchools: [{ name: 'H고', lat: 0, lng: 0, distanceM: 3000 }],
      marts: [{ name: '마트', lat: 0, lng: 0, distanceM: 4500 }],
      comparableTrades: Array.from({ length: 15 }, () => ({
        aptName: 'X', exclusiveM2: 84.9, amountManwon: 200_000, dealDate: '2026-06-01', floor: 5, buildYear: 1999,
      })),
      marketMomentum: -0.06, premiumPricePerPyeong: 8000, tradeCount12m: 4,
      upcomingSupply: 3000, existingHouseholds: 10_000, regionAvgFeePerM2: 2400,
      placeSubwayRoutes: { f1: { totalMinutes: 80, transferCount: 3, walkMeters: 1500, pathType: 1, summary: '환승 3회' } },
      placeBusRoutes: { f1: { totalMinutes: 95, transferCount: 2, walkMeters: 1200, pathType: 2, summary: '환승 2회' } },
    },
    expectMin: 0,
    expectMax: 45,
  },
  {
    label: '평범한 중간 단지',
    property: { name: '중간단지', buildYear: new Date().getFullYear() - 14, priceManwon: 195_000 },
    observations: {},
    expectMin: 55,
    expectMax: 85,
  },
]

function build(c: GoldenCase): ScoringInput {
  return {
    property: makeProperty(c.property),
    user: makeUser(c.user ?? {}),
    observations: makeObservations(c.observations),
    weights: getPreset('balanced').weights,
    presetId: 'balanced',
  }
}

describe('골든 케이스', () => {
  for (const c of CASES) {
    it(`${c.label} → ${c.expectMin}~${c.expectMax}점`, () => {
      const r = computeScore(build(c))
      expect(r.totalScore).toBeGreaterThanOrEqual(c.expectMin)
      expect(r.totalScore).toBeLessThanOrEqual(c.expectMax)
    })
  }

  it('우수 단지가 열위 단지보다 반드시 높다', () => {
    const best = computeScore(build(CASES[0]!)).totalScore
    const mid = computeScore(build(CASES[2]!)).totalScore
    const worst = computeScore(build(CASES[1]!)).totalScore
    expect(best).toBeGreaterThan(mid)
    expect(mid).toBeGreaterThan(worst)
  })

  it('모든 축이 근거 문자열을 갖는다', () => {
    const r = computeScore(build(CASES[0]!))
    for (const axis of r.axes) {
      expect(axis.reason.length).toBeGreaterThan(0)
    }
  })
})
