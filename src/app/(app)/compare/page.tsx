import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button, Disclaimer, EmptyState } from '@/components/ui'
import { CompareTable } from '@/components/score/CompareTable'
import { requireUserOrRedirect } from '@/lib/firebase/session'
import {
  analysisId,
  getAnalysis,
  getProfile,
  listProperties,
  profileHash,
} from '@/lib/repo'
import { getPreset, normalizeWeights } from '@/lib/scoring/presets'

export default async function ComparePage() {
  const user = await requireUserOrRedirect()
  const profile = await getProfile(user.uid)
  if (!profile) redirect('/')

  const properties = await listProperties(user.uid)
  const hash = profileHash(profile)
  const presetId = profile.weights.presetId

  const rows = (
    await Promise.all(
      properties.map(async (property) => {
        const analysis = await getAnalysis(
          user.uid,
          analysisId(property.id, hash, presetId),
        )
        return analysis
          ? {
              id: property.id,
              name: property.name,
              priceManwon: property.priceManwon,
              exclusiveM2: property.exclusiveM2,
              axes: analysis.axes,
              riskPenalty: analysis.riskPenalty,
            }
          : null
      }),
    )
  ).filter((r): r is NonNullable<typeof r> => r !== null)

  const initialWeights =
    presetId === 'custom' && profile.weights.custom
      ? normalizeWeights(profile.weights.custom)
      : getPreset(presetId).weights

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold sm:text-2xl">단지 비교</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          가중치를 조절하면 순위가 즉시 다시 계산됩니다. 외부 데이터를 다시 조회하지
          않으므로 여러 기준을 빠르게 시험해 볼 수 있습니다.
        </p>
      </header>

      {rows.length < 2 ? (
        <EmptyState
          title="비교하려면 분석된 단지가 2개 이상 필요합니다"
          description={`현재 분석 완료된 단지는 ${rows.length}개입니다. 단지를 추가로 등록하십시오.`}
          action={
            <Link href="/properties/new">
              <Button>단지 등록</Button>
            </Link>
          }
        />
      ) : (
        <CompareTable
          rows={rows}
          initialWeights={initialWeights}
          initialPresetId={presetId}
          areaUnit={profile.areaUnit}
        />
      )}

      <Disclaimer />
    </div>
  )
}
