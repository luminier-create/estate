import { describe, expect, it } from 'vitest'
import {
  adminErrorLabel,
  classifyAdminError,
  projectIdFromFirebaseConfig,
  resolveAuthMode,
} from '@/lib/firebase/auth-mode'

const CERT = {
  FIREBASE_ADMIN_PROJECT_ID: 'estate-83713',
  FIREBASE_ADMIN_CLIENT_EMAIL: 'sa@estate-83713.iam.gserviceaccount.com',
  FIREBASE_ADMIN_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
}

describe('resolveAuthMode — 판정표', () => {
  it('아무 신호도 없으면 데모 (로컬·E2E·Vercel 데모)', () => {
    expect(resolveAuthMode({})).toEqual({
      mode: 'demo',
      credential: null,
      projectId: undefined,
      problems: [],
    })
  })

  it('App Hosting 정상: 선언 firebase + K_SERVICE + FIREBASE_CONFIG → adc', () => {
    const r = resolveAuthMode({
      HOMEFIT_AUTH_MODE: 'firebase',
      K_SERVICE: 'homefit',
      FIREBASE_CONFIG: '{"projectId":"estate-83713","storageBucket":"x"}',
    })
    expect(r).toMatchObject({ mode: 'firebase', credential: 'adc', projectId: 'estate-83713' })
    expect(r.problems).toEqual([])
  })

  it('yaml 의 선언이 지워져도 Cloud Run 위에서는 firebase', () => {
    expect(resolveAuthMode({ K_SERVICE: 'homefit' })).toMatchObject({
      mode: 'firebase',
      credential: 'adc',
    })
  })

  it('알 수 없는 선언값은 firebase 로 닫고 기록한다', () => {
    const r = resolveAuthMode({ HOMEFIT_AUTH_MODE: 'Firebase' })
    expect(r.mode).toBe('firebase')
    expect(r.problems).toHaveLength(1)
  })

  it('Cloud Run 위의 demo 선언은 무시한다', () => {
    const r = resolveAuthMode({ HOMEFIT_AUTH_MODE: 'demo', K_SERVICE: 'homefit' })
    expect(r.mode).toBe('firebase')
    expect(r.problems).toHaveLength(1)
  })

  it('Cloud Run 이 아니면 demo 선언을 따른다', () => {
    expect(resolveAuthMode({ HOMEFIT_AUTH_MODE: 'demo' }).mode).toBe('demo')
  })

  it('키 3개가 모두 있으면 cert (로컬·Vercel)', () => {
    expect(resolveAuthMode(CERT)).toMatchObject({
      mode: 'firebase',
      credential: 'cert',
      projectId: 'estate-83713',
    })
  })

  it('키가 일부만 있으면 firebase 모드로 닫되 자격증명은 null (→ 503)', () => {
    for (const partial of [
      { FIREBASE_ADMIN_CLIENT_EMAIL: CERT.FIREBASE_ADMIN_CLIENT_EMAIL },
      { FIREBASE_ADMIN_PRIVATE_KEY: CERT.FIREBASE_ADMIN_PRIVATE_KEY },
      {
        FIREBASE_ADMIN_PROJECT_ID: CERT.FIREBASE_ADMIN_PROJECT_ID,
        FIREBASE_ADMIN_CLIENT_EMAIL: CERT.FIREBASE_ADMIN_CLIENT_EMAIL,
      },
    ]) {
      const r = resolveAuthMode(partial)
      expect(r.mode).toBe('firebase')
      expect(r.credential).toBeNull()
      expect(r.problems).toHaveLength(1)
    }
  })

  it('PROJECT_ID 만 있으면 ADC 의 프로젝트 지정으로 본다', () => {
    expect(resolveAuthMode({ FIREBASE_ADMIN_PROJECT_ID: 'p1' })).toMatchObject({
      mode: 'firebase',
      credential: 'adc',
      projectId: 'p1',
    })
  })

  it('App Hosting 에뮬레이터 신호도 firebase', () => {
    expect(resolveAuthMode({ FIREBASE_APP_HOSTING: '1' }).mode).toBe('firebase')
    expect(resolveAuthMode({ FIREBASE_CONFIG: '{"projectId":"p"}' }).mode).toBe('firebase')
  })

  it('빈 문자열·공백은 없는 것으로 본다 (.env.example 복사본)', () => {
    expect(
      resolveAuthMode({
        HOMEFIT_AUTH_MODE: '',
        FIREBASE_ADMIN_PROJECT_ID: '  ',
        FIREBASE_ADMIN_CLIENT_EMAIL: '',
        FIREBASE_ADMIN_PRIVATE_KEY: '',
        K_SERVICE: '',
      }).mode,
    ).toBe('demo')
  })

  it('projectId 우선순위: ADMIN → FIREBASE_CONFIG → GOOGLE_CLOUD_PROJECT → GCLOUD_PROJECT', () => {
    const base = { HOMEFIT_AUTH_MODE: 'firebase' }
    expect(
      resolveAuthMode({
        ...base,
        FIREBASE_ADMIN_PROJECT_ID: 'a',
        FIREBASE_CONFIG: '{"projectId":"b"}',
        GOOGLE_CLOUD_PROJECT: 'c',
        GCLOUD_PROJECT: 'd',
      }).projectId,
    ).toBe('a')
    expect(
      resolveAuthMode({
        ...base,
        FIREBASE_CONFIG: '{"projectId":"b"}',
        GOOGLE_CLOUD_PROJECT: 'c',
      }).projectId,
    ).toBe('b')
    expect(resolveAuthMode({ ...base, GOOGLE_CLOUD_PROJECT: 'c', GCLOUD_PROJECT: 'd' }).projectId).toBe('c')
    expect(resolveAuthMode({ ...base, GCLOUD_PROJECT: 'd' }).projectId).toBe('d')
    expect(resolveAuthMode(base).projectId).toBeUndefined()
  })

  it('어떤 입력에서도 예외를 던지지 않는다', () => {
    for (const env of [
      { FIREBASE_CONFIG: '{not json' },
      { FIREBASE_CONFIG: '/path/to/config.json' },
      { FIREBASE_CONFIG: '{"projectId":42}' },
      { HOMEFIT_AUTH_MODE: '\u0000' },
    ]) {
      expect(() => resolveAuthMode(env)).not.toThrow()
    }
  })
})

