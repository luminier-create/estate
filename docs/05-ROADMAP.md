# 05. 개발 로드맵

문서 버전: v1.0 / 작성일: 2026-09-09

---

## Phase 1 — 기반 구축

| # | 작업 | 산출물 |
|---|---|---|
| 1.1 | Next.js 15 + TS strict + Tailwind v4 스캐폴딩 | `package.json`, `tsconfig.json` |
| 1.2 | shadcn/ui 프리미티브 + 디자인 토큰(라이트/다크) | `components/ui/` |
| 1.3 | Firebase 클라이언트/Admin SDK 초기화 | `lib/firebase/` |
| 1.4 | 구글 로그인 + 세션 쿠키 + 라우트 가드 | `/api/auth/session`, `(app)/layout.tsx` |
| 1.5 | Firestore 규칙·인덱스 + repo 계층 | `firestore.rules`, `lib/repo/` |
| 1.6 | 앱셸 (모바일 하단탭 / 데스크톱 사이드바) | `components/layout/` |

**완료 기준**: 구글 로그인 후 `/dashboard` 진입, 새로고침해도 세션 유지, 모바일/데스크톱 레이아웃 전환 정상.

---

## Phase 2 — 스코어링 엔진 (외부 API 없이 완결)

| # | 작업 | 산출물 |
|---|---|---|
| 2.1 | 타입·상수·정규화 유틸 | `lib/scoring/normalize.ts`, `types.ts` |
| 2.2 | 11개 축 구현 | `lib/scoring/axes/*.ts` |
| 2.3 | 가중치 프리셋 + 집계·등급·신뢰도 | `presets.ts`, `aggregate.ts` |
| 2.4 | Provider 인터페이스 + Mock 구현 | `lib/providers/mock/` |
| 2.5 | 단위 테스트 (경계값 + 골든 케이스 10단지) | `tests/unit/scoring/` |

**완료 기준**: `npm test` 전량 통과. Mock 데이터만으로 총점·등급·근거 문자열 산출.
**이 단계에서 알고리즘이 완성된다.** 이후 단계는 데이터 소스 교체일 뿐이다.

---

## Phase 3 — 화면 구현

| # | 작업 | 산출물 |
|---|---|---|
| 3.1 | 랜딩 + 구글 로그인 | `app/page.tsx` |
| 3.2 | 온보딩 3스텝 (예산 → 사무실 → 자주 가는 장소) | `onboarding/` |
| 3.3 | 단지 등록 폼 (주소검색·평/㎡ 토글·금액) | `properties/new/` |
| 3.4 | 대시보드 순위 카드 리스트 | `dashboard/` |
| 3.5 | 단지 상세 (게이지·레이더·11축 근거 아코디언·지도) | `properties/[id]/` |
| 3.6 | 비교 화면 (축별 표 + 가중치 슬라이더 실시간 재계산) | `compare/` |
| 3.7 | 설정 (프로필·프리셋·단위 선호·계정) | `settings/` |
| 3.8 | PWA 매니페스트 + 오프라인 셸 | `manifest.json`, `sw` |

**완료 기준**: Mock 데이터로 전 화면 동작. 360px~1920px 레이아웃 무결.

---

## Phase 4 — 실데이터 연동

| # | 작업 | 산출물 |
|---|---|---|
| 4.1 | 카카오 로컬 Provider (지오코딩·POI) | `lib/providers/kakao/` |
| 4.2 | 국토부 실거래가 Provider (XML 파싱·해제건 제외) | `lib/providers/molit/` |
| 4.3 | ODsay Provider (경로·환승) | `lib/providers/odsay/` |
| 4.4 | 공동주택 관리정보 Provider | `lib/providers/aptmgmt/` |
| 4.5 | Firestore TTL 캐시 + 일일 쿼터 가드 | `lib/cache.ts` |
| 4.6 | 법정동코드 번들 + 좌표→LAWD_CD 변환 | `lib/legal-code.ts` |
| 4.7 | 분석 파이프라인 `/api/analyze` (부분실패 내성) | `app/api/analyze/` |
| 4.8 | 호재 시드 DB 30~50건 | `developments` 시드 |

**완료 기준**: 실제 키 투입 시 실데이터 점수 산출. 특정 Provider 장애 시 해당 축만 결측 처리되고 앱은 정상 동작.

---

## Phase 5 — 품질·확장

| # | 작업 |
|---|---|
| 5.1 | E2E 테스트 (로그인→온보딩→등록→분석→비교) |
| 5.2 | 접근성 감사 (스크린리더·대비·키보드) |
| 5.3 | 성능 최적화 (RSC 스트리밍·이미지·번들 분석) |
| 5.4 | 나이스 학교정보 연동 (학교급 정확도) |
| 5.5 | 호재 자동 수집 (국토부·지자체 고시 RSS) |
| 5.6 | 전세/월세, 오피스텔 확장 |
| 5.7 | 배우자 공유 검토 (읽기 전용 링크) |

---

## 의존 관계

```
Phase 1 ─┬─> Phase 2 ─┬─> Phase 3 ──> Phase 5
         │            │
         └────────────┴─> Phase 4 ──> Phase 5

Phase 2와 3은 Provider 인터페이스를 경계로 병렬 가능.
Phase 4는 Phase 2의 인터페이스 확정 후 착수.
```

---

## 정의된 완료 기준 (Definition of Done)

전 단계 공통:
- TypeScript strict 통과, `any` 미사용 (외부 API 응답 파싱부 제외, 즉시 타입 좁힘)
- ESLint 무경고
- 신규 로직에 단위 테스트 동반
- 모바일 360px에서 가로 스크롤 없음
- 사용자 노출 문자열은 한국어, 숫자는 천단위 구분·단위 병기
