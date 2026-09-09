/**
 * 접근성 감사 — WCAG 2.1 A/AA
 * 위반이 발견되면 실패하고 어느 요소인지 출력한다.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function audit(page: Page, label: string) {
  await page.waitForLoadState('domcontentloaded')

  // 개발 서버가 해당 라우트를 처음 컴파일하는 중이면 axe 주입 자체가 실패할 수 있다.
  // 접근성 문제가 아니라 준비 상태 문제이므로 한 번만 다시 시도한다.
  let violations
  for (let attempt = 0; ; attempt++) {
    try {
      ;({ violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze())
      break
    } catch (e) {
      if (attempt >= 1) throw e
      await page.waitForTimeout(2000)
      await page.reload({ waitUntil: 'domcontentloaded' })
    }
  }

  const summary = violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
  }))

  expect(summary, `${label} 접근성 위반`).toEqual([])
}

async function signIn(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /데모 모드로 둘러보기/ }).click()

  // 데모 로그인은 세션 쿠키를 받은 뒤에 이동한다. 이 이동을 기다리지 않고 다음
  // 요청을 보내면 쿠키 없이 랜딩에 머물러 아래 온보딩 분기를 건너뛰게 되고,
  // 이후 보호된 경로가 전부 온보딩으로 튕긴다.
  await page.waitForURL(/\/onboarding|\/dashboard/)

  await page.goto('/properties/new')
  if (page.url().includes('/onboarding')) {
    await page.getByLabel('목표 매입 금액').fill('180000')
    await page.getByRole('button', { name: '다음' }).click()
    await page.getByLabel('사무실 위치').fill('역삼')
    await page.getByRole('button', { name: /역삼/ }).first().click()
    await page.getByRole('button', { name: '다음' }).click()
    await page.getByRole('button', { name: '등록하고 시작하기' }).click()
    await page.waitForURL(/\/dashboard/)
    await page.goto('/properties/new')
  }

  // 여기까지 왔으면 보호된 경로에 실제로 진입한 상태여야 한다
  await expect(page.getByLabel('주소 검색')).toBeVisible()
}

test('랜딩 화면', async ({ page }) => {
  await page.goto('/')
  await audit(page, '랜딩')
})

// 다크 모드는 토큰이 통째로 바뀌므로 별도로 검사해야 한다.
test('다크 모드 — 랜딩·대시보드·상세', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await audit(page, '랜딩(다크)')

  await signIn(page)
  await page.goto('/dashboard')
  await audit(page, '대시보드(다크)')

  await page.goto('/properties/new')
  await page.getByLabel('주소 검색').fill('상계')
  await page.locator('ul li button').first().click()
  await page.getByLabel('단지명').fill('다크모드 검사 단지')
  await page.getByLabel('전용면적').fill('18.5')
  await page.getByLabel('금액 (만원)').fill('75000')
  await page.getByRole('button', { name: /등록하고 분석하기/ }).click()
  await page.waitForURL(/\/properties\/p_/, { timeout: 60_000 })
  await audit(page, '단지 상세(다크)')
})

test('온보딩 화면', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /데모 모드로 둘러보기/ }).click()
  await page.goto('/onboarding')
  await audit(page, '온보딩')
})

test('대시보드·단지 등록·설정 화면', async ({ page }) => {
  await signIn(page)

  await page.goto('/dashboard')
  await audit(page, '대시보드')

  await page.goto('/properties/new')
  await page.getByRole('button', { name: /추가 정보/ }).click()
  await audit(page, '단지 등록(추가 정보 펼침)')

  await page.goto('/settings')
  await audit(page, '설정')
})

test('단지 상세 화면', async ({ page }) => {
  await signIn(page)
  await page.goto('/properties/new')
  await page.getByLabel('주소 검색').fill('도곡')
  await page.locator('ul li button').first().click()
  await page.getByLabel('단지명').fill('접근성 검사 단지')
  await page.getByLabel('전용면적').fill('25.7')
  await page.getByLabel('금액 (만원)').fill('180000')
  await page.getByRole('button', { name: /등록하고 분석하기/ }).click()
  await page.waitForURL(/\/properties\/p_/, { timeout: 60_000 })
  await audit(page, '단지 상세')
})
