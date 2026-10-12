/** 테스트용 입력 빌더 — 기본값에서 필요한 부분만 덮어쓴다. */
import type {
  Observations,
  PropertyInput,
  ScoringInput,
  UserContext,
} from '@/lib/scoring/types'
import { getPreset } from '@/lib/scoring/presets'

export function makeProperty(over: Partial<PropertyInput> = {}): PropertyInput {
  return {
    id: 'p1',
    name: '테스트아파트',
    address: '서울특별시 강남구 도곡동 000',
    lat: 37.4908,
    lng: 127.0482,
    lawdCd: '11680',
    exclusiveM2: 84.9,
    priceManwon: 180_000,
    buildYear: 2010,
    totalHouseholds: 1200,
    parkingPerHousehold: 1.4,
    monthlyFeePerM2: 2300,
    communityFacilities: ['GYM', 'STUDY_ROOM'],
    structureType: 'WALL',
    userRisks: [],
    developments: [],
    ...over,
  }
}

export function makeUser(over: Partial<UserContext> = {}): UserContext {
  return {
    budget: { targetAmount: 180_000, maxAmount: 200_000 },
    office: {
      label: '사무실',
      lat: 37.5006,
      lng: 127.0364,
      commuteMode: 'TRANSIT',
      targetMinutes: 30,
    },
    frequentPlaces: [
      { id: 'f1', label: '강남역', lat: 37.4979, lng: 127.0276, importance: 2 },
    ],
    household: { type: 'WITH_ELEMENTARY', members: 4 },
    ...over,
  }
}

export function makeObservations(over: Partial<Observations> = {}): Observations {
  return {
    subwayStations: [
      { name: '도곡역 3호선 수인분당선 환승', lat: 37.4909, lng: 127.0552, distanceM: 400 },
    ],
    busStops: [{ name: '도곡2동주민센터 (지선)', lat: 37.4895, lng: 127.0489, distanceM: 200 }],
    elementarySchools: [{ name: '도곡초등학교', lat: 37.4892, lng: 127.0438, distanceM: 300 }],
    middleSchools: [{ name: '도곡중학교', lat: 37.4872, lng: 127.0474, distanceM: 500 }],
    highSchools: [{ name: '중동고등학교', lat: 37.4928, lng: 127.0562, distanceM: 800 }],
    marts: [{ name: '이마트 역삼점', lat: 37.5018, lng: 127.0413, distanceM: 900 }],
    nightlifeSpots: [],
    avoidedFacilities: [],
    majorRoads: [],
    officeRoute: {
      totalMinutes: 28,
      transferCount: 0,
      walkMeters: 500,
      pathType: 3,
      summary: '대중교통 직통 · 2.1km',
    },
    officeSubwayRoute: {
      totalMinutes: 25,
      transferCount: 0,
      walkMeters: 600,
      pathType: 1,
      summary: '지하철 직통',
    },
    officeBusRoute: {
      totalMinutes: 32,
      transferCount: 1,
      walkMeters: 400,
      pathType: 2,
      summary: '버스 환승 1회',
    },
    placeSubwayRoutes: {
      f1: { totalMinutes: 20, transferCount: 1, walkMeters: 500, pathType: 1, summary: '지하철 환승 1회' },
    },
    placeBusRoutes: {
      f1: { totalMinutes: 26, transferCount: 0, walkMeters: 300, pathType: 2, summary: '버스 직통' },
    },
    comparableTrades: Array.from({ length: 12 }, (_, i) => ({
      aptName: '인근아파트',
      exclusiveM2: 84.9,
      amountManwon: 190_000 + i * 1000,
      dealDate: '2026-06-15',
      floor: 10,
      buildYear: 2010,
    })),
    comparableScope: '반경 1km · 전용 84㎡ ±5㎡ · 최근 6개월',
    marketMomentum: 0.06,
    premiumPricePerPyeong: 9000,
    tradeCount12m: 30,
    upcomingSupply: 500,
    existingHouseholds: 12_000,
    regionAvgFeePerM2: 2400,
    approachSlope: 0.02,
    ...over,
  }
}

export function makeInput(over: Partial<ScoringInput> = {}): ScoringInput {
  return {
    property: makeProperty(),
    user: makeUser(),
    observations: makeObservations(),
    weights: getPreset('balanced').weights,
    presetId: 'balanced',
    ...over,
  }
}
