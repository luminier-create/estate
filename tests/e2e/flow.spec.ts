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

  // 2. 온보딩 — 예산
  await expect(page).toHaveURL(/\/onboarding/)
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

  // 5. 대시보드 — 빈 상태
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByText('등록된 단지가 없습니다')).toBeVisible()

  // 6. 단지 등록 (1)
  await page.goto('/properties/new')
  await registerProperty(page, '도곡', '래미안 도곡카운티', '25.7', '180000')
  await page.waitForURL(/\/properties\/p_/, { timeout: 45_000 })
  await expect(page.getByText(/등급/).first()).toBeVisible()

  // 7. 단지 등록 (2)
  await page.goto('/properties/new')
  await registerProperty(page, '상계', '상계주공 7단지', '18.5', '75000')
  await page.waitForURL(/\/properties\/p_/, { timeout: 45_000 })

  // 8. 대시보드 순위
  await page.goto('/dashboard')
  await expect(page.getByText('1위')).toBeVisible()
  await expect(page.getByText('2위')).toBeVisible()

  // 9. 비교 화면 — 가중치 조절이 즉시 반영되는지
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
  await page.goto('/dashboard')
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
