# 04. 데이터 모델 (Firestore)

문서 버전: v1.0 / 작성일: 2026-09-09

---

## 1. 컬렉션 구조

```
users/{uid}                              사용자 프로필
users/{uid}/properties/{propertyId}      등록 아파트
users/{uid}/analyses/{analysisId}        분석 결과 스냅샷

cache_geo/{addressHash}                  지오코딩 캐시     (서버 전용)
cache_poi/{geohash7_category}            주변시설 캐시     (서버 전용)
cache_route/{routeKey}                   경로 캐시        (서버 전용)
cache_market/{lawdCd_yyyymm}             실거래 캐시      (서버 전용)
quota/{provider_yyyymmdd}                일일 호출 카운터  (서버 전용)
developments/{devId}                     호재 큐레이션 DB  (읽기 전용 공개)
```

---

## 2. `users/{uid}`

```ts
interface UserProfile {
  uid: string
  email: string
  displayName: string
  photoURL: string | null

  // 온보딩 정보
  budget: {
    targetAmount: number        // 목표 매입 금액 (만원)
    maxAmount: number | null    // 최대 감당 금액 (만원)
  }
  office: {
    label: string               // "본사"
    address: string
    lat: number
    lng: number
    commuteMode: 'TRANSIT' | 'CAR'
    targetMinutes: number       // 목표 통근시간, 기본 30
  } | null
  frequentPlaces: {
    id: string
    label: string               // "강남역"
    address: string
    lat: number
    lng: number
    importance: 1 | 2 | 3       // 1=보통 2=중요 3=매우중요
  }[]
  household: {
    type: 'SINGLE' | 'COUPLE' | 'WITH_PRESCHOOL' | 'WITH_ELEMENTARY'
        | 'WITH_SECONDARY' | 'NO_CHILDREN'
    members: number
  }
  weights: {
    presetId: 'balanced' | 'commute' | 'school' | 'investment' | 'custom'
    custom?: Record<AxisCode, number>   // 합 100
  }

  onboardingCompleted: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**profileHash**: 분석 캐시 무효화용. `budget + office + frequentPlaces + household`
를 정규화 직렬화 후 SHA-256 앞 12자. 프로필이 바뀌면 자동으로 재분석된다.

---

## 3. `users/{uid}/properties/{propertyId}`

```ts
interface Property {
  id: string
  name: string                  // "래미안 도곡 카운티"
  address: string               // 도로명 또는 지번
  lat: number
  lng: number
  legalCode: string             // 법정동코드 10자리
  lawdCd: string                // 앞 5자리 (실거래 조회용)

  area: {
    exclusiveM2: number         // 전용면적 ㎡ (정규 저장 단위)
    inputUnit: 'PYEONG' | 'M2'  // 사용자가 입력한 단위
    supplyM2: number | null     // 공급면적 (선택)
  }
  price: {
    amount: number              // 매입 희망/호가 금액 (만원)
    type: 'ASKING' | 'TARGET'   // 호가 / 내가 쓰려는 금액
  }

  // 선택 입력 (자동수집 실패 시 폴백)
  manual: {
    buildYear: number | null
    totalHouseholds: number | null
    parkingPerHousehold: number | null
    monthlyFeePerM2: number | null      // 원/㎡
    communityFacilities: string[]       // ['POOL','GYM',...]
    structureType: 'WALL' | 'RAHMEN' | null
  }

  // 사용자가 직접 체크한 리스크
  userRisks: string[]           // ['NOISE_FLOOR','SLOPE',...]

  // 사용자 메모/호재
  developments: {
    title: string
    type: DevelopmentType
    stage: 'CONFIRMED'|'APPROVED'|'PLANNED'|'PROPOSED'|'RUMOR'
    sourceUrl: string | null
    note: string | null
  }[]

