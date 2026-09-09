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
- 엔드포인트: `http://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev`
- 트래픽: 개발계정 **일 10,000회**. 운영계정은 활용사례 등록 후 증량 신청 [확인됨]
- 활용 신청 즉시 승인(자동승인 데이터셋)

### 3.1 요청 파라미터

| 파라미터 | 설명 | 예시 |
|---|---|---|
| `serviceKey` | 인증키 (URL 인코딩 주의) | — |
| `LAWD_CD` | 법정동코드 **앞 5자리** | `11680` (강남구) |
| `DEAL_YMD` | 계약년월 6자리 | `202608` |
| `pageNo` / `numOfRows` | 페이징 | `1` / `1000` |

### 3.2 응답 주요 필드 (상세 자료)

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
- serviceKey 는 **디코딩 키**를 쓰고 fetch URL 조립 시 인코딩하거나,
  인코딩 키를 그대로 문자열 결합. 이중 인코딩이 대표적 실패 원인
- 실거래 신고 기한이 계약일로부터 30일이므로 **당월 데이터는 불완전**하다.
  시세 산출 윈도우는 `직전월 ~ 6개월 전` 으로 잡는다

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

```
[ ] 1. Firebase 프로젝트 생성 → Authentication에서 Google 제공자 사용 설정
[ ] 2. Firebase 웹 앱 등록 → firebaseConfig 6개 값 확보
[ ] 3. Firebase 서비스 계정 키 생성(JSON) → Admin 3개 값 확보
[ ] 4. Firestore 생성 (asia-northeast3 서울 리전) → 프로덕션 모드
[ ] 5. developers.kakao.com 앱 생성 → REST API 키 + JavaScript 키
[ ] 6. 카카오 앱 설정 → 플랫폼 → Web → 사이트 도메인 등록 (localhost 포함)
[ ] 7. data.go.kr 회원가입 → 아파트 매매 실거래가 상세 활용신청 → 인증키
[ ] 8. lab.odsay.com 가입 → API 키 발급 → 도메인/IP 등록
[ ] 9. .env.local 에 위 값 기입 (.env.example 참고)
```

**출처**
- [국토교통부_아파트 매매 실거래가 상세 자료 | 공공데이터포털](https://www.data.go.kr/data/15126468/openapi.do)
- [국토교통부_아파트 매매 실거래가 자료 | 공공데이터포털](https://www.data.go.kr/data/15126469/openapi.do)
- [Kakao Developers — Local REST API 문서](https://developers.kakao.com/docs/latest/ko/local/dev-guide)
- [Kakao 지도 Web API 샘플](https://apis.map.kakao.com/web/sample/)
- [ODsay LAB 대중교통 정보 API 가이드](https://lab.odsay.com/guide/guide)
- [ODsay LAB 운영정책](https://lab.odsay.com/doc/totalPolicy)
- [Firebase Hosting — Integrate Next.js](https://firebase.google.com/docs/hosting/frameworks/nextjs)
