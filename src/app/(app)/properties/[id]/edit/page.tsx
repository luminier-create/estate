import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { PropertyForm } from '@/components/property/PropertyForm'
import { requireUserOrRedirect } from '@/lib/firebase/session'
import { getProfile, getProperty } from '@/lib/repo'

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUserOrRedirect()
  const profile = await getProfile(user.uid)
  if (!profile?.onboardingCompleted) redirect('/onboarding')

  const property = await getProperty(user.uid, id)
  if (!property) notFound()

  return (
    <div className="space-y-5">
      <header>
        <Link href={`/properties/${id}`} className="text-sm text-[var(--color-muted)]">
          ← {property.name}
        </Link>
        <h1 className="mt-2 text-xl font-bold sm:text-2xl">단지 수정</h1>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
          저장하면 곧바로 재분석됩니다. 연식·세대수·관리비·커뮤니티 시설을 채울수록
          결측 축이 줄어 신뢰도가 올라갑니다.
        </p>
      </header>
      <PropertyForm defaultUnit={profile.areaUnit} initial={property} />
    </div>
  )
}
