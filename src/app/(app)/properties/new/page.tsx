import { redirect } from 'next/navigation'
import { PropertyForm } from '@/components/property/PropertyForm'
import { requireUserOrRedirect } from '@/lib/firebase/session'
import { getProfile } from '@/lib/repo'

export default async function NewPropertyPage() {
  const user = await requireUserOrRedirect()
  const profile = await getProfile(user.uid)
  if (!profile?.onboardingCompleted) redirect('/onboarding')

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold sm:text-2xl">단지 등록</h1>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
          부동산 앱에서 본 단지명·면적·금액만 입력하면 분석이 시작됩니다.
          아래 추가 정보는 선택이지만, 입력할수록 평가 축이 늘어나 신뢰도가 올라갑니다.
        </p>
      </header>
      <PropertyForm defaultUnit={profile.areaUnit} />
    </div>
  )
}
