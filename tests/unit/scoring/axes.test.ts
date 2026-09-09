import { describe, expect, it } from 'vitest'
import { scoreCommute } from '@/lib/scoring/axes/commute'
import { scoreValue } from '@/lib/scoring/axes/value'
import { scoreSubway } from '@/lib/scoring/axes/subway'
import { scoreSchool } from '@/lib/scoring/axes/school'
import { scoreBus } from '@/lib/scoring/axes/bus'
import { scoreAge } from '@/lib/scoring/axes/age'
import { scoreRetail } from '@/lib/scoring/axes/retail'
import { scoreAmenity } from '@/lib/scoring/axes/amenity'
import { scoreDevelopment } from '@/lib/scoring/axes/development'
import { scoreInvestment } from '@/lib/scoring/axes/investment'
import { evaluateRisks, MAX_RISK_PENALTY } from '@/lib/scoring/axes/risk'
import { makeInput, makeObservations, makeProperty, makeUser } from '../../fixtures/builders'

describe('COMMUTE', () => {
  const route = (totalMinutes: number, transferCount = 1) => ({
    totalMinutes,
    transferCount,
    walkMeters: 500,
    pathType: 3 as const,
    summary: 'test',
  })

  it('30분 이내는 만점 구간', () => {
    const r = scoreCommute(
      makeInput({ observations: makeObservations({ officeRoute: route(25) }) }),
    )
    expect(r.score).toBe(100)
  })

  it('90분 이상은 최저 구간 (10점 이하)', () => {
    const r = scoreCommute(
      makeInput({ observations: makeObservations({ officeRoute: route(95) }) }),
    )
    expect(r.score).toBeLessThanOrEqual(10)
  })

  it('60분은 약 55점', () => {
    const r = scoreCommute(
      makeInput({ observations: makeObservations({ officeRoute: route(60) }) }),
    )
    expect(r.score).toBeCloseTo(55, 0)
  })

  it('통근시간이 늘면 점수는 단조 감소', () => {
    const scores = [20, 40, 60, 80, 100].map(
      (m) =>
        scoreCommute(
          makeInput({ observations: makeObservations({ officeRoute: route(m) }) }),
        ).score!,
    )
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]!).toBeLessThanOrEqual(scores[i - 1]!)
    }
  })

  it('환승 0회는 가산, 3회는 감산', () => {
    const direct = scoreCommute(
      makeInput({ observations: makeObservations({ officeRoute: route(50, 0) }) }),
    ).score!
    const many = scoreCommute(
      makeInput({ observations: makeObservations({ officeRoute: route(50, 3) }) }),
    ).score!
    expect(direct).toBeGreaterThan(many)
  })

  it('사무실 미등록이면 결측', () => {
    const r = scoreCommute(
      makeInput({ user: makeUser({ office: null }) }),
    )
    expect(r.score).toBeNull()
  })

  it('경로 조회 실패면 결측', () => {
    const r = scoreCommute(
      makeInput({ observations: makeObservations({ officeRoute: null }) }),
    )
    expect(r.score).toBeNull()
  })
})

describe('VALUE', () => {
  const trades = (amount: number, n = 10) =>
    Array.from({ length: n }, () => ({
      aptName: 'X',
      exclusiveM2: 84.9,
      amountManwon: amount,
      dealDate: '2026-06-01',
      floor: 5,
      buildYear: 2010,
    }))

  it('시세보다 싸면 고득점', () => {
    const r = scoreValue(
      makeInput({
        property: makeProperty({ priceManwon: 160_000 }),
        observations: makeObservations({ comparableTrades: trades(200_000) }),
      }),
    )
    expect(r.score!).toBeGreaterThan(90)
  })

  it('시세보다 비싸면 저득점', () => {
    const r = scoreValue(
      makeInput({
        property: makeProperty({ priceManwon: 260_000 }),
        observations: makeObservations({ comparableTrades: trades(200_000) }),
      }),
    )
    expect(r.score!).toBeLessThan(30)
  })

  it('시세와 같으면 70점 근처', () => {
    const r = scoreValue(
      makeInput({
        property: makeProperty({ priceManwon: 200_000 }),
        observations: makeObservations({ comparableTrades: trades(200_000) }),
      }),
    )
    expect(r.score!).toBeCloseTo(70, 0)
  })

  it('표본 3건 미만이면 결측', () => {
    const r = scoreValue(
      makeInput({ observations: makeObservations({ comparableTrades: trades(200_000, 2) }) }),
    )
    expect(r.score).toBeNull()
  })

  it('극단 이상치가 중앙값을 오염시키지 않음', () => {
    const withOutlier = [...trades(200_000, 10), {
      aptName: 'X', exclusiveM2: 84.9, amountManwon: 2_000_000,
      dealDate: '2026-06-01', floor: 5, buildYear: 2010,
    }]
    const r = scoreValue(
      makeInput({
        property: makeProperty({ priceManwon: 200_000 }),
        observations: makeObservations({ comparableTrades: withOutlier }),
      }),
    )
    expect(r.score!).toBeCloseTo(70, 0)
  })
})

