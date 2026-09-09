import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button, Card, Disclaimer, EmptyState } from '@/components/ui'
import { PropertyRankCard } from '@/components/property/PropertyRankCard'
import { ReanalyzeAllButton } from '@/components/property/ReanalyzeAllButton'
import { requireUserOrRedirect } from '@/lib/firebase/session'
import {
  analysisId,
  getAnalysis,
  getProfile,
  listArchivedProperties,
  listProperties,
  profileHash,
} from '@/lib/repo'
import { getPreset } from '@/lib/scoring/presets'
import { formatManwon } from '@/lib/scoring/normalize'

export default async function DashboardPage() {
  const user = await requireUserOrRedirect()
  const profile = await getProfile(user.uid)
  if (!profile) redirect('/')
  if (!profile.onboardingCompleted) redirect('/onboarding')

  const [properties, archived] = await Promise.all([
    listProperties(user.uid),
    listArchivedProperties(user.uid),
  ])
  const hash = profileHash(profile)
  const presetId = profile.weights.presetId

  const rows = await Promise.all(
    properties.map(async (property) => ({
      property,
      analysis: await getAnalysis(
        user.uid,
        analysisId(property.id, hash, presetId),
      ),
    })),
  )

  const ranked = [...rows].sort((a, b) => {
    const sa = a.analysis?.totalScore ?? -1
    const sb = b.analysis?.totalScore ?? -1
    return sb - sa
  })

  const unanalyzed = ranked.filter((r) => r.analysis === null).length

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">내 후보 단지</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            적용 기준 <span className="font-medium">{getPreset(presetId).label}</span>
            {properties.length > 0 && ` · ${properties.length}개 단지`}
          </p>
        </div>
        <div className="flex gap-2">
          {properties.length >= 2 && (
            <Link href="/compare">
              <Button variant="secondary">비교하기</Button>
            </Link>
          )}
          <Link href="/properties/new">
            <Button>단지 등록</Button>
          </Link>
        </div>
      </header>

      {unanalyzed > 0 && properties.length > 0 && (
        <Card className="space-y-2">
          <p className="text-sm">
            아직 분석 결과가 없는 단지가 있습니다. 조건을 바꿨거나 분석 기준이
            갱신된 경우입니다.
          </p>
          <ReanalyzeAllButton count={unanalyzed} />
        </Card>
      )}

      {properties.length === 0 ? (
        <EmptyState
          title="등록된 단지가 없습니다"
          description="부동산 앱에서 찾은 아파트의 단지명·면적·금액만 입력하면 11개 축으로 적합도를 분석합니다. 3개 이상 등록하면 비교가 유용해집니다."
          action={
            <Link href="/properties/new">
              <Button>첫 단지 등록하기</Button>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {ranked.map((row, i) => (
            <li key={row.property.id}>
              <PropertyRankCard
                rank={i + 1}
                property={row.property}
                analysis={row.analysis}
                areaUnit={profile.areaUnit}
              />
            </li>
          ))}
        </ul>
      )}

      {properties.length === 1 && (
        <Card className="text-sm text-[var(--color-muted)]">
          단지가 하나뿐이면 점수의 절대값보다 축별 강약점을 보는 편이 유용합니다.
          비교 대상을 2개 이상 등록하면 순위와 상대 평가가 의미를 갖습니다.
        </Card>
      )}

      {archived.length > 0 && (
        <details className="rounded-[--radius-card] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 sm:px-5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-medium">
            보류함
            <span className="text-xs text-[var(--color-muted)]">
              {archived.length}개
            </span>
          </summary>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            순위 계산과 비교에서 제외된 단지입니다. 상세 화면에서 되돌릴 수 있습니다.
          </p>
          <ul className="mt-3 space-y-2">
            {archived.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/properties/${p.id}`}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-sm transition-colors hover:border-[var(--color-brand)]"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-[var(--color-muted)]">
                    {formatManwon(p.priceManwon)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Disclaimer />
    </div>
  )
}
