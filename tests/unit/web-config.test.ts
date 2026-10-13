import { describe, expect, it } from 'vitest'
import { webConfigBuildError, webEnvFromAppHosting } from '@/lib/firebase/web-config'

const WEBAPP = JSON.stringify({
  apiKey: 'AIza-test',
  authDomain: 'estate-83713.firebaseapp.com',
  projectId: 'estate-83713',
  storageBucket: 'estate-83713.firebasestorage.app',
  messagingSenderId: '811232525494',
  appId: '1:811232525494:web:abc',
  measurementId: 'G-XXXX',
})

describe('webEnvFromAppHosting', () => {
  it('FIREBASE_WEBAPP_CONFIG 에서 NEXT_PUBLIC_FIREBASE_* 6개를 만든다', () => {
    const r = webEnvFromAppHosting({ FIREBASE_WEBAPP_CONFIG: WEBAPP })
    expect(r.env).toEqual({
      NEXT_PUBLIC_FIREBASE_API_KEY: 'AIza-test',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'estate-83713.firebaseapp.com',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'estate-83713',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'estate-83713.firebasestorage.app',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '811232525494',
      NEXT_PUBLIC_FIREBASE_APP_ID: '1:811232525494:web:abc',
    })
    expect(r.missing).toEqual([])
    expect(r.parseError).toBe(false)
  })

  it('이미 명시된 값은 건너뛴다 — .env.local·콘솔 값이 이긴다', () => {
    const r = webEnvFromAppHosting({
      FIREBASE_WEBAPP_CONFIG: WEBAPP,
      NEXT_PUBLIC_FIREBASE_API_KEY: 'explicit',
    })
    expect(r.env).not.toHaveProperty('NEXT_PUBLIC_FIREBASE_API_KEY')
    expect(r.missing).toEqual([])
  })

  it('빈 문자열 값은 내보내지 않는다', () => {
    const r = webEnvFromAppHosting({
      FIREBASE_WEBAPP_CONFIG: JSON.stringify({ apiKey: '', projectId: 'p' }),
    })
    expect(r.env).toEqual({ NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'p' })
    expect(r.missing).toContain('NEXT_PUBLIC_FIREBASE_API_KEY')
  })

  it('잘못된 JSON 이면 parseError 와 빈 결과', () => {
    const r = webEnvFromAppHosting({ FIREBASE_WEBAPP_CONFIG: '{oops' })
    expect(r).toMatchObject({ env: {}, parseError: true })
    expect(r.missing).toHaveLength(4)
  })

  it('값이 없으면 아무것도 만들지 않는다 (로컬·CI)', () => {
    expect(webEnvFromAppHosting({}).env).toEqual({})
  })
})

describe('webConfigBuildError', () => {
  it('firebase 모드가 아니면 검사하지 않는다 (로컬·CI·데모 빌드)', () => {
    expect(webConfigBuildError({})).toBeNull()
    expect(webConfigBuildError({ HOMEFIT_AUTH_MODE: 'demo' })).toBeNull()
  })

  it('firebase 모드인데 웹 설정이 없으면 메시지', () => {
    const msg = webConfigBuildError({ HOMEFIT_AUTH_MODE: 'firebase' })
    expect(msg).toContain('Firebase 웹 설정이 없습니다')
    expect(msg).toContain('NEXT_PUBLIC_FIREBASE_API_KEY')
  })

  it('JSON 을 못 읽은 경우를 알려준다', () => {
    expect(
      webConfigBuildError({ HOMEFIT_AUTH_MODE: 'firebase', FIREBASE_WEBAPP_CONFIG: '{oops' }),
    ).toContain('JSON')
  })

  it('웹 앱이 연결돼 있거나 값을 명시했으면 통과', () => {
    expect(
      webConfigBuildError({ HOMEFIT_AUTH_MODE: 'firebase', FIREBASE_WEBAPP_CONFIG: WEBAPP }),
    ).toBeNull()
    expect(
      webConfigBuildError({
        HOMEFIT_AUTH_MODE: 'firebase',
        NEXT_PUBLIC_FIREBASE_API_KEY: 'k',
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'd',
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'p',
        NEXT_PUBLIC_FIREBASE_APP_ID: 'a',
      }),
    ).toBeNull()
  })
})