describe('SUBWAY', () => {
  it('역이 가깝고 직통이면 고득점', () => {
    const r = scoreSubway(
      makeInput({
        observations: makeObservations({
          subwayStations: [{ name: 'A역 환승', lat: 0, lng: 0, distanceM: 200 }],
          officeSubwayRoute: {
            totalMinutes: 20, transferCount: 0, walkMeters: 400, pathType: 1, summary: '직통',
          },
        }),
      }),
    )
    expect(r.score!).toBeGreaterThan(90)
  })

  it('역이 멀고 환승이 많으면 저득점', () => {
    const r = scoreSubway(
      makeInput({
        observations: makeObservations({
          subwayStations: [{ name: 'A역', lat: 0, lng: 0, distanceM: 1400 }],
          officeSubwayRoute: {
            totalMinutes: 70, transferCount: 3, walkMeters: 900, pathType: 1, summary: '환승 3회',
          },
          placeSubwayRoutes: {
            f1: { totalMinutes: 60, transferCount: 3, walkMeters: 900, pathType: 1, summary: '환승 3회' },
          },
        }),
      }),
    )
    expect(r.score!).toBeLessThan(40)
  })

  it('더블역세권 가산이 적용된다', () => {
    const single = scoreSubway(
      makeInput({
        observations: makeObservations({
          subwayStations: [{ name: 'A역', lat: 0, lng: 0, distanceM: 600 }],
        }),
      }),
    ).score!
    const double = scoreSubway(
      makeInput({
        observations: makeObservations({
          subwayStations: [
            { name: 'A역', lat: 0, lng: 0, distanceM: 600 },
            { name: 'B역', lat: 0, lng: 0, distanceM: 700 },
          ],
        }),
      }),
    ).score!
    expect(double).toBeGreaterThan(single)
  })

  it('역 데이터가 없으면 결측', () => {
    const r = scoreSubway(
      makeInput({ observations: makeObservations({ subwayStations: null }) }),
    )
    expect(r.score).toBeNull()
  })
})

describe('BUS', () => {
  it('직통 버스가 있으면 환승보다 높다', () => {
    const direct = scoreBus(
      makeInput({
        observations: makeObservations({
          officeBusRoute: { totalMinutes: 40, transferCount: 0, walkMeters: 300, pathType: 2, summary: '직통' },
        }),
      }),
    ).score!
    const transfer = scoreBus(
      makeInput({
        observations: makeObservations({
          officeBusRoute: { totalMinutes: 40, transferCount: 2, walkMeters: 300, pathType: 2, summary: '환승 2회' },
        }),
      }),
    ).score!
    expect(direct).toBeGreaterThan(transfer)
  })
})

describe('SCHOOL', () => {
  it('초등학교가 가까우면 초등자녀 가구에서 고득점', () => {
    const r = scoreSchool(
      makeInput({
        user: makeUser({ household: { type: 'WITH_ELEMENTARY', members: 4 } }),
        observations: makeObservations({
          elementarySchools: [{ name: 'E', lat: 0, lng: 0, distanceM: 200 }],
        }),
      }),
    )
    expect(r.score!).toBeGreaterThan(85)
  })

  it('가구 유형에 따라 점수가 달라진다', () => {
    const obs = makeObservations({
      elementarySchools: [{ name: 'E', lat: 0, lng: 0, distanceM: 200 }],
      highSchools: [{ name: 'H', lat: 0, lng: 0, distanceM: 2500 }],
    })
    const elem = scoreSchool(
      makeInput({ user: makeUser({ household: { type: 'WITH_ELEMENTARY', members: 4 } }), observations: obs }),
    ).score!
    const secondary = scoreSchool(
      makeInput({ user: makeUser({ household: { type: 'WITH_SECONDARY', members: 4 } }), observations: obs }),
    ).score!
    expect(elem).toBeGreaterThan(secondary)
  })

  it('일부 학교급이 없어도 나머지로 계산된다', () => {
    const r = scoreSchool(
      makeInput({
        observations: makeObservations({ middleSchools: [], highSchools: [] }),
      }),
    )
    expect(r.score).not.toBeNull()
  })
})

