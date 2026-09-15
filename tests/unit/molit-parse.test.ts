/**
 * 국토부 실거래가 응답 변환.
 *
 * 이 API 가 실제로 틀리는 지점만 고정한다 — 인증키 인코딩, 계약 해제 건,
 * 그리고 오류를 HTTP 200 으로 돌려주는 응답. 마지막 것이 특히 위험한데,
 * 빈 배열로 읽히면 과거 월 무기한 캐시에 "거래 0건" 으로 굳는다.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SERVICE_NAME,
  buildTradeUrl,
  normalizeServiceKey,
  parseAmount,
  parseTradeXml,
  recentMonths,
} from '@/lib/providers/molit/parse'

const ENCODED = 'abc%2Fdef%2Bghi%3D%3D'
const DECODED = 'abc/def+ghi=='

function xml(items: string, resultCode = '000'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<response><header><resultCode>${resultCode}</resultCode><resultMsg>OK</resultMsg></header>
<body><items>${items}</items><numOfRows>10</numOfRows><totalCount>1</totalCount></body></response>`
}

const ITEM = `<item><aptNm>래미안</aptNm><excluUseAr>84.97</excluUseAr>
<dealAmount> 123,000</dealAmount><dealYear>2026</dealYear><dealMonth>8</dealMonth>
<dealDay>5</dealDay><floor>12</floor><buildYear>2005</buildYear><umdNm>역삼동</umdNm></item>`

describe('normalizeServiceKey', () => {
  it('인코딩 키는 그대로 둔다 — 다시 인코딩하면 %252F 가 되어 인증이 깨진다', () => {
    expect(normalizeServiceKey(ENCODED)).toBe(ENCODED)
  })

  it('디코딩 키는 한 번만 인코딩한다', () => {
    expect(normalizeServiceKey(DECODED)).toBe('abc%2Fdef%2Bghi%3D%3D')
  })

  it('어느 형태를 넣어도 같은 URL 이 된다', () => {
    const a = buildTradeUrl({ serviceKey: ENCODED, lawdCd: '11680', yyyymm: '202608' })
    const b = buildTradeUrl({ serviceKey: DECODED, lawdCd: '11680', yyyymm: '202608' })
    expect(a).toBe(b)
  })

  it('앞뒤 공백을 제거한다 — 포털에서 복사하면 따라붙는다', () => {
    expect(normalizeServiceKey(`  ${ENCODED}\n`)).toBe(ENCODED)
  })
})

describe('buildTradeUrl', () => {
  it('서비스명이 경로와 오퍼레이션 이름을 함께 정한다', () => {
    const url = buildTradeUrl({ serviceKey: ENCODED, lawdCd: '11680', yyyymm: '202608' })
    expect(url).toContain(`/${DEFAULT_SERVICE_NAME}/get${DEFAULT_SERVICE_NAME}?`)
    expect(url).toContain('LAWD_CD=11680')
    expect(url).toContain('DEAL_YMD=202608')
  })

  it('상세 자료로 전환할 수 있다 — 활용신청한 서비스가 다르면 호출이 거부된다', () => {
    const url = buildTradeUrl({
      serviceKey: ENCODED,
      lawdCd: '11680',
      yyyymm: '202608',
      serviceName: 'RTMSDataSvcAptTradeDev',
    })
    expect(url).toContain('/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?')
  })
})

describe('parseTradeXml', () => {
  it('콤마·공백이 섞인 거래금액을 숫자로 만든다', () => {
    const [t] = parseTradeXml(xml(ITEM))
    expect(t!.amountManwon).toBe(123_000)
    expect(t!.exclusiveM2).toBeCloseTo(84.97)
    expect(t!.dealDate).toBe('2026-08-05')
    expect(t!.buildYear).toBe(2005)
  })

  it('계약 해제 건을 제외한다 — 포함하면 시세가 왜곡된다', () => {
    const cancelled = ITEM.replace('</item>', '<cdealType>O</cdealType></item>')
    expect(parseTradeXml(xml(cancelled))).toHaveLength(0)
    expect(parseTradeXml(xml(ITEM + cancelled))).toHaveLength(1)
  })

  it('항목이 1건이어도 배열로 돌려준다 — XML 파서가 단일 노드를 객체로 만든다', () => {
    expect(parseTradeXml(xml(ITEM))).toHaveLength(1)
    expect(parseTradeXml(xml(ITEM + ITEM))).toHaveLength(2)
  })

  it('거래 0건은 빈 배열 — 오류가 아니다', () => {
    expect(parseTradeXml(xml(''))).toEqual([])
  })

  it('키 오류·한도 초과 응답을 거래 0건으로 읽지 않는다', () => {
    // data.go.kr 은 이 오류를 HTTP 200 + response 키가 없는 XML 로 돌려준다.
    const err = `<OpenAPI_ServiceResponse><cmmMsgHeader>
<returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg>
<returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>`
    expect(() => parseTradeXml(err)).toThrow(/응답 형식 오류/)
  })

  it('활용신청하지 않은 서비스 호출도 오류로 드러난다', () => {
    const err = `<OpenAPI_ServiceResponse><cmmMsgHeader>
<returnAuthMsg>SERVICE_ACCESS_DENIED_ERROR</returnAuthMsg>
<returnReasonCode>20</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>`
    expect(() => parseTradeXml(err)).toThrow(/응답 형식 오류/)
  })

  it('resultCode 가 성공이 아니면 throw', () => {
    expect(() => parseTradeXml(xml(ITEM, '99'))).toThrow(/응답 오류/)
  })

  it('손상된 행은 버리고 나머지를 살린다', () => {
    const broken = `<item><aptNm>없음</aptNm><excluUseAr>0</excluUseAr>
<dealAmount>-</dealAmount><dealYear>2026</dealYear><dealMonth>8</dealMonth>
<dealDay>5</dealDay></item>`
    const trades = parseTradeXml(xml(ITEM + broken))
    expect(trades).toHaveLength(1)
    expect(trades[0]!.aptName).toBe('래미안')
  })
})

describe('parseAmount', () => {
  it.each([
    [' 123,000', 123_000],
    ['1,234,500', 1_234_500],
    [98_000, 98_000],
  ])('%s → %s', (raw, expected) => {
    expect(parseAmount(raw as string | number)).toBe(expected)
  })

  it('빈 값은 NaN — 0 으로 만들면 최저가 거래로 둔갑한다', () => {
    expect(parseAmount(undefined)).toBeNaN()
    expect(parseAmount('')).toBeNaN()
  })
})

describe('recentMonths', () => {
  it('당월을 제외하고 직전월부터 거슬러 올라간다', () => {
    // 신고 기한이 30일이라 당월은 항상 불완전하다
    expect(recentMonths(3, new Date(2026, 0, 15))).toEqual(['202512', '202511', '202510'])
  })

  it('연도 경계를 넘긴다', () => {
    expect(recentMonths(2, new Date(2026, 1, 1))).toEqual(['202601', '202512'])
  })
})
