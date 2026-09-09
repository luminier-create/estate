import { redirect } from 'next/navigation'
import { Badge, Card, Disclaimer } from '@/components/ui'
import { OnboardingForm } from '@/components/onboarding/OnboardingForm'
import { requireUserOrRedirect } from '@/lib/firebase/session'
import { getProfile } from '@/lib/repo'
import { providerStatus } from '@/lib/providers'
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
      </Card>

      <Disclaimer />
    </div>
  )
}
