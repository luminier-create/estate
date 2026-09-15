import 'server-only'
/**
 * 데모 워크스페이스 시딩.
 *
 * 왜 필요한가 — Firebase Admin 이 없으면 저장소가 **프로세스 메모리**다.
 * 서버리스(Vercel 등)에 올리면 인스턴스마다 메모리가 따로라, 방문자가 단지를
 * 등록해도 다음 요청이 다른 인스턴스로 가면 그 단지가 없다. 빈 대시보드에서
 * 시작하게 두면 "등록했는데 사라졌다"가 첫인상이 된다.
 *
 * 그래서 **어느 인스턴스에서든 같은 결과**가 나오도록, 첫 요청에 후보 3건과
 * 그 분석까지 만들어 둔다. Mock Provider 가 결정적이므로 인스턴스가 달라도
 * 같은 좌표·같은 점수가 나온다.
 *
 * 이것은 배포 시연용 보조 장치이고 기본은 꺼져 있다 (`DEMO_SEED=1` 로 켠다).
 * 영속 저장이 필요하면 Firebase Admin 을 설정하는 것이 정답이며, 그때는
 * 저장소가 Firestore 로 바뀌므로 이 경로 자체를 타지 않는다.
 */
import { analyzeProperty } from './analyze'
import { cachedCall } from './cache'
import { CACHE_POLICY, geocodeKey } from './cache-keys'
import { geoProvider, providerStatus } from './providers'
import {
  analysisId,
  getProfile,
  listProperties,
  profileHash,
  saveAnalysis,
  saveProperty,
  updateProfile,
} from './repo'
import { isDemoStore } from './repo/store'
import type { StoredProperty } from './repo/types'
import { pyeongToM2 } from './scoring/normalize'

/** 켜져 있을 때만 시딩한다. 로컬 개발·E2E 의 초기 상태를 바꾸지 않기 위함이다. */
export const demoSeedEnabled =
  process.env.DEMO_SEED === '1' || process.env.DEMO_SEED === 'true'

/**
 * 실존 단지명에 임의의 가격을 붙이면 시세 정보로 읽힌다.
 * 이름에 `(예시)` 를 붙여 화면 어디에서 보든 실제 매물이 아님이 드러나게 한다.
 */
const SEED_PROPERTIES = [
  {
    name: '(예시) 도곡 스카이뷰',
    address: '서울 강남구 도곡동',
    pyeong: 25.7,
    priceManwon: 180_000,
    buildYear: 2005,
    totalHouseholds: 640,
  },
  {
    name: '(예시) 상계 한들마을',
    address: '서울 노원구 상계동',
    pyeong: 18.5,
    priceManwon: 75_000,
    buildYear: 1990,
    totalHouseholds: 1_120,
  },
  {
    name: '(예시) 일산 물빛마을',
    address: '경기 고양시 일산서구',
    pyeong: 32.1,
    priceManwon: 95_000,
    buildYear: 1996,
    totalHouseholds: 880,
  },
] as const

const SEED_PROFILE = {
  budget: { targetAmount: 180_000, maxAmount: 200_000 },
  officeQuery: '역삼',
  placeQuery: '강남역',
} as const

async function geocode(query: string) {
  const geo = geoProvider()
  return cachedCall(
    CACHE_POLICY.geo,
    geocodeKey(geo.name, query),
    providerStatus.geo === 'kakao' ? 'kakao' : null,
    () => geo.geocode(query),
  ).catch(() => null)
}

/**
 * 데모 사용자에게 후보 3건과 분석을 채운다.
 *
 * 이미 단지가 있으면 아무것도 하지 않는다 — 방문자가 만든 것을 덮지 않기 위함이고,
 * 같은 인스턴스가 요청을 반복해서 받아도 멱등이어야 하기 때문이다.
 */
export async function ensureDemoSeed(uid: string): Promise<void> {
  if (!demoSeedEnabled || !isDemoStore()) return

  const existing = await listProperties(uid)
  if (existing.length > 0) return

  const profile = await getProfile(uid)
  if (!profile) return

  const [office, place] = await Promise.all([
    geocode(SEED_PROFILE.officeQuery),
    geocode(SEED_PROFILE.placeQuery),
  ])

  await updateProfile(uid, {
    budget: { ...SEED_PROFILE.budget },
    office: office
      ? {
          label: SEED_PROFILE.officeQuery,
          address: office.address,
          lat: office.lat,
          lng: office.lng,
          commuteMode: 'TRANSIT',
          targetMinutes: 30,
        }
      : null,
    frequentPlaces: place
      ? [
          {
            id: 'seed_place_1',
            label: SEED_PROFILE.placeQuery,
            address: place.address,
            lat: place.lat,
            lng: place.lng,
            importance: 2,
          },
        ]
      : [],
    household: { type: 'WITH_ELEMENTARY', members: 3 },
    onboardingCompleted: true,
  })

  const seeded = await getProfile(uid)
  if (!seeded) return

  const now = new Date().toISOString()
  for (const [i, spec] of SEED_PROPERTIES.entries()) {
    const geo = await geocode(spec.address)
    if (!geo) continue

    const property: StoredProperty = {
      // 인스턴스가 달라도 같은 ID 여야 링크가 깨지지 않는다 — 시각·난수를 쓰지 않는다
      id: `p_seed_${i + 1}`,
      name: spec.name,
      address: geo.address || spec.address,
      lat: geo.lat,
      lng: geo.lng,
      legalCode: geo.legalCode,
      lawdCd: geo.lawdCd,
      exclusiveM2: Math.round(pyeongToM2(spec.pyeong) * 100) / 100,
      inputUnit: 'PYEONG',
      priceManwon: spec.priceManwon,
      priceType: 'ASKING',
      buildYear: spec.buildYear,
      totalHouseholds: spec.totalHouseholds,
      parkingPerHousehold: null,
      monthlyFeePerM2: null,
      communityFacilities: [],
      structureType: null,
      userRisks: [],
      developments: [],
      memo: null,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    }
    await saveProperty(uid, property)

    const { result, landmarks } = await analyzeProperty(property, seeded)
    const hash = profileHash(seeded)
    await saveAnalysis(uid, {
      ...result,
      id: analysisId(property.id, hash, result.presetId),
      propertyId: property.id,
      profileHash: hash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      landmarks,
    })
  }
}
