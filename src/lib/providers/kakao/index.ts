import 'server-only'
/**
 * 카카오 로컬 REST API Provider
 * 스펙: docs/03-DATA-SOURCES.md §2
 *
 * 주의: 좌표 파라미터는 x=경도(lng), y=위도(lat) 순서다.
 */
import { haversineM } from '../../scoring/normalize'
import type { GeoPoint, PlaceHit } from '../../scoring/types'
import type {
  CategoryCode,
  GeocodeResult,
  GeoProvider,
  PlaceSearchResult,
} from '../types'

const BASE = 'https://dapi.kakao.com/v2/local'
const TIMEOUT_MS = 6000

/** 카카오 카테고리 그룹 코드. 버스정류장·유흥업소는 코드가 없어 키워드로 대체한다. */
const CATEGORY_GROUP: Partial<Record<CategoryCode, string>> = {
  SUBWAY: 'SW8',
  MART: 'MT1',
  ELEMENTARY: 'SC4',
  MIDDLE: 'SC4',
  HIGH: 'SC4',
}

/** 학교급 판별 — category_name 이 "교육,학문 > 학교 > 초등학교" 형태로 온다. */
const SCHOOL_PATTERN: Partial<Record<CategoryCode, RegExp>> = {
  ELEMENTARY: /초등학교/,
  MIDDLE: /중학교/,
  HIGH: /고등학교/,
}

/** 카테고리 코드가 없는 항목은 키워드 검색으로 근사한다. */
const KEYWORD_QUERIES: Partial<Record<CategoryCode, string[]>> = {
  NIGHTLIFE: ['유흥주점', '단란주점', '클럽'],
  AVOIDED: ['소각장', '자원회수시설', '변전소', '하수처리장'],
  MAJOR_ROAD: ['대로', '고속도로 나들목'],
}

interface KakaoDoc {
  place_name?: string
  address_name?: string
  road_address_name?: string
  category_name?: string
  category_group_code?: string
  x: string
  y: string
  id?: string
}

interface KakaoAddressDoc {
  address_name: string
  x: string
  y: string
  address?: { b_code?: string } | null
  road_address?: { address_name?: string } | null
}

async function kakaoFetch<T>(
  path: string,
  params: Record<string, string | number>,
  apiKey: string,
): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v))
  }
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: 86_400 },
  })
  if (!res.ok) {
    throw new Error(`카카오 로컬 API 오류 ${res.status}: ${await res.text()}`)
  }
  return (await res.json()) as T
}

export class KakaoGeoProvider implements GeoProvider {
  readonly name = 'kakao'

  constructor(private readonly apiKey: string) {}

  async geocode(address: string): Promise<GeocodeResult | null> {
    const data = await kakaoFetch<{ documents: KakaoAddressDoc[] }>(
      '/search/address.json',
      { query: address, size: 1 },
      this.apiKey,
    )
    const doc = data.documents[0]
    if (!doc) return this.geocodeByKeyword(address)

    const legalCode = doc.address?.b_code ?? ''
    return {
      lat: Number(doc.y),
      lng: Number(doc.x),
      address: doc.address_name,
      roadAddress: doc.road_address?.address_name ?? null,
      legalCode,
      lawdCd: legalCode.slice(0, 5),
      regionName: doc.address_name,
    }
  }

  /** 주소 검색이 실패하면 장소명으로 재시도한다 (단지명만 입력한 경우). */
  private async geocodeByKeyword(query: string): Promise<GeocodeResult | null> {
    const data = await kakaoFetch<{ documents: KakaoDoc[] }>(
      '/search/keyword.json',
      { query, size: 1 },
      this.apiKey,
    )
    const doc = data.documents[0]
    if (!doc) return null

    const lat = Number(doc.y)
    const lng = Number(doc.x)
    const region = await this.regionCode({ lat, lng })

    return {
      lat,
      lng,
      address: doc.address_name ?? query,
      roadAddress: doc.road_address_name ?? null,
      legalCode: region.legalCode,
      lawdCd: region.legalCode.slice(0, 5),
      regionName: region.regionName,
    }
  }

  /** 좌표 → 법정동코드. 실거래가 조회의 LAWD_CD 는 이 값 앞 5자리다. */
  async regionCode(at: GeoPoint): Promise<{ legalCode: string; regionName: string }> {
    const data = await kakaoFetch<{
      documents: { region_type: string; code: string; address_name: string }[]
    }>('/geo/coord2regioncode.json', { x: at.lng, y: at.lat }, this.apiKey)

    const legal = data.documents.find((d) => d.region_type === 'B') ?? data.documents[0]
    return {
      legalCode: legal?.code ?? '',
      regionName: legal?.address_name ?? '',
    }
  }

  async searchPlaces(query: string, near?: GeoPoint): Promise<PlaceSearchResult[]> {
    const params: Record<string, string | number> = { query, size: 15 }
    if (near) {
      params.x = near.lng
      params.y = near.lat
      params.sort = 'distance'
    }
    const data = await kakaoFetch<{ documents: KakaoDoc[] }>(
      '/search/keyword.json',
      params,
      this.apiKey,
    )
    return data.documents.map((d, i) => ({
      id: d.id ?? `kakao-${i}`,
      name: d.place_name ?? '',
      lat: Number(d.y),
      lng: Number(d.x),
      address: d.address_name ?? '',
      roadAddress: d.road_address_name ?? null,
      categoryName: d.category_name ?? null,
    }))
  }

  async nearbyByCategory(
    category: CategoryCode,
    at: GeoPoint,
    radiusM: number,
  ): Promise<PlaceHit[]> {
    const groupCode = CATEGORY_GROUP[category]
    const docs: KakaoDoc[] = []

    if (groupCode) {
      const data = await kakaoFetch<{ documents: KakaoDoc[] }>(
        '/search/category.json',
        {
          category_group_code: groupCode,
          x: at.lng,
          y: at.lat,
          radius: Math.min(20_000, radiusM),
          sort: 'distance',
          size: 15,
        },
        this.apiKey,
      )
      docs.push(...data.documents)
    } else {
      // 카테고리 코드가 없는 항목은 키워드 검색을 합쳐서 근사한다
      const queries = KEYWORD_QUERIES[category] ?? []
      for (const q of queries) {
        try {
          const data = await kakaoFetch<{ documents: KakaoDoc[] }>(
            '/search/keyword.json',
            {
              query: q,
              x: at.lng,
              y: at.lat,
              radius: Math.min(20_000, radiusM),
              sort: 'distance',
              size: 15,
            },
            this.apiKey,
          )
          docs.push(...data.documents)
        } catch {
          // 개별 키워드 실패는 무시하고 나머지로 진행한다
        }
      }
    }

    const pattern = SCHOOL_PATTERN[category]
    const seen = new Set<string>()

    return docs
      .filter((d) => !pattern || pattern.test(d.category_name ?? ''))
      .map((d) => {
        const lat = Number(d.y)
        const lng = Number(d.x)
        return {
          name: d.place_name ?? '',
          lat,
          lng,
          distanceM: Math.round(haversineM(at, { lat, lng })),
          category: d.category_name ?? undefined,
        }
      })
      .filter((p) => {
        if (p.distanceM > radiusM) return false
        const key = `${p.name}:${p.lat.toFixed(5)}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => a.distanceM - b.distanceM)
  }
}
