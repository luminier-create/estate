/**
 * 스코어링 엔진 타입 정의
 * 설계 근거: docs/01-ALGORITHM.md
 */

/** 알고리즘 버전. 로직 변경 시 반드시 올린다 — 캐시 무효화 키로 쓰인다. */
export const ALGORITHM_VERSION = 'v1.0.1'

export const AXIS_CODES = [
  'COMMUTE',
  'VALUE',
  'SUBWAY',
  'SCHOOL',
  'BUS',
  'INVESTMENT',
  'AGE',
  'DEVELOPMENT',
  'RETAIL',
  'AMENITY',
] as const

export type AxisCode = (typeof AXIS_CODES)[number]

export const AXIS_LABEL: Record<AxisCode, string> = {
  COMMUTE: '사무실 통근',
  VALUE: '가격 대비 시세',
  SUBWAY: '지하철 접근성',
  SCHOOL: '학군 접근성',
  BUS: '버스 접근성',
  INVESTMENT: '투자 기회',
  AGE: '단지 노후도',
  DEVELOPMENT: '호재',
  RETAIL: '대형마트 접근성',
  AMENITY: '커뮤니티·관리비',
}

/** 모바일 레이더 차트용 축약 라벨 */
export const AXIS_LABEL_SHORT: Record<AxisCode, string> = {
  COMMUTE: '통근',
  VALUE: '시세',
  SUBWAY: '지하철',
  SCHOOL: '학군',
  BUS: '버스',
  INVESTMENT: '투자',
  AGE: '연식',
  DEVELOPMENT: '호재',
  RETAIL: '마트',
  AMENITY: '커뮤니티',
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'E'
export type Confidence = 'high' | 'medium' | 'low'

export interface GeoPoint {
  lat: number
  lng: number
}

export interface SourceRef {
  label: string
  url?: string
  /** 데이터 기준일 (YYYY-MM-DD). 사용자에게 반드시 노출한다. */
  asOf: string
}

export interface AxisResult {
  axis: AxisCode
  /** 0~100. null 이면 데이터 결측 — 총점 계산에서 가중치째 제외된다. */
  score: number | null
  weight: number
  /** 계산에 쓰인 원자료. 상세 화면 디버그 및 재현성 확보용. */
  raw: Record<string, unknown>
  /** 사용자 노출용 한 줄 근거 */
  reason: string
  /** 항목별 상세 설명 */
  details: string[]
  sources: SourceRef[]
  confidence: Confidence
}

export const RISK_CODES = [
  'NOISE_FLOOR',
  'NOISE_ROAD',
  'NOISE_AIRCRAFT',
  'STEEP_SLOPE',
  'NIGHTLIFE',
  'AVOIDED_FACILITY',
  'PARKING_SHORTAGE',
  'SUNLIGHT_BLOCKED',
  'COMMUNITY_OTHER',
] as const

export type RiskCode = (typeof RISK_CODES)[number]

export interface RiskItem {
  code: RiskCode
  label: string
  /** 양수로 기록하고 총점에서 차감한다. */
  penalty: number
  /** auto: 좌표·공개데이터 기반 자동 판정 / user: 사용자가 직접 확인 체크 */
  origin: 'auto' | 'user'
  reason: string
}

export interface ScoreResult {
  totalScore: number
  grade: Grade
  baseScore: number
  riskPenalty: number
  /** 0~1. 결측 축을 제외한 가중치 합의 비율. */
  confidence: number
  confidenceLabel: Confidence
  axes: AxisResult[]
  risks: RiskItem[]
  presetId: string
  version: string
  computedAt: string
}

// ─── 스코어링 입력 ────────────────────────────────────────────

export type HouseholdType =
  | 'SINGLE'
  | 'COUPLE'
  | 'WITH_PRESCHOOL'
  | 'WITH_ELEMENTARY'
  | 'WITH_SECONDARY'
  | 'NO_CHILDREN'

export type CommuteMode = 'TRANSIT' | 'CAR'

export interface FrequentPlace {
  id: string
  label: string
  lat: number
  lng: number
  /** 1=보통 2=중요 3=매우중요. 직결성 가중평균의 가중치로 쓰인다. */
  importance: 1 | 2 | 3
}

export interface OfficeInfo {
  label: string
  lat: number
  lng: number
  commuteMode: CommuteMode
  /** 목표 통근시간(분). 근거 문자열에서 기준선으로 표시된다. */
  targetMinutes: number
}

export interface UserContext {
  budget: { targetAmount: number; maxAmount: number | null }
  office: OfficeInfo | null
  frequentPlaces: FrequentPlace[]
  household: { type: HouseholdType; members: number }
}

export type DevelopmentType =
  | 'GTX_NEW_STATION'
  | 'SUBWAY_EXTENSION'
  | 'REDEVELOPMENT_SELF'
  | 'REDEVELOPMENT_NEARBY'
  | 'LARGE_DISTRICT'
  | 'CORPORATE_CAMPUS'
  | 'PARK_WATERFRONT'
  | 'ROAD_BRIDGE'
  | 'SCHOOL_NEW'
  | 'AVOIDED_FACILITY'

export type DevelopmentStage =
  | 'CONFIRMED'
  | 'APPROVED'
  | 'PLANNED'
  | 'PROPOSED'
  | 'RUMOR'

export interface DevelopmentItem {
  title: string
  type: DevelopmentType
  stage: DevelopmentStage
  sourceUrl?: string
  /** 단지로부터의 거리(m). 반경 조건 판정에 쓰인다. */
  distanceM?: number
  announcedAt?: string
}

export type CommunityFacility =
  | 'POOL'
  | 'GYM'
  | 'GOLF'
  | 'STUDY_ROOM'
  | 'DAYCARE'
  | 'CAFE_LOUNGE'
  | 'GUEST_HOUSE'
  | 'KIDS_ROOM'
  | 'SAUNA'
  | 'SPORTS_HALL'

export interface PropertyInput {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  lawdCd: string
  /** 전용면적 ㎡. 저장 정규 단위. */
  exclusiveM2: number
  /** 매입 희망/호가 금액 (만원) */
  priceManwon: number

  buildYear?: number | null
  totalHouseholds?: number | null
  parkingPerHousehold?: number | null
  /** 원/㎡ 월 관리비 */
  monthlyFeePerM2?: number | null
  communityFacilities?: CommunityFacility[]
  structureType?: 'WALL' | 'RAHMEN' | null

  userRisks?: RiskCode[]
  developments?: DevelopmentItem[]
}

// ─── Provider 가 채워 넣는 관측 데이터 ────────────────────────

export interface PlaceHit {
  name: string
  lat: number
  lng: number
  /** 직선거리(m) */
  distanceM: number
  category?: string
}

export interface TransitRoute {
  /** 총 소요시간(분) — 도보 포함 도어투도어 */
  totalMinutes: number
  /** 총 환승 횟수 (0 = 직통) */
  transferCount: number
  /** 총 도보거리(m) */
  walkMeters: number
  /** 1=지하철 2=버스 3=복합 */
  pathType: 1 | 2 | 3
  summary: string
}

export interface Trade {
  aptName: string
  exclusiveM2: number
  /** 거래금액 (만원) */
  amountManwon: number
  dealDate: string
  floor: number
  buildYear: number
  /** 단지 좌표를 알 수 있는 경우의 거리(m) */
  distanceM?: number
}

/** 축 계산기에 주입되는 관측 데이터 묶음. 실패한 항목은 null 이다. */
export interface Observations {
  subwayStations: PlaceHit[] | null
  busStops: PlaceHit[] | null
  elementarySchools: PlaceHit[] | null
  middleSchools: PlaceHit[] | null
  highSchools: PlaceHit[] | null
  marts: PlaceHit[] | null
  nightlifeSpots: PlaceHit[] | null
  avoidedFacilities: PlaceHit[] | null
  majorRoads: PlaceHit[] | null

  /** 단지 → 사무실 종합 경로 */
  officeRoute: TransitRoute | null
  /** 단지 → 사무실 지하철 전용 경로 */
  officeSubwayRoute: TransitRoute | null
  /** 단지 → 사무실 버스 전용 경로 */
  officeBusRoute: TransitRoute | null
  /** 자주 가는 장소별 경로 (placeId → route) */
  placeSubwayRoutes: Record<string, TransitRoute> | null
  placeBusRoutes: Record<string, TransitRoute> | null

  /** 시세 비교군 실거래 */
  comparableTrades: Trade[] | null
  /** 비교군 산출에 쓰인 범위 설명 */
  comparableScope: string | null
  /** 최근 12개월 인근 평단가 변동률 (예: 0.08 = +8%) */
  marketMomentum: number | null
  /** 생활권 상위 25% 평단가 (만원/평) */
  premiumPricePerPyeong: number | null
  /** 최근 12개월 해당 단지 거래건수 */
  tradeCount12m: number | null
  /** 반경 2km 향후 3년 입주예정 세대수 */
  upcomingSupply: number | null
  /** 반경 2km 기존 세대수 */
  existingHouseholds: number | null
  /** 시·군·구 평균 ㎡당 관리비 (원) */
  regionAvgFeePerM2: number | null
  /** 단지 진입로 평균 경사도 (0.08 = 8%) */
  approachSlope: number | null
}

export type Weights = Record<AxisCode, number>

export interface ScoringInput {
  property: PropertyInput
  user: UserContext
  observations: Observations
  weights: Weights
  presetId: string
}
