'use client'
/**
 * 단지 위치 지도.
 *
 * 도보 5·10·15분 반경을 원으로 그려 입지 감각을 준다. 반경은 스코어링에서 쓰는
 * 보행속도·우회계수와 동일한 상수로 역산하므로 점수와 화면이 어긋나지 않는다.
 *
 * NEXT_PUBLIC_KAKAO_JS_KEY 가 없으면 지도를 띄우지 않고 외부 링크로 폴백한다.
 */
import { useEffect, useRef, useState } from 'react'
import {
  formatDistance,
  metersForWalkMinutes,
  walkMinutes,
} from '@/lib/scoring/normalize'
import { LANDMARK_LABEL, type Landmark, type LandmarkKind } from '@/lib/scoring/types'

interface KakaoLatLng {
  getLat(): number
  getLng(): number
}
interface KakaoMapInstance {
  setCenter(latlng: KakaoLatLng): void
  relayout(): void
}
interface KakaoNamespace {
  maps: {
    load(cb: () => void): void
    LatLng: new (lat: number, lng: number) => KakaoLatLng
    Map: new (
      container: HTMLElement,
      options: { center: KakaoLatLng; level: number },
    ) => KakaoMapInstance
    Marker: new (options: {
      position: KakaoLatLng
      map?: KakaoMapInstance
      title?: string
      image?: object
    }) => {
      setMap(map: KakaoMapInstance | null): void
    }
    CustomOverlay: new (options: {
      position: KakaoLatLng
      content: string | HTMLElement
      yAnchor?: number
      map?: KakaoMapInstance
    }) => { setMap(map: KakaoMapInstance | null): void }
    Circle: new (options: {
      center: KakaoLatLng
      radius: number
      strokeWeight: number
      strokeColor: string
      strokeOpacity: number
      strokeStyle: string
      fillColor: string
      fillOpacity: number
    }) => { setMap(map: KakaoMapInstance | null): void }
  }
}

declare global {
  interface Window {
    kakao?: KakaoNamespace
  }
}

const SDK_ID = 'kakao-maps-sdk'
const RADIUS_MINUTES = [5, 10, 15] as const

/** 종류별 마커 색. 색만으로 구분되지 않도록 라벨 텍스트를 함께 그린다. */
const LANDMARK_COLOR: Record<LandmarkKind, string> = {
  SUBWAY: '#0d9488',
  BUS: '#7c3aed',
  ELEMENTARY: '#d97706',
  MIDDLE: '#c2410c',
  HIGH: '#9a3412',
  MART: '#2563eb',
}

function escapeHtml(v: string): string {
  return v.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  )
}

