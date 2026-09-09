/**
 * E2E: 데모 로그인 → 온보딩 → 단지 등록 → 분석 결과 → 비교
 * Firebase 미설정 환경(데모 모드) 기준으로 전체 흐름을 검증한다.
 */
import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test('전체 흐름: 로그인 → 온보딩 → 단지 등록 → 분석 → 비교', async ({ page }) => {
  // 1. 랜딩 → 데모 로그인
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('나에게')
  await page.getByRole('button', { name: /데모 모드로 둘러보기/ }).click()
  await page.waitForURL(/\/onboarding|\/dashboard/)

  // 데모 저장소는 서버 프로세스 메모리에 남으므로, 이미 온보딩된 상태면 건너뛴다.
  // (같은 서버에 테스트를 반복 실행해도 통과해야 한다)
  // 판정은 로그인 직후의 URL 이 아니라 보호된 경로에 실제로 진입되는지로 한다 —
  // 로그인 직후에는 서버 리다이렉트가 한 번 더 일어날 수 있다.
  await page.goto('/properties/new')
  if (page.url().includes('/onboarding')) {
    // 2. 온보딩 — 예산
    await page.getByLabel('목표 매입 금액').fill('180000')
    await page.getByLabel('가구 구성').selectOption('WITH_ELEMENTARY')
    await page.getByRole('button', { name: '다음' }).click()

    // 3. 온보딩 — 사무실
    await page.getByLabel('사무실 위치').fill('역삼')
    await page.getByRole('button', { name: /역삼/ }).first().click()
    await page.getByRole('button', { name: '다음' }).click()

    // 4. 온보딩 — 자주 가는 장소
    await page.getByLabel('자주 가는 장소').fill('강남역')
    await page.getByRole('button', { name: /강남역/ }).first().click()
    await page.getByRole('button', { name: '등록하고 시작하기' }).click()
    await expect(page).toHaveURL(/\/dashboard/)
    await page.goto('/properties/new')
  }
  await expect(page.getByLabel('주소 검색')).toBeVisible()

  // 5. 단지 등록 2건 — 이름은 실행마다 다르게 해 이전 실행분과 구분한다
  const stamp = Date.now().toString(36).slice(-5)
  await registerProperty(page, '도곡', `래미안 도곡카운티 ${stamp}`, '25.7', '180000')
  await page.waitForURL(/\/properties\/p_/, { timeout: 45_000 })
  await expect(page.getByText(/등급/).first()).toBeVisible()

  // 위치 카드에 주변 시설이 거리·도보시간과 함께 노출된다
  // (지도 키가 없는 환경에서도 텍스트로 확인 가능해야 한다)
  await expect(page.getByText('지하철역', { exact: true })).toBeVisible()
  await expect(page.getByText(/도보 \d+분/).first()).toBeVisible()

  await page.goto('/properties/new')
  await registerProperty(page, '상계', `상계주공 7단지 ${stamp}`, '18.5', '75000')
  await page.waitForURL(/\/properties\/p_/, { timeout: 45_000 })

  // 6. 대시보드 — 순위가 매겨지고 방금 등록한 두 건이 보인다
  await page.goto('/dashboard')
  await expect(page.getByText('1위', { exact: true })).toBeVisible()
  await expect(page.getByText('2위', { exact: true })).toBeVisible()
  await expect(page.getByText(`래미안 도곡카운티 ${stamp}`)).toBeVisible()
  await expect(page.getByText(`상계주공 7단지 ${stamp}`)).toBeVisible()

  // 7. 단지 수정 — 추가 정보를 채우면 결측 축이 줄어든다
  await page.goto('/dashboard')
  await page.getByText(`래미안 도곡카운티 ${stamp}`).click()
  await page.waitForURL(/\/properties\/p_/)
  await expect(
    page.getByText('커뮤니티·관리비').locator('xpath=..').getByText('데이터 없음'),
  ).toBeVisible()

  await page.getByRole('link', { name: '정보 수정' }).click()
  await page.waitForURL(/\/edit$/)
  await page.getByRole('button', { name: /추가 정보/ }).click()
  await page.getByLabel('총 세대수').fill('1200')
  await page.getByLabel('㎡당 월 관리비 (원)').fill('2200')
  await page.getByRole('button', { name: '피트니스센터' }).click()
  await page.getByRole('button', { name: /수정하고 재분석/ }).click()
  await page.waitForURL(/\/properties\/p_[^/]*$/, { timeout: 45_000 })

  // 결측이던 커뮤니티·관리비 축이 점수를 갖는다
  await expect(page.getByText('커뮤니티 시설 미입력')).toHaveCount(0)

  // 8. 비교 화면 — 프리셋 전환이 즉시 반영되는지
  await page.goto('/compare')
  await expect(page.getByRole('table')).toBeVisible()
  await page.getByRole('button', { name: '직주근접' }).click()
  await expect(page.getByRole('table')).toBeVisible()
})

async function registerProperty(
  page: import('@playwright/test').Page,
  search: string,
  name: string,
  area: string,
  price: string,
) {
  await page.getByLabel('주소 검색').fill(search)
  await page.locator('ul li button').first().click()
  await page.getByLabel('단지명').fill(name)
  await page.getByLabel('전용면적').fill(area)
  await page.getByLabel('금액 (만원)').fill(price)
  await page.getByRole('button', { name: /등록하고 분석하기/ }).click()
}

test('모바일 뷰포트에서 가로 스크롤이 발생하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto('/')
  await page.getByRole('button', { name: /데모 모드로 둘러보기/ }).click()
  await page.waitForURL(/\/onboarding|\/dashboard/)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
})

test('미인증 상태로 보호된 경로에 접근하면 랜딩으로 보낸다', async ({ browser }) => {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  for (const path of ['/dashboard', '/compare', '/settings', '/properties/new']) {
    const res = await page.goto(path)
    expect(res?.status(), `${path} 는 오류 없이 리다이렉트되어야 한다`).toBeLessThan(400)
    await expect(page).toHaveURL(/\/$/)
  }
  await ctx.close()
})
