import 'server-only'
/** Firestore 접근 계층. 경로 규칙을 한곳에 모은다. */
import { store } from './store'
import type { StoredAnalysis, StoredProfile, StoredProperty } from './types'
import { shortHash, stableStringify } from '../utils'
import { ALGORITHM_VERSION } from '../scoring/types'

const userPath = (uid: string) => `users/${uid}`
const propsPath = (uid: string) => `users/${uid}/properties`
const propPath = (uid: string, id: string) => `${propsPath(uid)}/${id}`
const analysesPath = (uid: string) => `users/${uid}/analyses`
const analysisPath = (uid: string, id: string) => `${analysesPath(uid)}/${id}`

// ─── 프로필 ──────────────────────────────────────────────────

export async function getProfile(uid: string): Promise<StoredProfile | null> {
  return store().get<StoredProfile>(userPath(uid))
}

export async function ensureProfile(user: {
  uid: string
  email: string
  displayName: string
  photoURL: string | null
}): Promise<StoredProfile> {
  const existing = await getProfile(user.uid)
  if (existing) return existing

  const now = new Date().toISOString()
  const fresh: StoredProfile = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    budget: { targetAmount: 0, maxAmount: null },
    office: null,
    frequentPlaces: [],
    household: { type: 'COUPLE', members: 2 },
    weights: { presetId: 'balanced' },
    areaUnit: 'PYEONG',
    onboardingCompleted: false,
    createdAt: now,
    updatedAt: now,
  }
  await store().set(userPath(user.uid), fresh)
  return fresh
}

export async function updateProfile(
  uid: string,
  patch: Partial<StoredProfile>,
): Promise<void> {
  await store().update<StoredProfile>(userPath(uid), {
    ...patch,
    updatedAt: new Date().toISOString(),
  })
}

/**
 * 프로필 해시. 분석 캐시 무효화 키다.
 * 예산·사무실·자주 가는 장소·가구 구성이 바뀌면 자동으로 재분석된다.
 */
export function profileHash(p: StoredProfile): string {
  return shortHash(
    stableStringify({
      budget: p.budget,
      office: p.office,
      frequentPlaces: p.frequentPlaces,
      household: p.household,
    }),
  )
}

// ─── 단지 ────────────────────────────────────────────────────

export async function listProperties(uid: string): Promise<StoredProperty[]> {
  const all = await store().list<StoredProperty>(propsPath(uid))
  return all
    .filter((p) => p.status === 'ACTIVE')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** 보류함으로 옮긴 단지. 순위 계산과 비교에서 빠진다. */
export async function listArchivedProperties(
  uid: string,
): Promise<StoredProperty[]> {
  const all = await store().list<StoredProperty>(propsPath(uid))
  return all
    .filter((p) => p.status === 'ARCHIVED')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getProperty(
  uid: string,
  id: string,
): Promise<StoredProperty | null> {
  return store().get<StoredProperty>(propPath(uid, id))
}

export async function saveProperty(
  uid: string,
  property: StoredProperty,
): Promise<void> {
  await store().set(propPath(uid, property.id), property)
}

export async function updateProperty(
  uid: string,
  id: string,
  patch: Partial<StoredProperty>,
): Promise<void> {
  await store().update<StoredProperty>(propPath(uid, id), {
    ...patch,
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteProperty(uid: string, id: string): Promise<void> {
  await store().delete(propPath(uid, id))
}

// ─── 분석 ────────────────────────────────────────────────────

export function analysisId(
  propertyId: string,
  hash: string,
  presetId: string,
): string {
  return `${propertyId}_${hash}_${presetId}`
}

export async function getAnalysis(
  uid: string,
  id: string,
): Promise<StoredAnalysis | null> {
  const a = await store().get<StoredAnalysis>(analysisPath(uid, id))
  if (!a) return null
  if (new Date(a.expiresAt).getTime() < Date.now()) return null
  // 스코어링 로직이 바뀌면 기존 결과는 낡은 값이므로 버립니다
  if (a.version !== ALGORITHM_VERSION) return null
  return a
}

export async function saveAnalysis(
  uid: string,
  analysis: StoredAnalysis,
): Promise<void> {
  await store().set(analysisPath(uid, analysis.id), analysis)
}

export async function listAnalyses(uid: string): Promise<StoredAnalysis[]> {
  return store().list<StoredAnalysis>(analysesPath(uid))
}

export { store, isDemoStore } from './store'
export type { StoredAnalysis, StoredProfile, StoredProperty } from './types'
