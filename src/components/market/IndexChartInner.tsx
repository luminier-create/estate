'use client'
/** 지역 시장 지표 시계열. 단위가 지표마다 달라 Y축 범위를 값에서 유도한다. */
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  MARKET_INDICATOR_LABEL,
  type MarketIndexSeries,
} from '@/lib/providers/types'

/** YYYYMM → "25.06". 축 라벨이 겹치지 않게 짧게 쓴다. */
function shortPeriod(period: string): string {
  return `${period.slice(2, 4)}.${period.slice(4, 6)}`
}

export default function IndexChartInner({ series }: { series: MarketIndexSeries }) {
  const data = series.points.map((p) => ({
    period: shortPeriod(p.period),
    value: p.value,
  }))

  // 지수(100 근처)와 변동률(0 근처)이 섞이므로 0 고정 축을 쓰면 변화가 안 보인다.
  const values = data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max((max - min) * 0.15, Math.abs(max) * 0.01, 0.01)

  // 지수(100대)와 변동률(0 근처)은 필요한 자릿수가 다르다
  const decimals = max < 10 ? 2 : 1
  const axisWidth = Math.max(44, (max.toFixed(decimals).length + 1) * 8)

  // 라벨이 빽빽해지지 않도록 눈금을 솎는다
  const interval = Math.max(0, Math.ceil(data.length / 8) - 1)

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 22, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="period"
            interval={interval}
            tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
            tickLine={false}
          />
          <YAxis
            domain={[min - pad, max + pad]}
            // 자동 눈금은 소수점 셋째 자리까지 찍혀 라벨이 잘린다.
            // 값의 크기에 맞춰 자릿수를 정하고 폭도 거기에 맞춘다.
            tickFormatter={(v: number) => v.toFixed(decimals)}
            tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
            tickLine={false}
            axisLine={false}
            width={axisWidth}
          />
          <Tooltip
            formatter={(v: number) => [
              `${v.toLocaleString('ko-KR')} ${series.unit}`,
              MARKET_INDICATOR_LABEL[series.indicator],
            ]}
            labelFormatter={(l: string) => `20${l}`}
            contentStyle={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 10,
              fontSize: 12,
              color: 'var(--color-fg)',
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-brand)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
