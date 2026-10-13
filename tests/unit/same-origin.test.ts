import { describe, expect, it } from 'vitest'
import { checkSameOrigin, isJsonContentType } from '@/lib/http/same-origin'

const h = (init: Record<string, string>) => new Headers(init)
const JSON_CT = { 'content-type': 'application/json' }

describe('isJsonContentType', () => {
  it('매개변수가 붙은 application/json 도 인정한다', () => {
    expect(isJsonContentType('application/json; charset=utf-8')).toBe(true)
    expect(isJsonContentType('Application/JSON')).toBe(true)
  })
  it('text/plain·없음은 아니다 — HTML form 이 보낼 수 있는 타입이다', () => {
    expect(isJsonContentType('text/plain')).toBe(false)
    expect(isJsonContentType(null)).toBe(false)
  })
})

describe('checkSameOrigin', () => {
  it('JSON 이 필요한데 text/plain 이면 415', () => {
    expect(
      checkSameOrigin(h({ 'content-type': 'text/plain', 'sec-fetch-site': 'same-origin' }), {
        requireJson: true,
      }),
    ).toMatchObject({ ok: false, status: 415 })
  })

  it('requireJson: false 면 Content-Type 을 보지 않는다', () => {
    expect(checkSameOrigin(h({ 'sec-fetch-site': 'same-origin' }), { requireJson: false })).toEqual({
      ok: true,
    })
  })

  it('Sec-Fetch-Site 는 same-origin 만 통과', () => {
    expect(
      checkSameOrigin(h({ ...JSON_CT, 'sec-fetch-site': 'same-origin' }), { requireJson: true }),
    ).toEqual({ ok: true })
    for (const site of ['cross-site', 'same-site', 'none']) {
      expect(
        checkSameOrigin(h({ ...JSON_CT, 'sec-fetch-site': site }), { requireJson: true }),
      ).toMatchObject({ ok: false, status: 403 })
    }
  })

  it('Sec-Fetch-Site 가 있으면 Origin 이 맞아 보여도 그것을 따른다', () => {
    expect(
      checkSameOrigin(
        h({ ...JSON_CT, 'sec-fetch-site': 'cross-site', origin: 'https://a.example', host: 'a.example' }),
        { requireJson: true },
      ),
    ).toMatchObject({ ok: false })
  })

  describe('Sec-Fetch-Site 가 없을 때 (구형 브라우저)', () => {
    it('Origin 과 X-Forwarded-Host 가 같으면 통과', () => {
      expect(
        checkSameOrigin(
          h({ ...JSON_CT, origin: 'https://homefit.example', 'x-forwarded-host': 'homefit.example', host: '0.0.0.0:8080' }),
          { requireJson: true },
        ),
      ).toEqual({ ok: true })
    })

    it('X-Forwarded-Host 가 없으면 Host 와 비교한다', () => {
      expect(
        checkSameOrigin(h({ ...JSON_CT, origin: 'http://localhost:3100', host: 'localhost:3100' }), {
          requireJson: true,
        }),
      ).toEqual({ ok: true })
    })

    it('X-Forwarded-Host 가 여러 값이면 첫 값을 쓴다', () => {
      expect(
        checkSameOrigin(
          h({ ...JSON_CT, origin: 'https://a.example', 'x-forwarded-host': 'a.example, proxy.internal' }),
          { requireJson: true },
        ),
      ).toEqual({ ok: true })
    })

    it('다른 출처·다른 포트·Origin 없음·null·형식 오류는 403', () => {
      const cases: Record<string, string>[] = [
        { origin: 'https://evil.example', host: 'homefit.example' },
        { origin: 'http://localhost:9999', host: 'localhost:3100' },
        { host: 'homefit.example' },
        { origin: 'null', host: 'homefit.example' },
        { origin: 'not a url', host: 'homefit.example' },
        { origin: 'https://homefit.example' },
      ]
      for (const headers of cases) {
        expect(checkSameOrigin(h({ ...JSON_CT, ...headers }), { requireJson: true })).toMatchObject({
          ok: false,
          status: 403,
        })
      }
    })
  })
})
