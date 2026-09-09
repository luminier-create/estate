import { redirect } from 'next/navigation'
import { Badge, Card, Disclaimer } from '@/components/ui'
import { OnboardingForm } from '@/components/onboarding/OnboardingForm'
import { requireUserOrRedirect } from '@/lib/firebase/session'
import { getProfile } from '@/lib/repo'
import { providerStatus } from '@/lib/providers'
import { remainingQuota } from '@/lib/cache'
import { quotaLimit, type QuotaProvider } from '@/lib/cache-keys'
import { getPreset } from '@/lib/scoring/presets'
import { ALGORITHM_VERSION } from '@/lib/scoring/types'

const PROVIDER_LABEL: Record<string, string> = {
  geo: '지도·장소 (카카오 로컬)',
  market: '실거래가 (국토교통부)',
  transit: '대중교통 경로 (ODsay)',
  aptInfo: '공동주택 정보',
}

export default async function SettingsPage() {
  const user = await requireUserOrRedirect()
  const profile = await getProfile(user.uid)
  if (!profile) redirect('/')

  // 실 Provider 로 동작 중인 것만 잔여 쿼터를 보여준다
  const liveProviders = (
    [
      ['geo', 'kakao'],
      ['market', 'molit'],
      ['transit', 'odsay'],
    ] as const
  ).filter(([key, name]) => providerStatus[key] === name)

  const quotas = await Promise.all(
    liveProviders.map(async ([, name]) => ({
      name: name as QuotaProvider,
      remaining: await remainingQuota(name as QuotaProvider),
      limit: quotaLimit(name as QuotaProvider),
    })),
  )

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold sm:text-2xl">내 정보</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          조건을 수정하면 저장 시 등록된 단지가 자동으로 재분석됩니다.
        </p>
      </header>

      <Card className="space-y-1 text-sm">
        <p className="font-medium">{profile.displayName}</p>
        <p className="text-[var(--color-muted)]">{profile.email}</p>
        <p className="pt-2 text-xs text-[var(--color-muted)]">
          적용 기준: {getPreset(profile.weights.presetId).label} · 알고리즘{' '}
          {ALGORITHM_VERSION}
        </p>
      </Card>

      <OnboardingForm
        profile={profile}
        redirectTo="/settings"
        submitLabel="저장하고 재분석"
      />

      <Card>
        <h2 className="text-sm font-semibold">데이터 소스 상태</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          `mock` 으로 표시된 항목은 시드 데이터로 동작합니다. 실데이터로 전환하려면
          해당 API 키를 .env.local 에 설정하십시오. 발급 절차는 저장소의
          docs/03-DATA-SOURCES.md 를 참고하십시오.
        </p>
        <ul className="mt-3 space-y-2">
          {Object.entries(providerStatus).map(([key, value]) => (
            <li key={key} className="flex items-center justify-between gap-3 text-sm">
              <span>{PROVIDER_LABEL[key] ?? key}</span>
              <Badge tone={value === 'mock' ? 'warn' : 'positive'}>
                {value === 'mock' ? '시드 데이터' : value}
              </Badge>
            </li>
          ))}
        </ul>

        {quotas.length > 0 && (
          <div className="mt-5 border-t border-[var(--color-border)] pt-4">
            <h3 className="text-sm font-semibold">오늘 남은 조회 한도</h3>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              외부 API 는 무료 티어라 일일 호출 수가 제한됩니다. 한도에 도달하면
              해당 항목만 결측 처리되고 나머지 축으로 점수가 산출됩니다. 동일한
              조회는 캐시되므로 같은 단지를 다시 분석해도 한도를 쓰지 않습니다.
            </p>
            <ul className="mt-3 space-y-2">
              {quotas.map((q) => (
                <li key={q.name} className="flex items-center justify-between gap-3 text-sm">
                  <span>{q.name}</span>
                  <Badge tone={q.remaining === 0 ? 'negative' : q.remaining < q.limit * 0.2 ? 'warn' : 'neutral'}>
                    {q.remaining.toLocaleString('ko-KR')} / {q.limit.toLocaleString('ko-KR')}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Disclaimer />
    </div>
  )
}
