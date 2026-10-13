/**
 * Route Handler 용 동일 출처 검사 — 순수 함수.
 *
 * Next 는 서버 액션에만 Origin 검사를 하고 Route Handler 에는 하지 않는다. 세션 발급
 * 라우트가 이 검사 없이 `req.json()` 을 쓰면, 공격자 페이지의
 * `<form enctype="text/plain">` 이 JSON 처럼 생긴 본문을 보내 피해자 브라우저에
 * 공격자 계정의 세션 쿠키를 심을 수 있다 (login CSRF).
 */
export type OriginCheck = { ok: true } | { ok: false; status: 403 | 415; reason: string }

export function isJsonContentType(v: string | null): boolean {
  return (v ?? '').split(';')[0]!.trim().toLowerCase() === 'application/json'
}

function firstHost(v: string | null): string | null {
  return v?.split(',')[0]?.trim().toLowerCase() || null
}

/**
 * `new URL(req.url).origin` 은 비교에 쓰지 않는다. standalone 서버(App Hosting)에서는
 * 내부 주소(`http://0.0.0.0:<PORT>`)가 나와 정상 요청까지 막힌다.
 *
 * 1) Sec-Fetch-Site 가 있으면 same-origin 만 통과한다. 페이지 스크립트가 위조할 수
 *    없는 금지 헤더다.
 * 2) 없으면(구형 브라우저) Origin 의 host 를 X-Forwarded-Host 첫 값, 없으면 Host 와
 *    비교한다. Origin 도 없으면 거부한다 — 헤더가 없다고 같은 출처로 간주하지 않는다.
 */
export function checkSameOrigin(h: Headers, opts: { requireJson: boolean }): OriginCheck {
  if (opts.requireJson && !isJsonContentType(h.get('content-type'))) {
    return { ok: false, status: 415, reason: 'content-type' }
  }
  const site = h.get('sec-fetch-site')
  if (site !== null) {
    return site === 'same-origin'
      ? { ok: true }
      : { ok: false, status: 403, reason: `sec-fetch-site=${site}` }
  }
  const origin = h.get('origin')
  if (!origin || origin === 'null') return { ok: false, status: 403, reason: 'origin 없음' }
  let originHost: string
  try {
    originHost = new URL(origin).host.toLowerCase()
  } catch {
    return { ok: false, status: 403, reason: 'origin 형식' }
  }
  const expected = firstHost(h.get('x-forwarded-host')) ?? firstHost(h.get('host'))
  return expected && originHost === expected
    ? { ok: true }
    : { ok: false, status: 403, reason: 'origin 불일치' }
}
