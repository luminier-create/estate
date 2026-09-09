'use server'
/** 서버 액션 — 모든 입력은 Zod 로 검증한다. */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/firebase/session'
import {
  analysisId,
  getProfile,
  getProperty,
  listProperties,
  profileHash,
  saveAnalysis,
  saveProperty,
  updateProfile,
  updateProperty,
  deleteProperty,
} from '@/lib/repo'
import type { StoredProperty } from '@/lib/repo/types'
import { analyzeProperty } from '@/lib/analyze'
import { geoProvider, providerStatus } from '@/lib/providers'
import { cachedCall } from '@/lib/cache'
import { CACHE_POLICY, geocodeKey } from '@/lib/cache-keys'
import { pyeongToM2 } from '@/lib/scoring/normalize'
import { AXIS_CODES, RISK_CODES } from '@/lib/scoring/types'

const placeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(40),
  address: z.string().max(200),
  lat: z.number(),
  lng: z.number(),
  importance: z.union([z.literal(1), z.literal(2), z.literal(3)]),
})

const profileSchema = z.object({
  targetAmount: z.number().min(0).max(10_000_000),
  maxAmount: z.number().min(0).max(10_000_000).nullable(),
  office: z
    .object({
      label: z.string().min(1).max(40),
      address: z.string().max(200),
      lat: z.number(),
      lng: z.number(),
      commuteMode: z.enum(['TRANSIT', 'CAR']),
      targetMinutes: z.number().min(5).max(180),
    })
    .nullable(),
  frequentPlaces: z.array(placeSchema).max(10),
  household: z.object({
    type: z.enum([
      'SINGLE',
      'COUPLE',
      'WITH_PRESCHOOL',
      'WITH_ELEMENTARY',
      'WITH_SECONDARY',
      'NO_CHILDREN',
    ]),
    members: z.number().min(1).max(10),
  }),
  areaUnit: z.enum(['PYEONG', 'M2']).optional(),
  presetId: z.string().optional(),
  customWeights: z.record(z.string(), z.number()).optional(),
  completeOnboarding: z.boolean().optional(),
})

export type ProfileFormInput = z.input<typeof profileSchema>

export async function saveProfileAction(input: ProfileFormInput) {
  const user = await requireUser()
  const data = profileSchema.parse(input)

  await updateProfile(user.uid, {
    budget: { targetAmount: data.targetAmount, maxAmount: data.maxAmount },
    office: data.office,
    frequentPlaces: data.frequentPlaces,
    household: data.household,
    ...(data.areaUnit ? { areaUnit: data.areaUnit } : {}),
    ...(data.presetId
      ? {
          weights: {
            presetId: data.presetId,
            ...(data.customWeights ? { custom: data.customWeights } : {}),
          },
        }
      : {}),
    ...(data.completeOnboarding ? { onboardingCompleted: true } : {}),
  })

  revalidatePath('/dashboard')
  revalidatePath('/settings')
  return { ok: true as const }
}

const propertySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(60),
  address: z.string().min(1).max(200),
  lat: z.number().optional(),
  lng: z.number().optional(),
  areaValue: z.number().min(1).max(600),
  inputUnit: z.enum(['PYEONG', 'M2']),
  priceManwon: z.number().min(100).max(10_000_000),
  priceType: z.enum(['ASKING', 'TARGET']),
  buildYear: z.number().min(1900).max(2100).nullable(),
  totalHouseholds: z.number().min(1).max(50_000).nullable(),
  parkingPerHousehold: z.number().min(0).max(5).nullable(),
  monthlyFeePerM2: z.number().min(0).max(50_000).nullable(),
  communityFacilities: z.array(z.string()),
  structureType: z.enum(['WALL', 'RAHMEN']).nullable(),
  userRisks: z.array(z.string()),
  memo: z.string().max(1000).nullable(),
})

export type PropertyFormInput = z.input<typeof propertySchema>

