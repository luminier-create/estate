# 02. 아키텍처 설계서

문서 버전: v1.0 / 작성일: 2026-09-09

---

## 1. 기술 스택 확정

| 레이어 | 선택 | 사유 |
|---|---|---|
| 프레임워크 | Next.js 15 (App Router) + React 19 | 서버컴포넌트로 API 키 은닉, 단일 코드베이스 반응형 |
| 언어 | TypeScript (strict) | 스코어링 로직의 타입 안전성이 핵심 |
| 스타일 | Tailwind CSS v4 + shadcn/ui | 반응형 유틸리티, 접근성 확보된 프리미티브 |
| 인증 | Firebase Authentication (Google Provider) | 요구사항 직결. 세션은 ID 토큰 → 서버 쿠키 |
| DB | Cloud Firestore | 사용자별 문서 격리 + 보안규칙, 무료 티어 |
| 서버 로직 | Next.js Route Handlers + Server Actions | 별도 백엔드 불필요 |
| 배포 | Firebase App Hosting | Next.js SSR 지원, GitHub 연동 자동배포 |
| 차트 | Recharts | 레이더/바 차트, SSR 호환 |
| 지도 | Kakao Maps JS SDK | 국내 좌표·POI 정확도 |
| 상태 | TanStack Query + Zustand | 서버 캐시 / 클라이언트 UI 상태 분리 |
| 테스트 | Vitest + Testing Library + Playwright | 스코어링 단위테스트 필수 |
| PWA | next-pwa (Workbox) | 모바일 홈화면 설치 |

---

## 2. 시스템 구성도

```
┌────────────────────────────────────────────────────────────┐
│                        클라이언트                            │
│   모바일 웹 / PWA / 데스크톱 웹  (동일 Next.js 앱)             │
└───────────────┬────────────────────────────────────────────┘
                │ HTTPS
┌───────────────▼────────────────────────────────────────────┐
│              Next.js 15 (Firebase App Hosting)              │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ RSC 페이지   │  │ Server       │  │ Route Handlers    │  │
│  │ (읽기 전용)  │  │ Actions      │  │ /api/analyze      │  │
│  │             │  │ (쓰기)        │  │ /api/geocode      │  │
│  └─────────────┘  └──────────────┘  └─────────┬─────────┘  │
│                                                │            │
│  ┌─────────────────────────────────────────────▼─────────┐ │
│  │            lib/scoring  (순수 함수, 외부 의존 0)         │ │
│  │  normalize.ts · axes/*.ts · aggregate.ts · presets.ts   │ │
│  └─────────────────────────────────────────────▲─────────┘ │
│                                                │            │
│  ┌─────────────────────────────────────────────┴─────────┐ │
│  │        lib/providers  (외부 API 어댑터 + 캐시)          │ │
│  │  kakao · molit · odsay · school · apt-mgmt  (인터페이스) │ │
│  │  ├── real  구현                                         │ │
│  │  └── mock  구현  (키 없을 때 자동 폴백)                   │ │
│  └────────────────────┬───────────────────────────────────┘ │
└───────────────────────┼─────────────────────────────────────┘
                        │ 서버에서만 호출 (API 키 노출 없음)
        ┌───────────────┼───────────────┬──────────────┐
        ▼               ▼               ▼              ▼
   카카오 로컬      국토부 실거래가      ODsay       공동주택관리
   (지오코딩/POI)   (시세/건축년도)   (대중교통경로)   (관리비/세대)

        ┌──────────────────────────────────────┐
        │   Cloud Firestore                    │
        │   users / properties / analyses      │
        │   cache_geo / cache_market           │
        └──────────────────────────────────────┘
```

---

## 3. 디렉터리 구조

