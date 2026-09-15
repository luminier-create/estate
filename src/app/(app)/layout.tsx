import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { getSessionUser } from '@/lib/firebase/session'
import { ensureProfile } from '@/lib/repo'
import { ensureDemoSeed } from '@/lib/demo-seed'
import { providerStatus } from '@/lib/providers'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect('/')

  await ensureProfile(user)
  // 서버리스에 올리면 인메모리 저장소가 인스턴스마다 따로라 빈 화면으로 시작한다.
  // DEMO_SEED 가 켜져 있을 때만 어느 인스턴스에서든 같은 후보 3건을 채운다.
  await ensureDemoSeed(user.uid)

  const mockCount = Object.values(providerStatus).filter(
    (v) => v === 'mock',
  ).length
  const notice =
    user.isDemo || mockCount > 0
      ? `${user.isDemo ? '데모 모드 · ' : ''}외부 데이터 ${mockCount}종이 시드 데이터로 동작 중입니다. 환경변수에 API 키를 넣으면 실데이터로 전환됩니다.`
      : undefined

  return (
    <AppShell user={user} demoNotice={notice}>
      {children}
    </AppShell>
  )
}
