import { describe, expect, it } from 'vitest'
import { collectLandmarks, LANDMARKS_PER_KIND } from '@/lib/scoring/landmarks'
import type { PlaceHit } from '@/lib/scoring/types'
import { makeObservations } from '../../fixtures/builders'

const place = (name: string, distanceM: number, lat = 37.5, lng = 127): PlaceHit => ({
  name,
  lat,
  lng,
  distanceM,
})

describe('collectLandmarks', () => {
  it('종류별로 최대 3개까지만 남긴다', () => {
    const many = Array.from({ length: 8 }, (_, i) => place(`역${i}`, 100 + i * 50))
    const result = collectLandmarks(makeObservations({ subwayStations: many }))
    expect(result.filter((l) => l.kind === 'SUBWAY')).toHaveLength(LANDMARKS_PER_KIND)
  })

  it('가까운 순으로 남긴다', () => {
    const result = collectLandmarks(
      makeObservations({
        subwayStations: [place('먼역', 900), place('가까운역', 100), place('중간역', 400)],
      }),
    )
    expect(result.filter((l) => l.kind === 'SUBWAY').map((l) => l.name)).toEqual([
      '가까운역',
      '중간역',
      '먼역',
    ])
  })

  it('좌표가 없는 항목은 제외한다 — 지도에 찍을 수 없다', () => {
    const result = collectLandmarks(
      makeObservations({
        marts: [
          { name: '좌표없음', lat: Number.NaN, lng: Number.NaN, distanceM: 100 },
          place('정상마트', 500),
        ],
      }),
    )
    expect(result.filter((l) => l.kind === 'MART').map((l) => l.name)).toEqual(['정상마트'])
  })

  it('결측 관측은 건너뛰고 나머지만 모은다', () => {
    const result = collectLandmarks(
      makeObservations({
        subwayStations: null,
        busStops: null,
        elementarySchools: [place('초등학교', 300)],
        middleSchools: null,
        highSchools: null,
        marts: null,
      }),
    )
    expect(result).toHaveLength(1)
    expect(result[0]!.kind).toBe('ELEMENTARY')
  })

  it('거리는 정수로 반올림한다', () => {
    const result = collectLandmarks(
      makeObservations({ marts: [place('마트', 123.7)] }),
    )
    expect(result.find((l) => l.kind === 'MART')?.distanceM).toBe(124)
  })

  it('관측이 전부 없으면 빈 배열', () => {
    const result = collectLandmarks(
      makeObservations({
        subwayStations: null, busStops: null, elementarySchools: null,
        middleSchools: null, highSchools: null, marts: null,
      }),
    )
    expect(result).toEqual([])
  })
})
