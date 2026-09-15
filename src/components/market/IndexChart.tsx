'use client'
/**
 * 지표 시계열 차트 지연 로더.
 *
 * recharts 는 무겁고 이 화면에서도 첫 화면에 꼭 필요한 요소가 아니다 —
 * 표가 먼저 읽히고 차트는 보조다. 상세 화면과 같은 방식으로 분리한다.
 */
import dynamic from 'next/dynamic'
import type { MarketIndexSeries } from '@/lib/providers/types'

const Chart = dynamic(() => import('./IndexChartInner'), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-64 w-full items-center justify-center rounded-xl bg-[var(--color-bg)] text-xs text-[var(--color-muted)]"
      role="status"
    >
      차트를 불러오는 중…
    </div>
  ),
})

export function IndexChart({ series }: { series: MarketIndexSeries }) {
  return <Chart series={series} />
}
