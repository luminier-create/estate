/**
 * 지역 시장 지표 조회.
 *
 * 단지 점수와 **분리된** 화면이다. 여기 숫자는 지역 단위 시계열이라 개별 단지의
 * 적합도와 성격이 다르고, 아직 스코어링에 반영하지 않는다 — 눈으로 확인한 뒤
 * 반영 여부를 판단하기 위한 순서다.
 */
import { Badge, Card, Disclaimer, EmptyState } from '@/components/ui'
import { IndexChart } from '@/components/market/IndexChart'
import { MarketControls } from '@/components/market/MarketControls'
import { requireUserOrRedirect } from '@/lib/firebase/session'
import { cachedCall } from '@/lib/cache'
import { CACHE_POLICY, marketIndexKey } from '@/lib/cache-keys'
import { marketIndexProvider, providerStatus, rebKeyPresent } from '@/lib/providers'
import {
  MARKET_INDICATOR_LABEL,
  MARKET_INDICATOR_NOTE,
  type MarketIndicator,
} from '@/lib/providers/types'

const DEFAULT_MONTHS = 24
const ALLOWED_MONTHS = [12, 24, 36, 60]

/** YYYYMM → "2026년 1월" */
function formatPeriod(period: string): string {
  return `${period.slice(0, 4)}년 ${Number(period.slice(4, 6))}월`
}

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireUserOrRedirect()
  const sp = await searchParams
  const provider = marketIndexProvider()
  const regions = await provider.regions()

  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

  // 쿼리는 사용자가 손댈 수 있으므로 전부 알려진 값으로 되돌린다.
  // 모르는 값을 그대로 Provider 에 넘기면 결과가 비어 "고장난 화면"이 된다.
  const regionCode =
    regions.find((r) => r.code === one(sp.region))?.code ?? regions[0]?.code ?? ''
  const indicator: MarketIndicator =
    provider.supported.find((i) => i === one(sp.indicator)) ?? provider.supported[0]!
  const monthsRaw = Number(one(sp.months))
  const months = ALLOWED_MONTHS.includes(monthsRaw) ? monthsRaw : DEFAULT_MONTHS

  const series = regionCode
    ? await cachedCall(
        CACHE_POLICY.marketIndex,
        marketIndexKey(provider.name, indicator, regionCode, months),
        providerStatus.marketIndex === 'mock' ? null : 'reb',
        () => provider.series(indicator, regionCode, months),
      ).catch(() => null)
    : null

  const points = series?.points ?? []
  const latest = points.at(-1)
  const first = points[0]
  // 변동률은 그 자체가 이미 변화량이라 "기간 대비 변화"를 다시 계산하면 오해를 만든다
  const isRate = indicator === 'LAND_PRICE_CHANGE'
  const change =
    !isRate && latest && first && first.value !== 0
      ? ((latest.value - first.value) / Math.abs(first.value)) * 100
      : null

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold sm:text-2xl">지역 시장 지표</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          한국부동산원 통계. 단지 점수와는 별개로 지역 흐름만 봅니다.
        </p>
      </header>

      {providerStatus.marketIndex === 'mock' && (
        <Card>
          <p className="text-sm font-medium">
            {rebKeyPresent ? '실데이터 연동 준비 중' : '시드 데이터로 표시 중'}
          </p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {rebKeyPresent
              ? 'REB_API_KEY 는 설정되어 있으나 R-ONE 응답 형식을 아직 확인하지 못해 시드 데이터로 표시합니다. 아래 숫자는 실제 통계가 아닙니다.'
              : '.env.local 에 REB_API_KEY 를 넣으면 실제 통계로 전환됩니다. 아래 숫자는 실제 통계가 아닙니다.'}
          </p>
        </Card>
      )}

      <MarketControls
        regions={regions}
        indicators={provider.supported}
        regionCode={regionCode}
        indicator={indicator}
        months={months}
      />

      {!series || points.length === 0 ? (
        <EmptyState
          title="표시할 데이터가 없습니다"
          description="선택한 지역·지표 조합의 통계를 가져오지 못했습니다. 다른 조합을 선택해 보십시오."
        />
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="font-semibold">
                  {series.regionName} · {MARKET_INDICATOR_LABEL[indicator]}
                </h2>
                <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                  {first && latest
                    ? `${formatPeriod(first.period)} ~ ${formatPeriod(latest.period)}`
                    : ''}
                </p>
              </div>
              {latest && (
                <div className="text-right">
                  <span className="text-2xl font-bold tabular-nums">
                    {latest.value.toLocaleString('ko-KR')}
                  </span>
                  <span className="ml-1 text-sm text-[var(--color-muted)]">
                    {series.unit}
                  </span>
                  {change !== null && (
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                      기간 내{' '}
                      {/* 색만으로 방향을 나타내지 않는다 — 색각 이상과
                          스크린리더 양쪽에서 읽히지 않는다.
                          (상승 빨강/하락 파랑은 국내 관행을 따른다) */}
                      <span
                        className={
                          change >= 0
                            ? 'font-semibold text-[var(--color-negative)]'
                            : 'font-semibold text-[var(--color-positive)]'
                        }
                      >
                        {change >= 0 ? '+' : ''}
                        {change.toFixed(1)}% {change >= 0 ? '상승' : '하락'}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4">
              <IndexChart series={series} />
            </div>

            <p className="mt-3 text-xs text-[var(--color-muted)]">
              {MARKET_INDICATOR_NOTE[indicator]}
            </p>
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">월별 값</h2>
              <Badge tone="neutral">{points.length}개월</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[20rem] text-sm">
                <caption className="sr-only">
                  {series.regionName} {MARKET_INDICATOR_LABEL[indicator]} 월별 값
                </caption>
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]">
                    <th scope="col" className="py-2 font-medium">
                      기준월
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      값 ({series.unit})
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      전월 대비
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...points].reverse().map((p, i, arr) => {
                    const prev = arr[i + 1]
                    const diff = prev ? p.value - prev.value : null
                    return (
                      <tr
                        key={p.period}
                        className="border-b border-[var(--color-border)] last:border-0"
                      >
                        <th scope="row" className="py-2 text-left font-normal">
                          {formatPeriod(p.period)}
                        </th>
                        <td className="py-2 text-right tabular-nums">
                          {p.value.toLocaleString('ko-KR')}
                        </td>
                        <td className="py-2 text-right tabular-nums text-[var(--color-muted)]">
                          {diff === null
                            ? '—'
                            : `${diff >= 0 ? '+' : ''}${diff.toLocaleString('ko-KR', {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 2,
                              })}`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {series.source.label && (
              <p className="mt-3 text-xs text-[var(--color-muted)]">
                출처: {series.source.label}
                {series.source.asOf ? ` · 기준 ${series.source.asOf}` : ''}
              </p>
            )}
          </Card>
        </>
      )}

      <Disclaimer />
    </div>
  )
}
