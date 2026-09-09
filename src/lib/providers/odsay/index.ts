import 'server-only'
/**
 * ODsay 대중교통 Provider
 * 스펙: docs/03-DATA-SOURCES.md §4
 *
 * 무료 티어 호출 수가 제한적이므로 단지당 1회 호출 + 30일 캐시를 전제로 한다.
 */
import { haversineM } from '../../scoring/normalize'
import type { GeoPoint, PlaceHit, TransitRoute } from '../../scoring/types'
import type { TransitMode, TransitProvider } from '../types'

const ROUTE_ENDPOINT = 'https://api.odsay.com/v1/api/searchPubTransPathT'
const POINT_ENDPOINT = 'https://api.odsay.com/v1/api/pointSearch'
const TIMEOUT_MS = 6000

/** SearchPathType: 0=전체 1=지하철 2=버스 */
const PATH_TYPE: Record<TransitMode, number> = { ALL: 0, SUBWAY: 1, BUS: 2 }

interface OdsayPathInfo {
  totalTime?: number
  busTransitCount?: number
  subwayTransitCount?: number
  totalWalk?: number
  firstStartStation?: string
  lastEndStation?: string
  totalDistance?: number
}

interface OdsaySubPath {
  trafficType?: number
  lane?: { name?: string; busNo?: string }[]
  startName?: string
  endName?: string
}

interface OdsayResponse {
  result?: {
    path?: { pathType?: number; info?: OdsayPathInfo; subPath?: OdsaySubPath[] }[]
    station?: { stationName?: string; x?: string; y?: string; stationClass?: number }[]
  }
  error?: { code?: string; message?: string }
}

function summarize(
  subPaths: OdsaySubPath[],
  info: OdsayPathInfo,
  transfers: number,
): string {
  const lanes = subPaths
    .flatMap((s) => s.lane ?? [])
    .map((l) => l.busNo ?? l.name)
    .filter((v): v is string => Boolean(v))
    .slice(0, 3)

  const laneText = lanes.length > 0 ? lanes.join(' → ') : ''
  const transferText = transfers === 0 ? '환승 없음' : `환승 ${transfers}회`
  const start = info.firstStartStation ? `${info.firstStartStation} 승차` : ''
  return [laneText, transferText, start].filter(Boolean).join(' · ')
}

export class OdsayTransitProvider implements TransitProvider {
  readonly name = 'odsay'

  constructor(private readonly apiKey: string) {}

  async route(
    from: GeoPoint,
    to: GeoPoint,
    mode: TransitMode,
  ): Promise<TransitRoute | null> {
    const url = new URL(ROUTE_ENDPOINT)
    url.searchParams.set('SX', String(from.lng))
    url.searchParams.set('SY', String(from.lat))
    url.searchParams.set('EX', String(to.lng))
    url.searchParams.set('EY', String(to.lat))
    url.searchParams.set('SearchPathType', String(PATH_TYPE[mode]))
    url.searchParams.set('apiKey', this.apiKey)

    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: 2_592_000 },
    })
    if (!res.ok) throw new Error(`ODsay API 오류 ${res.status}`)

    const data = (await res.json()) as OdsayResponse
    if (data.error) {
      // 경로 없음은 오류가 아니라 "해당 수단으로 갈 수 없음"이다
      return null
    }

    const path = data.result?.path?.[0]
    const info = path?.info
    if (!info?.totalTime) return null

    const transfers = Math.max(
      0,
      (info.busTransitCount ?? 0) + (info.subwayTransitCount ?? 0) - 1,
    )

    return {
      totalMinutes: info.totalTime,
      transferCount: transfers,
      walkMeters: info.totalWalk ?? 0,
      pathType: (path?.pathType ?? 3) as 1 | 2 | 3,
      summary: summarize(path?.subPath ?? [], info, transfers),
    }
  }

  /** 반경 내 정류장·역 조회. 카카오에는 버스정류장 카테고리가 없어 이쪽을 쓴다. */
  async nearbyStops(at: GeoPoint, radiusM: number): Promise<PlaceHit[]> {
    const url = new URL(POINT_ENDPOINT)
    url.searchParams.set('x', String(at.lng))
    url.searchParams.set('y', String(at.lat))
    url.searchParams.set('radius', String(Math.min(1000, radiusM)))
    // stationClass 1=지하철 2=버스
    url.searchParams.set('stationClass', '2')
    url.searchParams.set('apiKey', this.apiKey)

    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: 7_776_000 },
    })
    if (!res.ok) throw new Error(`ODsay 정류장 조회 오류 ${res.status}`)

    const data = (await res.json()) as OdsayResponse
    return (data.result?.station ?? [])
      .map((s) => {
        const lat = Number(s.y)
        const lng = Number(s.x)
        return {
          name: s.stationName ?? '',
          lat,
          lng,
          distanceM: Math.round(haversineM(at, { lat, lng })),
        }
      })
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
      .sort((a, b) => a.distanceM - b.distanceM)
  }
}
