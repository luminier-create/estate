# HomeFit — 아파트 입지 적합도 스코어링

부동산 앱에서 찾은 아파트가 **나에게** 최적인지 0~100점으로 판정하고 순위를 매기는 서비스.

기존 부동산 앱은 매물 탐색에 최적화되어 있어 개인의 통근지·생활반경이 반영되지 않는다.
HomeFit은 사용자 조건(예산·사무실·자주 가는 장소·가구 구성)을 등록하고
관심 단지를 수동 입력하면, 11개 축의 정량 지표로 적합도를 산출한다.

## 평가 축

| 축 | 가중치 | 내용 |
|---|---|---|
| 사무실 통근 | 20 | 도어투도어 대중교통 소요시간 (30분 최고 / 90분 최저) |
| 가격 대비 시세 | 15 | 반경 1km 동일 면적대 실거래 중앙값 대비 평단가 |
| 지하철 접근성 | 13 | 도보시간 + 사무실·주요 장소 직결성(환승 횟수) |
| 학군 접근성 | 12 | 초·중·고 도보시간 (가구 구성별 하위 가중치 조정) |
| 버스 접근성 | 8 | 정류장 도보 + 직통/환승 여부 |
| 투자 기회 | 8 | 상승 모멘텀·상대 저평가·거래 유동성·공급 희소성 |
| 단지 노후도 | 7 | 준공 연차 U자형 곡선 (30년 재건축 기대 반등 반영) |
| 호재 | 7 | 필지 기준 개발 호재 × 확실성 계수 |
| 대형마트 접근성 | 5 | 도보/차량 접근 |
| 커뮤니티·관리비 | 5 | 시설 구성 + ㎡당 관리비 지역 평균 대비 |
| **리스크 (감점)** | −15 | 층간소음·소음·경사·유흥상권·주차 부족 등 |

## 기술 스택

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui
Firebase Authentication (Google) · Cloud Firestore · Firebase App Hosting

## 설계 문서

| 문서 | 내용 |
|---|---|
| [00-PRD](docs/00-PRD.md) | 제품 요구사항, 사용자 스토리, 화면 정의, 리스크 |
| [01-ALGORITHM](docs/01-ALGORITHM.md) | 축별 정규화 공식, 가중치, 총점 산출식, 검증 계획 |
| [02-ARCHITECTURE](docs/02-ARCHITECTURE.md) | 시스템 구성, 디렉터리, 인증·분석 파이프라인, 캐싱 |
| [03-DATA-SOURCES](docs/03-DATA-SOURCES.md) | 외부 API 스펙, 키 발급 절차, Mock 전략 |
| [04-DATA-MODEL](docs/04-DATA-MODEL.md) | Firestore 스키마, 보안 규칙, 인덱스 |
| [05-ROADMAP](docs/05-ROADMAP.md) | 5단계 개발 계획 및 완료 기준 |

## 시작하기

```bash
npm install
cp .env.example .env.local     # 키 없이도 시드 데이터로 전체 동작
npm run dev
```

외부 API 키는 선택이다. 키가 없으면 Provider가 자동으로 Mock 구현으로 폴백하고,
Firebase 설정이 없으면 랜딩 화면에 "데모 모드로 둘러보기" 버튼이 나타나 전체 흐름을
그대로 시연할 수 있다. `.env.local` 에 키를 넣는 순간 실데이터·실로그인으로 전환된다.
키 발급 절차는 [03-DATA-SOURCES](docs/03-DATA-SOURCES.md) §8 체크리스트를 따른다.

> 데모 모드의 데이터는 서버 프로세스 메모리에만 저장되며 재시작 시 사라진다.
> Firebase Admin 환경변수가 설정되면 이 경로는 자동으로 닫히고 Firestore를 쓴다.

## 명령어

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run typecheck` | TypeScript strict 검사 |
| `npm run lint` | ESLint |
| `npm test` | 스코어링 엔진 단위 테스트 (84건) |
| `npm run test:e2e` | Playwright E2E (로그인→온보딩→등록→분석→비교) |

E2E는 데모 모드로 돌아가므로 API 키가 필요 없다. 브라우저는 Playwright가 설치한 것을
자동으로 찾으며, 다른 위치의 Chromium을 쓰려면 `PLAYWRIGHT_CHROMIUM_PATH` 로 지정한다.
같은 서버에 반복 실행해도 통과하도록 작성되어 있다.

## CI

`.github/workflows/ci.yml` 이 PR마다 두 잡을 돌린다.

- **verify** — 타입 검사 → 린트 → 단위 테스트 → 프로덕션 빌드
- **e2e** — Chromium 설치 후 전 흐름 검증, 실패 시 리포트를 아티팩트로 업로드

외부 API 키나 Firebase 설정 없이 통과한다. Provider가 시드 데이터로 폴백하고
인증은 데모 모드를 쓰기 때문이다.

## 배포 (Firebase App Hosting)

```bash
firebase init apphosting          # 저장소 연결
firebase apphosting:secrets:set KAKAO_REST_API_KEY   # 키마다 반복
firebase deploy --only firestore  # 보안 규칙·인덱스
```

`apphosting.yaml` 이 시크릿 참조와 런타임 설정을 담고 있다. 서버 전용 키는
`availability: [RUNTIME]` 로 지정해 빌드 산출물에 포함되지 않게 했다.

## 설계상의 주요 결정

- **결측 내성** — 외부 API가 하나 실패해도 해당 축만 가중치째 제외하고 나머지를
  재정규화한다. 총점은 항상 0~100이며, 별도의 신뢰도(%)를 함께 표기한다.
- **Provider 추상화** — 스코어링 로직(`lib/scoring`)은 외부 의존이 전혀 없는 순수
  함수다. 데이터 수집은 인터페이스 뒤에 있어 실/모의 구현을 교체할 수 있다.
- **점수는 서버에서만 기록** — Firestore 규칙에서 분석 문서의 클라이언트 쓰기를
  막아 점수 위조를 차단한다.
- **알고리즘 버전 관리** — 스코어링 로직이 바뀌면 `ALGORITHM_VERSION` 이 올라가고
  기존 분석 캐시가 자동 무효화된다.
- **크롤링 배제** — 공식 Open API만 사용한다. 부동산 앱 스크래핑은 하지 않는다.

## 면책

본 서비스가 제공하는 점수와 순위는 공개된 공공데이터를 기반으로 한 참고 정보이며,
특정 부동산의 매수·매도를 권유하거나 투자 수익을 보장하지 않는다.
실제 거래 전 반드시 현장 확인 및 전문가 상담을 거쳐야 한다.
