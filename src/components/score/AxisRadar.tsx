'use client'
/** 축별 점수 레이더 차트. 모바일에서는 축약 라벨을 쓴다. */
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'
import { AXIS_LABEL_SHORT, type AxisResult } from '@/lib/scoring/types'

export function AxisRadar({ axes }: { axes: AxisResult[] }) {
  const data = axes.map((a) => ({
    axis: AXIS_LABEL_SHORT[a.axis],
    // 결측 축은 0 으로 그리되 라벨에 표시해 오해를 막는다
    score: a.score ?? 0,
    missing: a.score === null,
  }))

  return (
    <div className="mx-auto h-64 w-full max-w-sm sm:h-80 sm:max-w-md">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--color-border)" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            dataKey="score"
            stroke="var(--color-brand)"
            fill="var(--color-brand)"
            fillOpacity={0.28}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
