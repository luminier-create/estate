import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { getSessionUser } from '@/lib/firebase/session'
import { ensureProfile } from '@/lib/repo'
import { providerStatus } from '@/lib/providers'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect('/')

  await ensureProfile(user)

  const mockCount = Object.values(providerStatus).filter(
    (v) => v === 'mock',
  ).length
  const notice =
    user.isDemo || mockCount > 0
      ? `${user.isDemo ? '데모 모드 · ' : ''}외부 데이터 ${mockCount}종이 시드 데이터로 동작 중입니다. .env.local 에 API 키를 넣으면 실데이터로 전환됩니다.`
      : undefined

  return (
    <AppShell user={user} demoNotice={notice}>
      {children}
    </AppShell>
  )
}
