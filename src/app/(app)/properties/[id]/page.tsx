import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Badge, Button, Card, Disclaimer } from '@/components/ui'
import { AxisList } from '@/components/score/AxisList'
import { AxisRadar } from '@/components/score/AxisRadar'
import { ScoreBadge } from '@/components/score/ScoreBadge'
import { AnalyzeButton } from '@/components/property/AnalyzeButton'
import { DeletePropertyButton } from '@/components/property/DeletePropertyButton'
import { ArchiveButton } from '@/components/property/ArchiveButton'
import { DevelopmentForm } from '@/components/property/DevelopmentForm'
import { PropertyMap } from '@/components/map/PropertyMap'
import { requireUserOrRedirect } from '@/lib/firebase/session'
import {
  analysisId,
  getAnalysis,
  getProfile,
  getProperty,
  profileHash,
} from '@/lib/repo'
import {
  CONFIDENCE_TEXT,
  gradeLabel,
  weakestAxes,
} from '@/lib/scoring/aggregate'
import { formatManwon, m2ToPyeong } from '@/lib/scoring/normalize'
import { getPreset } from '@/lib/scoring/presets'
import { AXIS_LABEL } from '@/lib/scoring/types'
import { STAGE_LABEL, DEVELOPMENT_POINTS } from '@/lib/scoring/axes/development'

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUserOrRedirect()
  const profile = await getProfile(user.uid)
  if (!profile) redirect('/')

  const property = await getProperty(user.uid, id)
  if (!property) notFound()

  const presetId = profile.weights.presetId
  const analysis = await getAnalysis(
    user.uid,
    analysisId(id, profileHash(profile), presetId),
  )

  const areaText =
    profile.areaUnit === 'PYEONG'
      ? `${m2ToPyeong(property.exclusiveM2).toFixed(1)}평 (전용 ${property.exclusiveM2}㎡)`
      : `전용 ${property.exclusiveM2}㎡ (${m2ToPyeong(property.exclusiveM2).toFixed(1)}평)`
  const perPyeong = property.priceManwon / m2ToPyeong(property.exclusiveM2)

  const weak = analysis ? weakestAxes(analysis, 3) : []

  return (
    <div className="space-y-5">
      <header>
        <Link href="/dashboard" className="text-sm text-[var(--color-muted)]">
          ← 내 후보
        </Link>
        <h1 className="mt-2 flex flex-wrap items-center gap-2 text-xl font-bold sm:text-2xl">
          {property.name}
          {property.status === 'ARCHIVED' && <Badge tone="warn">보류함</Badge>}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{property.address}</p>
      </header>

      <Card>
        {analysis ? (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <ScoreBadge
              score={analysis.totalScore}
              grade={analysis.grade}
              size="lg"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-lg font-semibold">
                {gradeLabel(analysis.grade)} · {analysis.totalScore}점
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="brand">기준 {getPreset(analysis.presetId).label}</Badge>
                <Badge tone={analysis.confidence >= 0.9 ? 'positive' : 'warn'}>
                  신뢰도 {CONFIDENCE_TEXT[analysis.confidenceLabel]} (
                  {Math.round(analysis.confidence * 100)}%)
                </Badge>
                {analysis.riskPenalty > 0 && (
                  <Badge tone="negative">리스크 −{analysis.riskPenalty}점</Badge>
                )}
              </div>
              <p className="text-xs text-[var(--color-muted)]">
                기본 점수 {analysis.baseScore}점에서 리스크 {analysis.riskPenalty}점을
                차감했습니다. 분석 시각{' '}
                {new Date(analysis.computedAt).toLocaleString('ko-KR')}
              </p>
            </div>
            <AnalyzeButton propertyId={property.id} label="다시 분석" />
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-[var(--color-muted)]">
              아직 분석 결과가 없습니다. 분석을 실행하십시오.
            </p>
            <AnalyzeButton propertyId={property.id} label="분석 실행" />
          </div>
        )}
      </Card>

      <Card className="grid gap-3 text-sm sm:grid-cols-2">
        <Row label="금액" value={`${formatManwon(property.priceManwon)} (${property.priceType === 'ASKING' ? '호가' : '목표가'})`} />
        <Row label="면적" value={areaText} />
        <Row label="평단가" value={`${Math.round(perPyeong).toLocaleString('ko-KR')}만원/평`} />
        <Row label="건축년도" value={property.buildYear ? `${property.buildYear}년` : '미상'} />
        <Row label="세대수" value={property.totalHouseholds ? `${property.totalHouseholds.toLocaleString('ko-KR')}세대` : '미상'} />
        <Row label="세대당 주차" value={property.parkingPerHousehold ? `${property.parkingPerHousehold}대` : '미상'} />
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold">위치</h2>
        <PropertyMap
          name={property.name}
          address={property.address}
          lat={property.lat}
          lng={property.lng}
          landmarks={analysis?.landmarks ?? []}
        />
      </Card>

      {analysis && (
        <>
          <Card>
            <h2 className="mb-2 text-sm font-semibold">축별 점수</h2>
            <AxisRadar axes={analysis.axes} />
          </Card>

          {weak.length > 0 && (
            <Card>
              <h2 className="text-sm font-semibold">이 단지의 약점</h2>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                가중치 대비 실점이 큰 순서입니다.
              </p>
              <ul className="mt-3 space-y-2">
                {weak.map((a) => (
                  <li key={a.axis} className="text-sm">
                    <span className="font-medium">{AXIS_LABEL[a.axis]}</span>
                    <span className="ml-2 text-xs text-[var(--color-muted)]">
                      {a.score !== null ? `${a.score}점` : '데이터 없음'} · {a.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <h2 className="mb-1 text-sm font-semibold">평가 근거</h2>
            <p className="mb-2 text-xs text-[var(--color-muted)]">
              각 항목을 눌러 상세 산출 근거와 출처를 확인하십시오.
            </p>
            <AxisList axes={analysis.axes} />
          </Card>

          {analysis.risks.length > 0 && (
            <Card>
              <h2 className="text-sm font-semibold">확인된 리스크</h2>
              <ul className="mt-3 space-y-2">
                {analysis.risks.map((r) => (
                  <li key={r.code} className="flex items-start gap-2 text-sm">
                    <Badge tone="negative">−{r.penalty}</Badge>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{r.label}</span>
                      <span className="ml-2 text-xs text-[var(--color-muted)]">
                        [{r.origin === 'auto' ? '자동판정' : '사용자확인'}] {r.reason}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-[var(--color-muted)]">
                감점 총합은 15점을 초과하지 않습니다. 실제 차감 {analysis.riskPenalty}점.
              </p>
            </Card>
          )}
        </>
      )}

      <Card>
        <h2 className="text-sm font-semibold">호재·악재</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          해당 필지 기준으로 확인한 개발 정보를 등록하십시오. 확실성 단계에 따라 점수
          반영 비율이 달라집니다.
        </p>
        {property.developments.length > 0 && (
          <ul className="mt-3 space-y-2">
            {property.developments.map((d, i) => (
              <li
                key={`${d.title}-${i}`}
                className="rounded-xl border border-[var(--color-border)] p-3 text-sm"
              >
                <p className="font-medium">{d.title}</p>
                <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                  {DEVELOPMENT_POINTS[d.type].label} · {STAGE_LABEL[d.stage]}
                  {d.distanceM != null && ` · ${Math.round(d.distanceM)}m`}
                </p>
                {d.sourceUrl ? (
                  <a
                    href={d.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-1 inline-block text-xs text-[var(--color-brand-text)] underline"
                  >
                    출처 확인
                  </a>
                ) : (
                  <span className="mt-1 inline-block text-xs text-amber-700">
                    출처 없음 — 신중히 판단하십시오
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <DevelopmentForm propertyId={property.id} />
        </div>
      </Card>

      {property.memo && (
        <Card>
          <h2 className="text-sm font-semibold">메모</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-muted)]">
            {property.memo}
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href={`/properties/${property.id}/edit`} className="flex-1">
          <Button variant="secondary" className="w-full">
            정보 수정
          </Button>
        </Link>
        <Link href="/compare" className="flex-1">
          <Button variant="secondary" className="w-full">
            다른 단지와 비교
          </Button>
        </Link>
        <ArchiveButton
          propertyId={property.id}
          archived={property.status === 'ARCHIVED'}
        />
        <DeletePropertyButton propertyId={property.id} name={property.name} />
      </div>

      <Disclaimer />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-[var(--color-border)] pb-2 sm:border-0 sm:pb-0">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="text-right font-medium tabular-nums">{value}</span>
    </div>
  )
}
