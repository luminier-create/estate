import { redirect } from 'next/navigation'
import { OnboardingForm } from '@/components/onboarding/OnboardingForm'
import { getSessionUser } from '@/lib/firebase/session'
import { ensureProfile } from '@/lib/repo'

export default async function OnboardingPage() {
  const user = await getSessionUser()
  if (!user) redirect('/')

  const profile = await ensureProfile(user)

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-8 sm:px-8">
      <header className="mb-8">
        <p className="text-sm font-semibold text-[var(--color-brand)]">HomeFit</p>
        <h1 className="mt-2 text-2xl font-bold">내 조건 등록</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
          이 정보가 모든 분석의 기준이 됩니다. 나중에 언제든 수정할 수 있고,
          수정하면 등록된 단지가 자동으로 재분석됩니다.
        </p>
      </header>
      <OnboardingForm profile={profile} />
    </main>
  )
}