```
estate/
├── docs/                        # 설계 문서 (본 폴더)
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                     # 랜딩 + 구글 로그인
│   │   ├── (auth)/
│   │   │   └── onboarding/page.tsx
│   │   ├── (app)/                       # 인증 필요 그룹
│   │   │   ├── layout.tsx               # 세션 가드 + 앱셸
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── properties/
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── compare/page.tsx
│   │   │   └── settings/page.tsx
│   │   └── api/
│   │       ├── auth/session/route.ts    # ID토큰 → 세션쿠키
│   │       ├── analyze/route.ts         # 단지 분석 실행
│   │       ├── places/search/route.ts    # 주소·장소 검색 프록시
│   │       └── health/route.ts
│   ├── components/
│   │   ├── ui/                          # shadcn 프리미티브
│   │   ├── score/                       # ScoreGauge, AxisRadar, AxisCard
│   │   ├── property/                    # PropertyCard, PropertyForm
│   │   ├── map/                         # KakaoMap, PlacePicker
│   │   └── layout/                      # AppShell, BottomNav, TopBar
│   ├── lib/
│   │   ├── scoring/
│   │   │   ├── types.ts
│   │   │   ├── normalize.ts             # piecewise, walkMinutes, 면적환산
│   │   │   ├── presets.ts               # 가중치 프리셋
│   │   │   ├── aggregate.ts             # 총점·등급·신뢰도
│   │   │   └── axes/
│   │   │       ├── commute.ts  value.ts  subway.ts  bus.ts
│   │   │       ├── school.ts   retail.ts amenity.ts age.ts
│   │   │       └── development.ts  investment.ts  risk.ts
│   │   ├── providers/
│   │   │   ├── types.ts                 # Provider 인터페이스 정의
│   │   │   ├── index.ts                 # real/mock 스위칭
│   │   │   ├── kakao/    molit/    odsay/    school/    aptmgmt/
│   │   │   └── mock/                    # 시드 데이터
│   │   ├── firebase/
│   │   │   ├── client.ts                # 클라이언트 SDK
│   │   │   ├── admin.ts                 # Admin SDK (서버 전용)
│   │   │   └── session.ts               # 세션 쿠키 검증
│   │   ├── repo/                        # Firestore 접근 계층
│   │   │   ├── users.ts  properties.ts  analyses.ts  cache.ts
│   │   ├── cache.ts                     # Firestore 기반 TTL 캐시
│   │   ├── legal-code.ts                # 법정동 코드 매핑
│   │   └── utils.ts
│   ├── hooks/
│   └── types/
├── tests/
│   ├── unit/scoring/                    # 정규화·축별 단위테스트
│   ├── fixtures/golden/                 # 골든 케이스 10단지
│   └── e2e/                             # Playwright
├── firestore.rules
├── firestore.indexes.json
├── apphosting.yaml
└── .env.example
```

---

## 4. 인증 흐름

```
1. 클라이언트: signInWithPopup(GoogleAuthProvider)   [모바일은 redirect 폴백]
2. 클라이언트: user.getIdToken() → POST /api/auth/session
3. 서버: admin.auth().createSessionCookie(idToken, {expiresIn: 14d})
4. 서버: Set-Cookie __session (httpOnly, secure, sameSite=lax)
5. 이후 RSC/서버액션: cookies().get('__session') → verifySessionCookie()
6. 로그아웃: DELETE /api/auth/session → 쿠키 삭제 + signOut()
```

**설계 근거**: 클라이언트 SDK 토큰만 쓰면 RSC에서 사용자를 알 수 없어
모든 페이지가 클라이언트 컴포넌트가 된다. 세션 쿠키 방식으로 서버 렌더 시점에
사용자 데이터를 직접 조회한다.

---

## 5. 분석 파이프라인

```
POST /api/analyze  { propertyId, presetId? }
  │
  ├─ 1. 세션 검증 → uid
  ├─ 2. Firestore: property + user profile 로드
  ├─ 3. 캐시 조회: analyses/{propertyId}_{profileHash}_{presetId}
  │      hit && TTL 유효(7일) → 즉시 반환
  ├─ 4. Provider 병렬 호출 (Promise.allSettled)
  │      ├─ geocode(단지주소)             → 좌표, 법정동코드
  │      ├─ nearbyPOI(좌표)               → 지하철·정류장·학교·마트
  │      ├─ transitRoute(단지→사무실)      → 소요시간·환승
  │      ├─ transitRoute(단지→자주가는곳*)  → N건
  │      ├─ marketPrices(법정동, 면적)     → 실거래 리스트
  │      └─ aptInfo(단지)                 → 건축년도·세대수·관리비
  ├─ 5. rejected 항목은 해당 축 결측 처리 (전체 실패 아님)
  ├─ 6. lib/scoring 순수 함수로 축별 점수 산출
  ├─ 7. aggregate() → 총점·등급·신뢰도
  └─ 8. Firestore 저장 후 반환
```

