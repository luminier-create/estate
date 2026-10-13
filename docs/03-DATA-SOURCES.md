# 03. 데이터 소스 및 API 키 발급 가이드

문서 버전: v1.0 / 작성일: 2026-09-09
확신도 라벨: [확인됨] 공식 문서 확인 / [구버전-검증필요] 변동 가능

---

## 1. 소스 요약

| # | 소스 | 제공 데이터 | 사용 축 | 비용 | 환경변수 |
|---|---|---|---|---|---|
| 1 | 카카오 로컬 REST API | 주소→좌표, 키워드/카테고리 장소검색 | SUBWAY, BUS, SCHOOL, RETAIL, RISK | 무료 | `KAKAO_REST_API_KEY` |
| 2 | 카카오 지도 JS SDK | 지도 렌더링, 장소 선택 | UI | 무료 | `NEXT_PUBLIC_KAKAO_JS_KEY` |
| 3 | 국토부 아파트 매매 실거래가 상세 | 거래가·전용면적·층·건축년도 | VALUE, AGE, INVESTMENT | 무료 | `MOLIT_SERVICE_KEY` |
| 4 | ODsay 대중교통 | 도어투도어 경로·소요시간·환승 | COMMUTE, SUBWAY, BUS | 무료 티어 | `ODSAY_API_KEY` |
| 5 | 학교기본정보 (교육부/나이스) | 학교 위치·종류·학급수 | SCHOOL | 무료 | `SCHOOL_API_KEY` |
| 6 | 공동주택 관리비/기본정보 (K-apt) | 세대수·관리비·주차대수 | AMENITY, RISK | 무료 | `APT_MGMT_API_KEY` |
| 7 | 한국부동산원 R-ONE | 지역 시장 지표 시계열 | (점수 미반영 — `/market` 조회 화면) | 무료 | `REB_API_KEY` |

---

## 2. 카카오 로컬 REST API [확인됨]

- 콘솔: https://developers.kakao.com → 내 애플리케이션 → 앱 생성
- 필요한 키: **REST API 키** (서버 전용), **JavaScript 키** (지도용, 플랫폼 도메인 등록 필수)
- 인증 헤더: `Authorization: KakaoAK {REST_API_KEY}`

### 2.1 사용 엔드포인트

| 용도 | 엔드포인트 |
|---|---|
| 주소 → 좌표 | `GET https://dapi.kakao.com/v2/local/search/address.json?query={주소}` |
| 키워드 장소 검색 | `GET https://dapi.kakao.com/v2/local/search/keyword.json?query={키워드}` |
| 카테고리 장소 검색 | `GET https://dapi.kakao.com/v2/local/search/category.json?category_group_code={CODE}&x={lng}&y={lat}&radius={m}&sort=distance` |
| 좌표 → 행정구역 | `GET https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x={lng}&y={lat}` |

주의: 좌표 파라미터는 **x=경도(lng), y=위도(lat)** 순서다. WGS84 기준.
`radius` 최대 20,000m. 응답 `documents[].distance` 는 **직선거리(m)**.

### 2.2 사용 카테고리 그룹 코드 [확인됨]

| 코드 | 의미 | 사용처 |
|---|---|---|
| `SW8` | 지하철역 | SUBWAY |
| `MT1` | 대형마트 | RETAIL |
| `SC4` | 학교 | SCHOOL |
| `PS3` | 어린이집·유치원 | SCHOOL(미취학) |
| `HP8` | 병원 | 참고 |
| `PK6` | 주차장 | 참고 |
| `CS2` | 편의점 | 참고 |
| `PM9` | 약국 | 참고 |
| `CT1` | 문화시설 | 참고 |
| `AT4` | 관광명소 | 참고 |

주: **버스정류장 카테고리 코드는 존재하지 않는다.** 정류장은 ODsay 또는
국가대중교통정보센터(TAGO) 정류소 API로 조회한다. (아래 4장)

주: **유흥주점 카테고리 코드도 없다.** RISK 축의 유흥상권 판정은
키워드 검색(`유흥주점`, `단란주점`, `클럽`) 결과 밀도로 근사한다.