describe('AGE', () => {
  const year = new Date().getFullYear()

  it('신축이 최고점', () => {
    expect(scoreAge(makeInput({ property: makeProperty({ buildYear: year }) })).score).toBe(100)
  })

  it('30년차가 저점', () => {
    const s30 = scoreAge(makeInput({ property: makeProperty({ buildYear: year - 30 }) })).score!
    const s20 = scoreAge(makeInput({ property: makeProperty({ buildYear: year - 20 }) })).score!
    const s40 = scoreAge(makeInput({ property: makeProperty({ buildYear: year - 40 }) })).score!
    expect(s30).toBeLessThan(s20)
    expect(s30).toBeLessThan(s40)
  })

  it('재건축 반등 상한은 68점 — DEVELOPMENT 축과 이중계상 방지', () => {
    const scores = [33, 36, 40, 45, 50].map(
      (a) => scoreAge(makeInput({ property: makeProperty({ buildYear: year - a }) })).score!,
    )
    expect(Math.max(...scores)).toBeLessThanOrEqual(68)
  })

  it('건축년도 미상이면 결측', () => {
    expect(scoreAge(makeInput({ property: makeProperty({ buildYear: null }) })).score).toBeNull()
  })
})

describe('RETAIL', () => {
  it('마트가 없으면 0점이되 결측은 아님', () => {
    const r = scoreRetail(makeInput({ observations: makeObservations({ marts: [] }) }))
    expect(r.score).toBe(0)
  })

  it('창고형 매장 가산', () => {
    const plain = scoreRetail(
      makeInput({ observations: makeObservations({ marts: [{ name: '이마트 A점', lat: 0, lng: 0, distanceM: 1200 }] }) }),
    ).score!
    const warehouse = scoreRetail(
      makeInput({ observations: makeObservations({ marts: [{ name: '코스트코 양재점', lat: 0, lng: 0, distanceM: 1200 }] }) }),
    ).score!
    expect(warehouse).toBeGreaterThan(plain)
  })
})

describe('AMENITY', () => {
  it('시설이 많고 관리비가 저렴하면 고득점', () => {
    const r = scoreAmenity(
      makeInput({
        property: makeProperty({
          communityFacilities: ['POOL', 'GYM', 'GOLF', 'STUDY_ROOM', 'DAYCARE', 'CAFE_LOUNGE'],
          monthlyFeePerM2: 1700,
          totalHouseholds: 2000,
        }),
      }),
    )
    expect(r.score!).toBeGreaterThan(85)
  })

  it('시설 미입력(빈 배열)은 0점이 아니라 관리비만으로 평가한다', () => {
    const r = scoreAmenity(
      makeInput({ property: makeProperty({ communityFacilities: [], monthlyFeePerM2: 2000 }) }),
    )
    expect(r.score).not.toBeNull()
    expect(r.score!).toBeGreaterThan(50)
  })

  it('시설·관리비 정보가 모두 없으면 결측', () => {
    const r = scoreAmenity(
      makeInput({
        property: makeProperty({ communityFacilities: undefined, monthlyFeePerM2: null }),
        observations: makeObservations({ regionAvgFeePerM2: null }),
      }),
    )
    expect(r.score).toBeNull()
  })
})

describe('DEVELOPMENT', () => {
  it('호재가 없으면 중립 40점 (결측 아님)', () => {
    const r = scoreDevelopment(makeInput({ property: makeProperty({ developments: [] }) }))
    expect(r.score).toBe(40)
  })

  it('확정 단계가 검토 단계보다 높다', () => {
    const confirmed = scoreDevelopment(
      makeInput({
        property: makeProperty({
          developments: [{ title: 'GTX', type: 'GTX_NEW_STATION', stage: 'CONFIRMED', distanceM: 500 }],
        }),
      }),
    ).score!
    const rumor = scoreDevelopment(
      makeInput({
        property: makeProperty({
          developments: [{ title: 'GTX', type: 'GTX_NEW_STATION', stage: 'RUMOR', distanceM: 500 }],
        }),
      }),
    ).score!
    expect(confirmed).toBeGreaterThan(rumor)
  })

  it('영향 반경 밖 호재는 제외된다', () => {
    const r = scoreDevelopment(
      makeInput({
        property: makeProperty({
          developments: [{ title: 'GTX', type: 'GTX_NEW_STATION', stage: 'CONFIRMED', distanceM: 5000 }],
        }),
      }),
    )
    expect(r.score).toBe(40)
  })

  it('악재는 감점되어 중립보다 낮다', () => {
    const r = scoreDevelopment(
      makeInput({
        property: makeProperty({
          developments: [
            { title: '소각장', type: 'AVOIDED_FACILITY', stage: 'CONFIRMED', distanceM: 500 },
          ],
        }),
      }),
    )
    expect(r.score).toBe(0)
  })
})