export async function savePropertyAction(input: PropertyFormInput) {
  const user = await requireUser()
  const data = propertySchema.parse(input)

  // 좌표가 없으면 주소로 지오코딩한다
  let lat = data.lat
  let lng = data.lng
  let legalCode = ''
  let lawdCd = ''

  // 주소→좌표는 변하지 않으므로 무기한 캐시한다
  const query = data.address || data.name
  const geocoded = await cachedCall(
    CACHE_POLICY.geo,
    geocodeKey(query),
    providerStatus.geo === 'kakao' ? 'kakao' : null,
    () => geoProvider().geocode(query),
  ).catch(() => null)

  if (geocoded) {
    lat ??= geocoded.lat
    lng ??= geocoded.lng
    legalCode = geocoded.legalCode
    lawdCd = geocoded.lawdCd
  }
  if (lat === undefined || lng === undefined) {
    return { ok: false as const, error: '주소의 좌표를 찾지 못했습니다. 주소를 다시 확인하십시오.' }
  }

  const exclusiveM2 =
    data.inputUnit === 'PYEONG' ? pyeongToM2(data.areaValue) : data.areaValue

  const now = new Date().toISOString()
  const id = data.id ?? `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const existing = data.id ? await getProperty(user.uid, data.id) : null

  const property: StoredProperty = {
    id,
    name: data.name,
    address: data.address,
    lat,
    lng,
    legalCode: legalCode || existing?.legalCode || '',
    lawdCd: lawdCd || existing?.lawdCd || '',
    exclusiveM2: Math.round(exclusiveM2 * 100) / 100,
    inputUnit: data.inputUnit,
    priceManwon: data.priceManwon,
    priceType: data.priceType,
    buildYear: data.buildYear,
    totalHouseholds: data.totalHouseholds,
    parkingPerHousehold: data.parkingPerHousehold,
    monthlyFeePerM2: data.monthlyFeePerM2,
    communityFacilities: data.communityFacilities as StoredProperty['communityFacilities'],
    structureType: data.structureType,
    userRisks: data.userRisks.filter((r): r is (typeof RISK_CODES)[number] =>
      (RISK_CODES as readonly string[]).includes(r),
    ),
    developments: existing?.developments ?? [],
    memo: data.memo,
    status: 'ACTIVE',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  await saveProperty(user.uid, property)
  await runAnalysis(property.id).catch(() => null)

  revalidatePath('/dashboard')
  revalidatePath('/compare')
  return { ok: true as const, id }
}

/**
 * 후보에서 빼되 기록은 남긴다.
 * 삭제는 되돌릴 수 없어서, 고민 중인 단지를 치우는 용도로는 과하다.
 */
export async function setPropertyStatusAction(
  id: string,
  status: 'ACTIVE' | 'ARCHIVED',
) {
  const user = await requireUser()
  await updateProperty(user.uid, id, { status })
  revalidatePath('/dashboard')
  revalidatePath('/compare')
  revalidatePath(`/properties/${id}`)
  return { ok: true as const }
}

export async function deletePropertyAction(id: string) {
  const user = await requireUser()
  await deleteProperty(user.uid, id)
  revalidatePath('/dashboard')
  revalidatePath('/compare')
  return { ok: true as const }
}

const developmentSchema = z.object({
  propertyId: z.string().min(1),
  title: z.string().min(1).max(80),
  type: z.enum([
    'GTX_NEW_STATION',
    'SUBWAY_EXTENSION',
    'REDEVELOPMENT_SELF',
    'REDEVELOPMENT_NEARBY',
    'LARGE_DISTRICT',
    'CORPORATE_CAMPUS',
    'PARK_WATERFRONT',
    'ROAD_BRIDGE',
    'SCHOOL_NEW',
    'AVOIDED_FACILITY',
  ]),
  stage: z.enum(['CONFIRMED', 'APPROVED', 'PLANNED', 'PROPOSED', 'RUMOR']),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  distanceM: z.number().min(0).max(20_000).optional(),
})

export async function addDevelopmentAction(input: z.input<typeof developmentSchema>) {
  const user = await requireUser()
  const data = developmentSchema.parse(input)
  const property = await getProperty(user.uid, data.propertyId)
  if (!property) return { ok: false as const, error: '단지를 찾을 수 없습니다.' }

  await updateProperty(user.uid, data.propertyId, {
    developments: [
      ...property.developments,
      {
        title: data.title,
        type: data.type,
        stage: data.stage,
        sourceUrl: data.sourceUrl || undefined,
        distanceM: data.distanceM,
        announcedAt: new Date().toISOString().slice(0, 10),
      },
    ],
  })

  await runAnalysis(data.propertyId).catch(() => null)
  revalidatePath(`/properties/${data.propertyId}`)
  return { ok: true as const }
}

/** 단지 분석 실행 후 결과를 저장한다. */
export async function runAnalysis(propertyId: string, presetId?: string) {
  const user = await requireUser()
  const [property, profile] = await Promise.all([
    getProperty(user.uid, propertyId),
    getProfile(user.uid),
  ])
  if (!property || !profile) {
    return { ok: false as const, error: '단지 또는 프로필을 찾을 수 없습니다.' }
  }

  const { result, inferredBuildYear, landmarks } = await analyzeProperty(
    property,
    profile,
    presetId,
  )
  if (inferredBuildYear) {
    await updateProperty(user.uid, propertyId, { buildYear: inferredBuildYear })
  }
  const hash = profileHash(profile)
  const id = analysisId(propertyId, hash, result.presetId)

  await saveAnalysis(user.uid, {
    ...result,
    id,
    propertyId,
    profileHash: hash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    landmarks,
  })

  revalidatePath('/dashboard')
  revalidatePath(`/properties/${propertyId}`)
  return { ok: true as const, totalScore: result.totalScore }
}

/** 전체 후보 재분석. 프로필 변경 후 호출한다. */
export async function reanalyzeAllAction() {
  const user = await requireUser()
  const properties = await listProperties(user.uid)
  const results = await Promise.allSettled(
    properties.map((p) => runAnalysis(p.id)),
  )
  revalidatePath('/dashboard')
  return {
    ok: true as const,
    total: properties.length,
    failed: results.filter((r) => r.status === 'rejected').length,
  }
}

const weightSchema = z.object({
  presetId: z.string().min(1),
  custom: z.record(z.string(), z.number()).optional(),
})

export async function saveWeightsAction(input: z.input<typeof weightSchema>) {
  const user = await requireUser()
  const data = weightSchema.parse(input)
  const custom = data.custom
    ? Object.fromEntries(
        AXIS_CODES.map((code) => [code, Math.max(0, data.custom?.[code] ?? 0)]),
      )
    : undefined

  await updateProfile(user.uid, {
    weights: { presetId: data.presetId, ...(custom ? { custom } : {}) },
  })
  await reanalyzeAllAction()
  return { ok: true as const }
}