### 2.3 카테고리 코드 상수화

```ts
// lib/providers/kakao/categories.ts
export const KAKAO_CATEGORY = {
  SUBWAY: 'SW8', MART: 'MT1', SCHOOL: 'SC4', KINDERGARTEN: 'PS3',
  HOSPITAL: 'HP8', PARKING: 'PK6', CONVENIENCE: 'CS2',
} as const
```

---

## 3. 국토교통부 실거래가 API [확인됨]

- 포털: https://www.data.go.kr/data/15126468/openapi.do (아파트 매매 실거래가 **상세** 자료)
- 일반 자료: https://www.data.go.kr/data/15126469/openapi.do
- 엔드포인트: `https://apis.data.go.kr/1613000/<서비스명>/get<서비스명>`
  - 일반 자료: `RTMSDataSvcAptTrade` ← **기본값** (`DEFAULT_SERVICE_NAME`)
  - 상세 자료: `RTMSDataSvcAptTradeDev` (`MOLIT_SERVICE_NAME` 로 전환)

> **인증키는 활용신청한 서비스 단위로만 유효하다.** 일반 자료로 발급받은 키로
> 상세 자료를 부르면 `SERVICE_ACCESS_DENIED_ERROR`(코드 20) 가 난다. 어느 쪽이
> 유효한지는 `npm run probe:molit` 이 두 서비스를 모두 찔러보고 알려준다.
- 트래픽: 개발계정 **일 10,000회**. 운영계정은 활용사례 등록 후 증량 신청 [확인됨]
- 활용 신청 즉시 승인(자동승인 데이터셋)

### 3.1 요청 파라미터

| 파라미터 | 설명 | 예시 |
|---|---|---|
| `serviceKey` | 인증키 (URL 인코딩 주의) | — |
| `LAWD_CD` | 법정동코드 **앞 5자리** | `11680` (강남구) |
| `DEAL_YMD` | 계약년월 6자리 | `202608` |
| `pageNo` / `numOfRows` | 페이징 | `1` / `1000` |

### 3.2 응답 주요 필드 (상세 자료 기준) [상세=확인됨 / 일반=미확인]

```
aptNm         단지명
excluUseAr    전용면적(㎡)
dealAmount    거래금액(만원, 콤마 포함 문자열 → 파싱 필요)
dealYear/Month/Day  계약일
floor         층
buildYear     건축년도          ← AGE 축 소스
umdNm         법정동명
jibun         지번
aptDong       동
cdealType     해제여부 (해제된 거래는 제외 필요)
```

**구현 주의**:
- `dealAmount` 는 `" 123,000"` 형태 → `trim().replace(/,/g,'')` 후 Number
- `cdealType === 'O'` (해제) 건은 시세 계산에서 **반드시 제외**
- 응답은 XML 기본. `_type=json` 미지원 데이터셋이 있어 XML 파서 준비 필요
- serviceKey 는 포털이 Encoding/Decoding 두 형태로 보여준다. 인코딩 키를 다시
  인코딩하면 `%252F` 가 되고, 디코딩 키를 그대로 붙이면 `+` 가 공백이 되어
  양쪽 다 인증이 깨진다. `normalizeServiceKey()` 가 `%` 유무로 판별해 한 번만
  인코딩된 형태로 맞추므로 **어느 쪽을 넣어도 동작한다**
  (base64 문자집합에 `%` 가 없어 판별이 모호하지 않다)
- 실거래 신고 기한이 계약일로부터 30일이므로 **당월 데이터는 불완전**하다.
  시세 산출 윈도우는 `직전월 ~ 6개월 전` 으로 잡는다

**일반 자료의 응답 필드는 아직 실응답으로 확인하지 못했다** [미확인]. 파서가
기대하는 필드는 `EXPECTED_FIELDS`, 없어도 동작하는 필드는 `OPTIONAL_FIELDS`
(`src/lib/providers/molit/parse.ts`) 에 명시했고, `npm run probe:molit` 이 실응답과
대조해 누락을 짚는다. 특히 `cdealType` 이 일반 자료에 없으면 **계약 해제 건을
걸러낼 수 없어 시세가 왜곡되므로**, 없다고 확인되면 상세 자료로 전환해야 한다.

