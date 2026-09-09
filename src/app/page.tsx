import { redirect } from 'next/navigation'
import { SignInButton } from '@/components/auth/SignInButton'
import { Card } from '@/components/ui'
import { getSessionUser } from '@/lib/firebase/session'
import { isAdminConfigured } from '@/lib/firebase/admin'

const AXES = [
  { label: '사무실 통근', weight: 20, note: '30분 이내 최고 · 90분 이상 최저' },
  { label: '가격 대비 시세', weight: 15, note: '반경 1km 실거래 중앙값 대비' },
  { label: '지하철 접근성', weight: 13, note: '도보시간 + 환승 없는 직결 여부' },
  { label: '학군 접근성', weight: 12, note: '초·중·고 도보시간, 가구 구성 반영' },
  { label: '버스 접근성', weight: 8, note: '정류장 도보 + 직통/환승' },
  { label: '투자 기회', weight: 8, note: '모멘텀·저평가·유동성·공급' },
  { label: '단지 노후도', weight: 7, note: '연차 U자 곡선, 재건축 기대 반영' },
  { label: '호재', weight: 7, note: '확실성 단계별 계수 적용' },
  { label: '대형마트 접근성', weight: 5, note: '도보·차량 중 유리한 쪽' },
  { label: '커뮤니티·관리비', weight: 5, note: '시설 구성 + 지역 평균 대비' },
]

export default async function LandingPage() {
  const user = await getSessionUser()
  if (user) redirect('/dashboard')

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 py-10 sm:px-8 lg:py-16">
      <header className="mb-10">
        <p className="text-sm font-semibold tracking-wide text-[var(--color-brand-text)]">
          HomeFit
        </p>
        <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
          이 아파트가
          <br className="sm:hidden" /> <span className="text-[var(--color-brand-text)]">나에게</span>{' '}
          좋은 집인가
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--color-muted)]">
          부동산 앱은 매물을 보여줄 뿐, 내 통근지와 생활반경을 알지 못합니다.
          HomeFit은 내 조건을 한 번 등록하고 관심 단지를 입력하면 11개 축의 정량
          지표로 적합도를 0~100점으로 산출하고 후보 간 순위를 매깁니다.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-muted)]">
            평가 축과 기본 가중치
          </h2>
          <Card className="p-0">
            <ul className="divide-y divide-[var(--color-border)]">
              {AXES.map((axis) => (
                <li
                  key={axis.label}
                  className="flex items-center gap-3 px-4 py-3 sm:px-5"
                >
                  <span className="w-8 shrink-0 text-right text-sm font-bold tabular-nums text-[var(--color-brand-text)]">
                    {axis.weight}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{axis.label}</span>
                    <span className="block text-xs text-[var(--color-muted)]">
                      {axis.note}
                    </span>
                  </span>
                </li>
              ))}
              <li className="flex items-center gap-3 bg-[var(--color-bg)] px-4 py-3 sm:px-5">
                <span className="w-8 shrink-0 text-right text-sm font-bold tabular-nums text-[var(--color-negative)]">
                  −15
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">리스크 감점</span>
                  <span className="block text-xs text-[var(--color-muted)]">
                    층간소음·소음·경사·유흥상권·주차 부족 등
                  </span>
                </span>
              </li>
            </ul>
          </Card>
        </section>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <Card className="space-y-5">
            <div>
              <h2 className="text-base font-semibold">시작하기</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">
                로그인 후 예산·사무실·자주 가는 장소를 등록하면 바로 분석할 수
                있습니다.
              </p>
            </div>
            <SignInButton configured={isAdminConfigured} />
            <ol className="space-y-2 text-sm text-[var(--color-muted)]">
              <li>1. 내 조건 등록 (예산·사무실·생활반경)</li>
              <li>2. 관심 아파트 입력 (단지명·면적·금액)</li>
              <li>3. 적합도 점수와 순위 확인</li>
            </ol>
          </Card>
          <p className="mt-4 px-1 text-xs leading-relaxed text-[var(--color-muted)]">
            본 서비스의 점수는 공개 공공데이터 기반 참고 정보이며 매수·매도를
            권유하지 않습니다.
          </p>
        </aside>
      </div>
    </main>
  )
}
