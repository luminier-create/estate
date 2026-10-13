import { expect, test } from '@playwright/test'

/**
 * 세션 발급 라우트의 교차 출처 차단 (login CSRF).
 *
 * APIRequestContext 는 Sec-Fetch-Site 를 붙이지 않으므로 Origin 분기를 시험한다.
 * 데모 서버에서 돌고, 매 실행이 새 데모 쿠키를 받을 뿐이라 반복 실행해도 같다.
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3100'

test('text/plain 본문은 415 이고 쿠키를 주지 않는다', async ({ request }) => {
  const res = await request.post('/api/auth/session', {
    headers: { 'content-type': 'text/plain', origin: BASE },
    data: '{"demo":true}',
  })
  expect(res.status()).toBe(415)
  expect(res.headers()['set-cookie']).toBeUndefined()
})

test('다른 출처에서 온 JSON 요청은 403', async ({ request }) => {
  const res = await request.post('/api/auth/session', {
    headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
    data: { demo: true },
  })
  expect(res.status()).toBe(403)
  expect(res.headers()['set-cookie']).toBeUndefined()
})

test('여분 키를 끼운 본문은 400', async ({ request }) => {
  const res = await request.post('/api/auth/session', {
    headers: { 'content-type': 'application/json', origin: BASE },
    data: { demo: true, x: '=' },
  })
  expect(res.status()).toBe(400)
})

test('같은 출처의 데모 요청은 쿠키를 받는다', async ({ request }) => {
  const res = await request.post('/api/auth/session', {
    headers: { 'content-type': 'application/json', origin: BASE },
    data: { demo: true },
  })
  expect(res.status()).toBe(200)
  expect(res.headers()['set-cookie']).toMatch(/__demo=[0-9a-f]{32}/)
})

test('다른 출처의 로그아웃은 403', async ({ request }) => {
  const res = await request.delete('/api/auth/session', {
    headers: { origin: 'https://evil.example' },
  })
  expect(res.status()).toBe(403)
})
