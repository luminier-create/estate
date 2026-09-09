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
import { metersForWalkMinutes } from '@/lib/scoring/normalize'

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
    Marker: new (options: { position: KakaoLatLng; map?: KakaoMapInstance }) => {
      setMap(map: KakaoMapInstance | null): void
    }
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
}: {
  name: string
  address: string
  lat: number
  lng: number
}) {
  const appKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

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
          new kakao.maps.Marker({ position: center, map })

          for (const minutes of RADIUS_MINUTES) {
            const circle = new kakao.maps.Circle({
              center,
              radius: metersForWalkMinutes(minutes),
              strokeWeight: 1,
              strokeColor: '#1f6feb',
              strokeOpacity: 0.6,
              strokeStyle: 'shortdash',
              fillColor: '#1f6feb',
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
  }, [appKey, lat, lng])

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
          className="mt-2 inline-block text-xs text-[var(--color-brand)] underline"
        >
          카카오맵에서 위치 보기
        </a>
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