  memo: string | null
  status: 'ACTIVE' | 'ARCHIVED'
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**설계 결정**: 면적은 **전용면적 ㎡ 단일 정규 단위**로 저장한다.
평 입력은 저장 시점에 환산하고, 표시 시점에 사용자 선호 단위로 역환산한다.
두 단위를 모두 저장하면 반올림 오차로 불일치가 발생한다.

---

## 4. `users/{uid}/analyses/{analysisId}`

`analysisId = {propertyId}_{profileHash}_{presetId}` (결정적 ID → upsert)

```ts
interface Analysis {
  id: string
  propertyId: string
  profileHash: string
  presetId: string

  totalScore: number            // 0~100
  grade: 'S'|'A'|'B'|'C'|'D'|'E'
  baseScore: number
  riskPenalty: number
  confidence: number            // 0~1

  axes: AxisResult[]            // 01-ALGORITHM.md §7 스키마
  risks: RiskItem[]

  computedAt: Timestamp
  expiresAt: Timestamp          // computedAt + 7일
  version: string               // 알고리즘 버전 'v1.0' — 로직 변경 시 무효화
}
```

**version 필드의 목적**: 스코어링 로직을 고치면 기존 캐시가 낡은 결과가 된다.
`ALGORITHM_VERSION` 상수와 불일치하면 캐시를 무시하고 재계산한다.

---

## 5. 캐시 컬렉션

```ts
interface CacheDoc<T> {
  key: string
  value: T
  provider: string
  createdAt: Timestamp
  expiresAt: Timestamp | null   // null = 무기한
  hits: number                  // 비용 절감 효과 측정용
}
```

Firestore TTL 정책을 `expiresAt` 필드에 설정하여 만료 문서를 자동 삭제한다.

---

## 6. `developments/{devId}` — 호재 큐레이션

```ts
interface DevelopmentRecord {
  id: string
  title: string                 // "GTX-C 노선 왕십리역 신설"
  type: DevelopmentType
  stage: DevelopmentStage
  center: { lat: number; lng: number }
  radiusM: number               // 영향 반경
  sourceUrl: string
  sourceName: string            // "국토교통부 보도자료"
  announcedAt: string           // YYYY-MM-DD
  expectedAt: string | null     // 준공/개통 예정
  verified: boolean
}
```

MVP는 시드 데이터 30~50건(수도권 주요 호재)을 번들하고, 이후 관리자 화면에서 편집한다.
**사용자 입력 호재는 `properties.developments` 에만 저장**하고 공용 DB를 오염시키지 않는다.

---

## 7. Firestore 보안 규칙

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isOwner(uid) {
      return request.auth != null && request.auth.uid == uid;
    }

    match /users/{uid} {
      allow read: if isOwner(uid);
      allow write: if false;            // 쓰기는 전부 서버(Admin SDK)

      match /properties/{propertyId} {
        allow read: if isOwner(uid);
        allow write: if false;
      }
      match /analyses/{analysisId} {
        allow read: if isOwner(uid);
        allow write: if false;          // 서버(Admin SDK)만 기록
      }
    }

    match /developments/{devId} {
      allow read: if request.auth != null;
      allow write: if false;
    }

    // 캐시·쿼터는 클라이언트 접근 전면 차단
    match /cache_geo/{doc}    { allow read, write: if false; }
    match /cache_poi/{doc}    { allow read, write: if false; }
    match /cache_route/{doc}  { allow read, write: if false; }
    match /cache_market/{doc} { allow read, write: if false; }
    match /quota/{doc}        { allow read, write: if false; }

    // 명시되지 않은 경로는 모두 거부
    match /{document=**} { allow read, write: if false; }
  }
}
```

### 왜 소유자에게도 쓰기를 주지 않는가

브라우저 코드는 Firebase Auth 만 쓰고 Firestore 에는 직접 접근하지 않는다.
모든 저장은 서버 액션이 Zod 로 검증한 뒤 Admin SDK 로 수행하며,
Admin SDK 는 이 규칙을 우회하므로 앱 동작에는 영향이 없다.

소유자 쓰기를 열어두면 그 검증 전체가 우회 가능한 경계 밖에 놓인다.
클라이언트 설정(`NEXT_PUBLIC_FIREBASE_*`)은 공개되어 있고 사용자는 ID 토큰을
갖고 있으므로 브라우저 SDK 로 자기 문서를 직접 쓸 수 있기 때문이다. 자기
데이터라 타인 침해는 아니지만, `frequentPlaces` 를 수천 개로 써넣어 외부 API
호출을 폭증시키거나(무료 티어 소진), 면적·enum 코드를 손상시켜 스코어링을
깨뜨리는 것이 가능했다. "점수는 서버에서만 산출한다"는 원칙은 입력 문서가
무검증으로 열려 있으면 성립하지 않는다.

---

## 8. 인덱스

```json
{
  "indexes": [
    {
      "collectionGroup": "properties",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "analyses",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "propertyId", "order": "ASCENDING" },
        { "fieldPath": "computedAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

---

## 9. 마이그레이션 원칙

- 문서에 `schemaVersion` 을 두지 않는다. 대신 **모든 신규 필드는 optional** 로 추가하고
  읽기 시점에 기본값을 채운다(`lib/repo/*` 의 매퍼 함수가 담당).
- 파괴적 변경이 필요하면 새 필드를 병행 기입한 뒤 배치로 이전한다.
