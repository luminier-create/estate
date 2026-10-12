/**
 * 개발 서버 라우트 예열.
 *
 * next dev 는 라우트를 처음 요청받을 때 컴파일한다. 느린 러너에서는 이 최초
 * 컴파일이 테스트 타임아웃을 넘길 수 있어, 실제 검증 전에 한 번씩 두드려 둔다.
 * (인증이 필요한 경로는 리다이렉트되지만 컴파일은 유발된다)
 */
const ROUTES = [
  '/',
  '/onboarding',
  '/dashboard',
  '/properties/new',
  '/compare',
  '/settings',
  '/api/places/search?q=test',
]

export default async function globalSetup() {
  const base = process.env.E2E_BASE_URL ?? 'http://localhost:3100'

  const started = Date.now()
  await Promise.all(
    ROUTES.map((route) =>
      fetch(`${base}${route}`, { redirect: 'follow' }).catch(() => undefined),
    ),
  )
  console.log(`라우트 예열 완료 (${Math.round((Date.now() - started) / 1000)}초)`)
}