function loadSdk(appKey: string): Promise<KakaoNamespace> {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps) return resolve(window.kakao)

    const existing = document.getElementById(SDK_ID)
    if (existing) {
      existing.addEventListener('load', () => resolve(window.kakao!), { once: true })
      existing.addEventListener('error', () => reject(new Error('SDK 로드 실패')), {
        once: true,
      })
      return
    }

    const script = document.createElement('script')
    script.id = SDK_ID
    script.async = true
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`
    script.onload = () => {
      if (!window.kakao) return reject(new Error('SDK 초기화 실패'))
      resolve(window.kakao)
    }
    script.onerror = () => reject(new Error('SDK 로드 실패'))
    document.head.appendChild(script)
  })
}

export function PropertyMap({
  name,
  address,
  lat,
  lng,
  landmarks = [],
}: {
  name: string
  address: string
  lat: number
  lng: number
  landmarks?: Landmark[]
}) {
  const appKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const grouped = groupByKind(landmarks)

  useEffect(() => {
    if (!appKey || !containerRef.current) return
    let cancelled = false

    loadSdk(appKey)
      .then((kakao) => {
        if (cancelled || !containerRef.current) return
        kakao.maps.load(() => {
          if (cancelled || !containerRef.current) return
          const center = new kakao.maps.LatLng(lat, lng)
          const map = new kakao.maps.Map(containerRef.current, {
            center,
            level: 5,
          })
          new kakao.maps.Marker({ position: center, map, title: name })
          new kakao.maps.CustomOverlay({
            position: center,
            yAnchor: 2.2,
            map,
            content: `<div style="background:#111827;color:#fff;padding:3px 8px;border-radius:9999px;font-size:11px;font-weight:600;white-space:nowrap">${escapeHtml(name)}</div>`,
          })

          for (const item of landmarks) {
            const pos = new kakao.maps.LatLng(item.lat, item.lng)
            new kakao.maps.CustomOverlay({
              position: pos,
              map,
              content:
                `<div style="display:flex;align-items:center;gap:4px;transform:translateY(-50%)">` +
                `<span style="width:9px;height:9px;border-radius:9999px;background:${LANDMARK_COLOR[item.kind]};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.2)"></span>` +
                `<span style="background:rgba(255,255,255,.92);color:#111827;padding:1px 5px;border-radius:4px;font-size:10px;white-space:nowrap">${escapeHtml(item.name)}</span>` +
                `</div>`,
            })
          }

          for (const minutes of RADIUS_MINUTES) {
            const circle = new kakao.maps.Circle({
              center,
              radius: metersForWalkMinutes(minutes),
              strokeWeight: 1,
              strokeColor: '#1a5fd0',
              strokeOpacity: 0.6,
              strokeStyle: 'shortdash',
              fillColor: '#1a5fd0',
              fillOpacity: 0.06,
            })
            circle.setMap(map)
          }
          setReady(true)
        })
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '지도를 불러오지 못했습니다.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [appKey, lat, lng, name, landmarks])

  const externalUrl = `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`

  if (!appKey) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-sm">
        <p className="font-medium">{address}</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          지도를 표시하려면 <code>NEXT_PUBLIC_KAKAO_JS_KEY</code> 가 필요합니다.
          발급 절차는 docs/03-DATA-SOURCES.md §8 을 참고하십시오.
        </p>
        <a
          href={externalUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-block text-xs text-[var(--color-brand-text)] underline"
        >
          카카오맵에서 위치 보기
        </a>
        <LandmarkList grouped={grouped} />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        role="img"
        aria-label={`${name} 위치 지도. 도보 5·10·15분 반경 표시.`}
        className="h-64 w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] sm:h-80"
      />
      <LandmarkList grouped={grouped} withColor />
      {error ? (
        <p className="text-xs text-[var(--color-negative)]">
          {error} —{' '}
          <a href={externalUrl} target="_blank" rel="noreferrer noopener" className="underline">
            카카오맵에서 보기
          </a>
        </p>
      ) : (
        <p className="text-xs text-[var(--color-muted)]">
          {ready ? '점선 원은 안쪽부터 도보 5분·10분·15분 반경입니다.' : '지도를 불러오는 중…'}
        </p>
      )}
    </div>
  )
}

type Grouped = { kind: LandmarkKind; items: Landmark[] }[]

function groupByKind(landmarks: Landmark[]): Grouped {
  const order: LandmarkKind[] = ['SUBWAY', 'BUS', 'ELEMENTARY', 'MIDDLE', 'HIGH', 'MART']
  return order
    .map((kind) => ({
      kind,
      items: landmarks
        .filter((l) => l.kind === kind)
        .sort((a, b) => a.distanceM - b.distanceM),
    }))
    .filter((g) => g.items.length > 0)
}

/** 지도를 못 쓰는 환경에서도 주변 시설을 확인할 수 있도록 텍스트로 병기한다. */
function LandmarkList({ grouped, withColor }: { grouped: Grouped; withColor?: boolean }) {
  if (grouped.length === 0) return null

  return (
    <ul className="mt-3 space-y-1.5 border-t border-[var(--color-border)] pt-3">
      {grouped.map((g) => (
        <li key={g.kind} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5 font-medium text-[var(--color-fg)]">
            {withColor && (
              <span
                aria-hidden
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ background: LANDMARK_COLOR[g.kind] }}
              />
            )}
            {LANDMARK_LABEL[g.kind]}
          </span>
          <span className="text-[var(--color-muted)]">
            {g.items
              .map(
                (i) =>
                  `${i.name} ${formatDistance(i.distanceM)}·도보 ${Math.round(walkMinutes(i.distanceM))}분`,
              )
              .join(' / ')}
          </span>
        </li>
      ))}
    </ul>
  )
}
