/**
 * 관측 데이터에서 지도 표시용 주변 시설을 추린다.
 * 외부 의존이 없는 순수 함수이므로 단위 테스트 대상이다.
 */
import type { Landmark, LandmarkKind, Observations, PlaceHit } from './types'

/** 종류별 상위 N개만 남긴다. 지도가 마커로 뒤덮이지 않게 하기 위함이다. */
export const LANDMARKS_PER_KIND = 3

const GROUP_ORDER: LandmarkKind[] = [
  'SUBWAY',
  'BUS',
  'ELEMENTARY',
  'MIDDLE',
  'HIGH',
  'MART',
]

function pick(obs: Observations, kind: LandmarkKind): PlaceHit[] | null {
  switch (kind) {
    case 'SUBWAY':
      return obs.subwayStations
    case 'BUS':
      return obs.busStops
    case 'ELEMENTARY':
      return obs.elementarySchools
    case 'MIDDLE':
      return obs.middleSchools
    case 'HIGH':
      return obs.highSchools
    case 'MART':
      return obs.marts
  }
}

export function collectLandmarks(obs: Observations): Landmark[] {
  return GROUP_ORDER.flatMap((kind) =>
    (pick(obs, kind) ?? [])
      // 좌표가 없는 항목은 지도에 찍을 수 없다
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .slice()
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, LANDMARKS_PER_KIND)
      .map((p) => ({
        kind,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        distanceM: Math.round(p.distanceM),
      })),
  )
}