**타임아웃 정책**: 개별 Provider 6초, 전체 12초. 초과 시 결측 처리.
**동시성**: 사용자당 동시 분석 1건으로 제한(중복 클릭 방지, Firestore 트랜잭션 락).

---

## 6. Provider 추상화 (Mock/Real 스위칭)

```ts
// lib/providers/types.ts
export interface GeoProvider {
  geocode(address: string): Promise<GeoPoint & { legalCode: string }>
  searchPlaces(query: string, near?: GeoPoint): Promise<Place[]>
  nearbyByCategory(c: CategoryCode, at: GeoPoint, radius: number): Promise<Place[]>
}
export interface TransitProvider {
  route(from: GeoPoint, to: GeoPoint, mode: 'ALL'|'BUS'|'SUBWAY'): Promise<TransitRoute>
}
export interface MarketProvider {
  trades(legalCode: string, yyyymm: string): Promise<Trade[]>
}
```

`lib/providers/index.ts` 가 환경변수 유무로 real/mock 을 선택한다.

```ts
export const geo: GeoProvider = process.env.KAKAO_REST_API_KEY
  ? new KakaoGeoProvider() : new MockGeoProvider()
```

→ **키 없이도 앱 전체가 동작**하고, `.env` 에 키를 넣는 순간 실데이터로 전환된다.
개발·테스트·데모가 외부 API 쿼터에 묶이지 않는다.

---

## 7. 캐싱 전략

| 대상 | 저장소 | 키 | TTL | 사유 |
|---|---|---|---|---|
| 지오코딩 결과 | `cache_geo` | 주소 정규화 문자열 | 무기한 | 주소→좌표는 불변 |
| 주변 POI | `cache_poi` | `geohash7:category` | 90일 | 시설 변동 느림 |
| 대중교통 경로 | `cache_route` | `from8:to8:mode` | 30일 | 노선 개편 주기 |
| 실거래가 | `cache_market` | `법정동:YYYYMM` | 당월 1일 / 과거월 무기한 | 과거 데이터 불변 |
| 분석 결과 | `analyses` | `prop:profileHash:preset` | 7일 | 프로필 변경 시 무효화 |

**쿼터 보호**: 일일 호출 카운터를 `quota/{provider}_{YYYYMMDD}` 에 기록하고
상한 도달 시 해당 축을 결측 처리한 뒤 사용자에게 "일일 조회 한도 도달" 안내.

---

## 8. 반응형 설계

| 브레이크포인트 | 폭 | 레이아웃 |
|---|---|---|
| 모바일 | < 640px | 단일 컬럼, 하단 탭바(4탭), 시트형 모달, 카드 스택 |
| 태블릿 | 640~1024px | 2컬럼 그리드, 상단 탭 |
| 데스크톱 | > 1024px | 사이드바 + 메인, 비교표 전체 노출, 지도 분할뷰 |

- **모바일 우선 작성**: 기본 클래스는 모바일, `md:` `lg:` 로 확장
- 터치 타깃 최소 44×44px
- 지도는 모바일에서 접이식(기본 접힘)으로 초기 로드 부담 축소
- 레이더 차트는 모바일에서 축 라벨 축약(`통근` `시세` `지하철`…)

---

## 9. 보안

- **API 키는 전량 서버 전용 환경변수.** `NEXT_PUBLIC_` 접두어는 Firebase 웹 config와
  카카오 JS SDK 도메인 제한 키에만 사용
- Firestore 규칙: `users/{uid}` 및 하위 문서는 `request.auth.uid == uid` 인 경우만 R/W
- 캐시 컬렉션은 클라이언트 직접 접근 전면 차단 (Admin SDK 전용)
- 서버 액션 입력은 Zod 스키마 검증
- 카카오 JS SDK 키는 플랫폼 도메인 등록으로 제한

---

## 10. 환경 변수

```bash
# Firebase 웹 (공개)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (서버 전용)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# 지도 JS SDK (도메인 제한 필수)
NEXT_PUBLIC_KAKAO_JS_KEY=

# 외부 API (서버 전용) — 없으면 자동으로 mock 동작
KAKAO_REST_API_KEY=
MOLIT_SERVICE_KEY=
ODSAY_API_KEY=
SCHOOL_API_KEY=
APT_MGMT_API_KEY=
```
