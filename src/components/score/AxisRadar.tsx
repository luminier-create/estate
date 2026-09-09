'use client'
/**
 * 레이더 차트 지연 로더.
 *
 * recharts 는 상세 페이지 초기 번들의 대부분(약 100KB)을 차지하는데, 차트는
 * 스크롤해야 보이므로 첫 페인트에 필요하지 않다. 분리해서 나중에 받아온다.
 */
import dynamic from 'next/dynamic'
import type { AxisResult } from '@/lib/scoring/types'

const Chart = dynamic(() => import('./AxisRadarChart'), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-64 w-full items-center justify-center rounded-xl bg-[var(--color-bg)] text-xs text-[var(--color-muted)] sm:h-80"
      role="status"
    >
      차트를 불러오는 중…
    </div>
  ),
})

export function AxisRadar({ axes }: { axes: AxisResult[] }) {
  return <Chart axes={axes} />
}
