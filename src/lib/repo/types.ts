/** Firestore 문서 타입. 설계 근거: docs/04-DATA-MODEL.md */
import type {
  CommunityFacility,
  Landmark,
  DevelopmentItem,
  HouseholdType,
  CommuteMode,
  RiskCode,
  ScoreResult,
} from '../scoring/types'

export interface StoredPlace {
  id: string
  label: string
  address: string
  lat: number
  lng: number
  importance: 1 | 2 | 3
}

export interface StoredProfile {
  uid: string
  email: string
  displayName: string
  photoURL: string | null
  budget: { targetAmount: number; maxAmount: number | null }
  office: {
    label: string
    address: string
    lat: number
    lng: number
    commuteMode: CommuteMode
    targetMinutes: number
  } | null
  frequentPlaces: StoredPlace[]
  household: { type: HouseholdType; members: number }
  weights: { presetId: string; custom?: Record<string, number> }
  /** 면적 표시 단위 선호 */
  areaUnit: 'PYEONG' | 'M2'
  onboardingCompleted: boolean
  createdAt: string
  updatedAt: string
}

export interface StoredProperty {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  legalCode: string
  lawdCd: string
  exclusiveM2: number
  inputUnit: 'PYEONG' | 'M2'
  priceManwon: number
  priceType: 'ASKING' | 'TARGET'
  buildYear: number | null
  totalHouseholds: number | null
  parkingPerHousehold: number | null
  monthlyFeePerM2: number | null
  communityFacilities: CommunityFacility[]
  structureType: 'WALL' | 'RAHMEN' | null
  userRisks: RiskCode[]
  developments: DevelopmentItem[]
  memo: string | null
  status: 'ACTIVE' | 'ARCHIVED'
  createdAt: string
  updatedAt: string
}

export interface StoredAnalysis extends ScoreResult {
  id: string
  propertyId: string
  profileHash: string
  expiresAt: string
  /** 지도 표시용. 이 필드가 없던 시기의 분석 결과와 호환되도록 optional 이다. */
  landmarks?: Landmark[]
}