describe('INVESTMENT', () => {
  it('지표가 하나도 없으면 결측', () => {
    const r = scoreInvestment(
      makeInput({
        observations: makeObservations({
          marketMomentum: null,
          premiumPricePerPyeong: null,
          tradeCount12m: null,
          upcomingSupply: null,
        }),
      }),
    )
    expect(r.score).toBeNull()
  })

  it('일부 지표만 있어도 재정규화되어 산출된다', () => {
    const r = scoreInvestment(
      makeInput({
        observations: makeObservations({
          premiumPricePerPyeong: null,
          tradeCount12m: null,
          upcomingSupply: null,
        }),
      }),
    )
    expect(r.score).not.toBeNull()
    expect(r.raw.availableIndicators).toBe(1)
  })

  it('상승 모멘텀이 높으면 점수도 높다', () => {
    const low = scoreInvestment(makeInput({ observations: makeObservations({ marketMomentum: -0.1 }) })).score!
    const high = scoreInvestment(makeInput({ observations: makeObservations({ marketMomentum: 0.2 }) })).score!
    expect(high).toBeGreaterThan(low)
  })
})

describe('RISK', () => {
  it('리스크가 없으면 감점 0', () => {
    const { penalty } = evaluateRisks(makeInput())
    expect(penalty).toBe(0)
  })

  it('감점 총합은 15를 넘지 않는다', () => {
    const { penalty } = evaluateRisks(
      makeInput({
        property: makeProperty({
          userRisks: ['NOISE_FLOOR', 'NOISE_ROAD', 'NOISE_AIRCRAFT', 'STEEP_SLOPE', 'NIGHTLIFE', 'AVOIDED_FACILITY', 'PARKING_SHORTAGE'],
        }),
      }),
    )
    expect(penalty).toBe(MAX_RISK_PENALTY)
  })

  it('유흥업소 5곳 이상이면 자동 판정', () => {
    const spots = Array.from({ length: 6 }, (_, i) => ({
      name: `유흥주점 ${i}`, lat: 0, lng: 0, distanceM: 100 + i,
    }))
    const { risks } = evaluateRisks(
      makeInput({ observations: makeObservations({ nightlifeSpots: spots }) }),
    )
    const nightlife = risks.find((r) => r.code === 'NIGHTLIFE')
    expect(nightlife?.origin).toBe('auto')
  })

  it('주차 1.0대 미만이면 자동 감점', () => {
    const { risks } = evaluateRisks(
      makeInput({ property: makeProperty({ parkingPerHousehold: 0.6 }) }),
    )
    expect(risks.some((r) => r.code === 'PARKING_SHORTAGE')).toBe(true)
  })

  it('같은 리스크가 중복 계상되지 않는다', () => {
    const { risks } = evaluateRisks(
      makeInput({
        property: makeProperty({ parkingPerHousehold: 0.5, userRisks: ['PARKING_SHORTAGE'] }),
      }),
    )
    expect(risks.filter((r) => r.code === 'PARKING_SHORTAGE')).toHaveLength(1)
  })
})

describe('손상된 입력에 대한 내성', () => {
  it('알 수 없는 호재 유형·단계는 크래시가 아니라 무시', () => {
    const r = scoreDevelopment(
      makeInput({
        property: makeProperty({
          developments: [
            {
              title: '알 수 없는 것',
              type: 'UNKNOWN_TYPE' as never,
              stage: 'CONFIRMED',
              announcedAt: '2026-01-01',
            },
            {
              title: '단계가 이상함',
              type: 'GTX_NEW_STATION',
              stage: 'BOGUS' as never,
              announcedAt: '2026-01-01',
            },
          ],
        }),
      }),
    )
    // 유효한 호재가 하나도 남지 않으므로 중립 점수
    expect(r.score).not.toBeNull()
    expect(Number.isFinite(r.score!)).toBe(true)
  })

  it('알 수 없는 리스크 코드는 크래시가 아니라 무시', () => {
    const { risks, penalty } = evaluateRisks(
      makeInput({ property: makeProperty({ userRisks: ['MADE_UP' as never] }) }),
    )
    expect(risks.every((x) => x.code !== ('MADE_UP' as never))).toBe(true)
    expect(Number.isFinite(penalty)).toBe(true)
  })

  it.each([
    ['0', 0],
    ['음수', -84],
  ])('전용면적이 %s 이면 VALUE 는 만점이 아니라 결측', (_label, exclusiveM2) => {
    const r = scoreValue(
      makeInput({
        property: makeProperty({ exclusiveM2, priceManwon: 500_000 }),
        observations: makeObservations({
          comparableTrades: Array.from({ length: 8 }, (_, i) => ({
            aptName: '비교단지',
            exclusiveM2: 84,
            amountManwon: 150_000 + i * 1000,
            dealDate: '2026-01-01',
            floor: 10,
            buildYear: 2010,
          })),
        }),
      }),
    )
    expect(r.score).toBeNull()
  })
})