describe('projectIdFromFirebaseConfig', () => {
  it('JSON 의 projectId 만 꺼낸다', () => {
    expect(projectIdFromFirebaseConfig('{"projectId":"estate-83713"}')).toBe('estate-83713')
  })
  it('파일 경로 형식·잘못된 JSON·빈 값은 undefined', () => {
    expect(projectIdFromFirebaseConfig('/etc/firebase.json')).toBeUndefined()
    expect(projectIdFromFirebaseConfig('{oops')).toBeUndefined()
    expect(projectIdFromFirebaseConfig('{"projectId":""}')).toBeUndefined()
    expect(projectIdFromFirebaseConfig(undefined)).toBeUndefined()
  })
})

describe('classifyAdminError', () => {
  it('토큰 문제 코드는 token', () => {
    for (const code of [
      'auth/argument-error',
      'auth/invalid-id-token',
      'auth/id-token-expired',
      'auth/id-token-revoked',
      'auth/user-disabled',
      'auth/user-not-found',
      'auth/session-cookie-expired',
      'auth/session-cookie-revoked',
    ]) {
      expect(classifyAdminError({ code })).toBe('token')
    }
  })

  it('설정 문제와 모르는 오류는 config', () => {
    for (const e of [
      { code: 'app/invalid-credential' },
      { code: 'auth/insufficient-permission' },
      { code: 'auth/invalid-credential' },
      { code: 'homefit/admin-config' },
      new Error('Unable to detect a Project Id in the current environment.'),
      'boom',
      null,
      undefined,
    ]) {
      expect(classifyAdminError(e)).toBe('config')
    }
  })
})

describe('adminErrorLabel', () => {
  it('code 가 있으면 code, 없으면 message 를 200자까지', () => {
    expect(adminErrorLabel({ code: 'auth/user-disabled', message: 'x' })).toBe('auth/user-disabled')
    expect(adminErrorLabel(new Error('a'.repeat(500)))).toHaveLength(200)
    expect(adminErrorLabel(null)).toBe('null')
  })
})

describe('classifyAdminError — 공개키 조회 실패', () => {
  it('argument-error 라도 네트워크·공개키 응답 실패면 config', () => {
    expect(
      classifyAdminError({
        code: 'auth/argument-error',
        message: 'Error while making request: connect ECONNREFUSED 142.250.0.1:443',
      }),
    ).toBe('config')
    expect(
      classifyAdminError({ code: 'auth/argument-error', message: 'Error fetching public keys for Google certs: x' }),
    ).toBe('config')
  })

  it('형식·서명 문제의 argument-error 는 그대로 token', () => {
    expect(
      classifyAdminError({ code: 'auth/argument-error', message: 'Decoding Firebase ID token failed.' }),
    ).toBe('token')
    expect(
      classifyAdminError({ code: 'auth/argument-error', message: 'Firebase ID token has invalid signature.' }),
    ).toBe('token')
  })

  it('argument-error 의 로그 식별자에는 메시지 앞부분이 붙는다', () => {
    expect(
      adminErrorLabel({ code: 'auth/argument-error', message: 'Error while making request: x' }),
    ).toBe('auth/argument-error: Error while making request: x')
  })
})