### 3.3 법정동 코드

행정표준코드관리시스템(https://www.code.go.kr) 의 법정동코드 전체자료를 내려받아
`data/legal-codes.json` 으로 번들한다. (약 5MB → 시·군·구 5자리 단위로 축약 시 300KB)
카카오 `coord2regioncode` 응답의 `code` 필드가 법정동코드 10자리이므로
앞 5자리를 잘라 `LAWD_CD` 로 사용한다. **외부 조회 없이 변환 가능.**

---

## 4. ODsay 대중교통 API [확인됨 / 쿼터는 구버전-검증필요]

- 콘솔: https://lab.odsay.com → 회원가입 → API 키 발급
- 무료/유료 구분은 **호출 수 기준**이며, 무료는 기본 통계와 한국어 지원 제공 [확인됨]
- 구체적 일일 호출 상한은 발급 후 콘솔에서 확인 필요 [구버전-검증필요]
- 대량 경로탐색은 별도 문의 대상이므로, **본 서비스는 단지당 1회 호출 + 30일 캐시** 로 설계

### 4.1 사용 엔드포인트

| 용도 | 엔드포인트 |
|---|---|
| 대중교통 경로 | `GET https://api.odsay.com/v1/api/searchPubTransPathT` |
| 정류장 주변 검색 | `GET https://api.odsay.com/v1/api/pointSearch` |
| 버스노선 상세 | `GET https://api.odsay.com/v1/api/busLaneDetail` |

### 4.2 `searchPubTransPathT` 파라미터

| 파라미터 | 설명 |
|---|---|
| `apiKey` | 발급 키 (URL 인코딩 필요) |
| `SX`, `SY` | 출발 경도, 위도 |
| `EX`, `EY` | 도착 경도, 위도 |
| `SearchPathType` | `0`=전체, `1`=지하철, `2`=버스 |

### 4.3 응답 활용 필드

```
result.path[].info.totalTime        총 소요시간(분)      ← COMMUTE
result.path[].info.busTransitCount  버스 환승 횟수       ← BUS
result.path[].info.subwayTransitCount 지하철 환승 횟수   ← SUBWAY
result.path[].info.totalWalk        총 도보거리(m)
result.path[].subPath[]             구간별 상세(노선명 등)
result.path[].pathType              1=지하철, 2=버스, 3=복합
```

환승 총 횟수 = `busTransitCount + subwayTransitCount - 1` (최소 0으로 clamp).

### 4.4 정류장 조회 대안

ODsay `pointSearch` 로 반경 내 정류장을 얻는다.
불가 시 국가대중교통정보센터(TAGO) 정류소정보 API로 대체:
`http://apis.data.go.kr/1613000/BusSttnInfoInqireService/getCrdntPrxmtSttnList`

---

## 5. 학교 정보 API

두 가지 경로 중 택일 (구현은 인터페이스 뒤에 숨김).

**(a) 카카오 카테고리 `SC4`** — 좌표 기반 근접 검색이 즉시 가능하나
학교급(초/중/고) 구분이 `category_name` 문자열 파싱에 의존한다.
`"교육,학문 > 학교 > 초등학교"` 형태이므로 정규식으로 분류 가능. **MVP 채택.**

**(b) 나이스 교육정보 개방 포털** (https://open.neis.go.kr)
학교기본정보 API로 학교급·설립구분·주소를 정확히 획득. 좌표는 미제공이라
카카오 지오코딩과 조합 필요. **Phase 4에서 정확도 보강용으로 추가.**

---

## 6. 공동주택 관리비·기본정보 (K-apt)

- 공공데이터포털: `공동주택관리정보시스템` 계열 API
- 활용 항목: 총 세대수, 총 주차대수, ㎡당 공용관리비, 난방방식, 복도유형(구조)
- 사용 축: AMENITY(관리비), RISK(주차 부족, 벽식구조 층간소음)
- **MVP 대응**: 자동 연동 실패 시 사용자 수동 입력 폼으로 폴백.
  세대수·주차대수·월관리비는 부동산 앱에서 사용자가 쉽게 확인 가능한 값이다.

---

## 6-2. 한국부동산원 R-ONE — 지역 시장 지표 `[미확인]`

`www.reb.or.kr/r-one/portal/openapi/openApiDevPage.do`

**다른 소스와 성격이 다르다.** 1~6번은 개별 단지의 점수를 만들기 위한 데이터인데,
R-ONE 은 지역 단위 시계열 통계다. 단지 적합도와 직접 대응하지 않아 **점수에 넣지
않고 `/market` 조회 화면에서 따로 보여준다.** 숫자를 눈으로 확인한 뒤 축 반영
여부를 판단하는 순서다.

### 대상 지표

| 코드 | 지표 | 화면에서의 쓸모 |
|---|---|---|
| `SALE_PRICE_INDEX` | 주택 매매가격지수 | 지역 가격 방향. INVESTMENT 의 모멘텀을 실거래 추정 대신 공식 지수로 대체할 후보 |
| `JEONSE_PRICE_INDEX` | 주택 전세가격지수 | 매매지수와 함께 보면 전세가율 방향 |
| `REAL_TRADE_INDEX` | 공동주택 실거래가격지수 | 표본 조사보다 체감에 가깝다. VALUE 의 기준선 후보 |
| `JEONSE_CONVERSION_RATE` | 전월세전환율 | 현재 앱이 매매만 다루므로 참고 지표 |
| `LAND_PRICE_CHANGE` | 지가변동률 | 건물이 아닌 토지 |
| `UNSOLD_UNITS` | 미분양 주택 | INVESTMENT 의 '공급 희소성'이 데이터 미확보로 결측인데, 그 자리를 메울 후보 |

### 구현 상태

인터페이스(`MarketIndexProvider`)·Mock·캐시·쿼터·화면은 완료. **실어댑터만
미완**이며 이유는 개발 환경에서 `www.reb.or.kr` 에 닿지 않아 응답 스키마를
확인하지 못했기 때문이다. 경위와 해법은 `docs/10-KNOWLEDGE.md` §1.6.

엔드포인트·파라미터명·응답 필드는 **아직 아무것도 확정되지 않았다.** 추측으로
채우지 않는다. 확인 절차:

```bash
# 네트워크가 열린 환경에서
npm run probe:rone -- "<R-ONE 개발가이드의 요청 예시 URL>"
```

### 캐시·쿼터

| 항목 | 값 | 근거 |
|---|---|---|
| 컬렉션 | `cache_market_index` | |
| TTL | 1일 | 통계는 월 단위 갱신. 하루면 갱신일을 하루 안에 따라잡는다 |
| 캐시 키 | `idx_<소스>_<지표>_<지역>_<개월수>` | 개월 수를 넣지 않으면 12개월 요청이 24개월 캐시를 덮어써 데이터가 사라져 보인다 |
| 일일 상한 | `QUOTA_REB` 기본 1,000 | **근거 없는 보수적 값.** 실제 무료 한도 확인 후 조정 필요 |

---

## 7. 데이터 없이 개발하기 (Mock 전략)

`lib/providers/mock/` 에 서울·경기 주요 지역 시드 데이터를 포함한다.

| Mock 파일 | 내용 |
|---|---|
| `seed-places.ts` | 지하철역 60개, 학교 80개, 마트 30개 (실제 좌표) |
| `seed-trades.ts` | 강남·노원·판교 3개 지역 실거래 샘플 각 40건 |
| `seed-routes.ts` | 좌표쌍 해시 → 결정적 소요시간 생성기 |

Mock 경로 생성은 **하버사인 거리 기반 결정적 함수**로 만든다(랜덤 금지).
```
totalTime = round(거리km × 2.4 + 8)          // 도심 대중교통 평균 속도 근사
transitCount = 거리 10km 미만 ? 0~1 : 1~2    // 거리 해시로 결정적 산출
```
동일 입력 → 동일 출력이어야 골든 테스트가 성립한다.

---

## 8. 키 발급 체크리스트

### 8.1 Firebase (필수 — 인증·저장소)

| # | 콘솔 경로 | 얻는 값 |
|---|---|---|
| 1 | 프로젝트 생성 | 프로젝트 ID |
| 2 | Authentication → 시작하기 → Sign-in method → **Google** 사용 설정 | — |
| 3 | Authentication → Settings → 승인된 도메인에 `localhost` 확인 | — |
| 4 | Firestore Database → 데이터베이스 만들기 → **프로덕션 모드** → `asia-northeast3`(서울) | — |
| 5 | 프로젝트 설정 → 내 앱 → 웹 앱 추가(`</>`) → SDK 설정 및 구성 | `NEXT_PUBLIC_FIREBASE_*` 6개 |
| 6 | 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성(JSON) — **로컬·Vercel 만**. App Hosting 은 키 없이 ADC 로 붙는다(`06-DEPLOY.md` §6) | `FIREBASE_ADMIN_*` 3개 |

서비스 계정 JSON 에서 옮겨 담을 값:

| JSON 필드 | 환경변수 |
|---|---|
| `project_id` | `FIREBASE_ADMIN_PROJECT_ID` |
| `client_email` | `FIREBASE_ADMIN_CLIENT_EMAIL` |
| `private_key` | `FIREBASE_ADMIN_PRIVATE_KEY` (개행을 `\n` 으로 이스케이프해 한 줄로) |

**설정 후 반드시 검증**:

```bash
npm run check:firebase
```

값 누락, `private_key` 형식 오류, 웹/Admin 프로젝트 ID 불일치를 잡아내고,
Admin SDK 초기화 → Firestore 쓰기·읽기·삭제 → Authentication 접근까지 실제로 시험한다.

> 리전은 한 번 정하면 바꿀 수 없다. App Hosting 백엔드와 같은 지역으로 맞춘다 —
> App Hosting 지역 목록에 서울(`asia-northeast3`)이 있으면 서울, 없으면 `asia-east1`.
> Firestore 를 만들지 않은 채로 두면 연결 테스트가 `NOT_FOUND` 로 실패한다.

### 8.2 나머지 API (선택 — 미설정 시 시드 데이터로 동작)

```
[ ] developers.kakao.com 앱 생성 → 카카오맵 API 활성화
[ ] 앱 키 → REST API 키 + JavaScript 키
[ ] 플랫폼 → Web → 사이트 도메인 등록 (http://localhost:3000, http://localhost:3100)
[ ] data.go.kr 가입 → 아파트 매매 실거래가 상세 활용신청(자동승인) → 인증키
[ ] lab.odsay.com 가입 → API 키 발급 → 도메인/IP 등록
[ ] .env.local 에 값 기입 (.env.example 참고)
```

주: 카카오맵 API 는 개발자 계정 기준 **첫 번째로 활성화한 앱에만 무료 쿼터**가 제공된다.
두 번째 앱부터 또는 한도 초과 시 비즈월렛 연결 후 사용량 기반 과금이다. [구버전-검증필요]

**출처**
- [국토교통부_아파트 매매 실거래가 상세 자료 | 공공데이터포털](https://www.data.go.kr/data/15126468/openapi.do)
- [국토교통부_아파트 매매 실거래가 자료 | 공공데이터포털](https://www.data.go.kr/data/15126469/openapi.do)
- [Kakao Developers — Local REST API 문서](https://developers.kakao.com/docs/latest/ko/local/dev-guide)
- [Kakao 지도 Web API 샘플](https://apis.map.kakao.com/web/sample/)
- [ODsay LAB 대중교통 정보 API 가이드](https://lab.odsay.com/guide/guide)
- [ODsay LAB 운영정책](https://lab.odsay.com/doc/totalPolicy)
- [Firebase Hosting — Integrate Next.js](https://firebase.google.com/docs/hosting/frameworks/nextjs)
