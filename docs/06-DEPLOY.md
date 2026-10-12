# 06. 배포

## 지금 상태

| 항목 | 값 |
|---|---|
| 대상 | Vercel (무료 Hobby) |
| 필요한 환경변수 | `DEMO_SEED=1` **하나뿐** |
| 동작 범위 | 전 화면 + 데모 로그인. 데이터는 시드 데이터 |
| 영속성 | **없음** (아래 §3) |

`docs/02-ARCHITECTURE.md` 는 Firebase App Hosting 을 전제로 쓰여 있다. 그쪽은
Blaze(종량제) 전환과 Firestore·Authentication 콘솔 설정이 함께 필요해서, 먼저
Vercel 로 눈에 보이게 띄우고 Firebase 는 실데이터 단계에서 붙인다. **코드 변경
없이 양쪽 모두에 올라간다** — 키가 없으면 Mock Provider 로, 있으면 실 Provider 로
자동 전환되는 구조이기 때문이다.

## 1. Vercel 배포 절차

1. https://vercel.com 에 GitHub 계정으로 로그인
2. **Add New… → Project** → `luminier-create/estate` 를 Import
3. Framework Preset 이 **Next.js** 로 자동 인식되는지만 확인한다.
   Build Command·Output Directory 는 기본값 그대로 둔다
4. **Environment Variables** 에 하나만 추가한다

   | Name | Value |
   |---|---|
   | `DEMO_SEED` | `1` |

5. **Deploy**

빌드는 `npm run build` 그대로이고 별도 설정 파일(`vercel.json`)이 필요 없다.

### 배포 브랜치

배포 기준은 `main` 이다 (PR #1 머지, 2026-10-12).

Vercel 은 Import 시점의 저장소 **기본 브랜치**를 Production Branch 로 잡는다.
GitHub 기본 브랜치가 아직 `claude/cool-cray-arzjd9` 로 남아 있으면 Import 전에
GitHub → Settings → General → Default branch 를 `main` 으로 바꾼다. 이미 Import
했다면 Vercel → Settings → Git → Production Branch 를 `main` 으로 바꾼다.
**두 곳이 같은 브랜치를 가리켜야 한다** — 어긋나면 배포가 멈춘 브랜치를 계속
바라본다.

## 2. `DEMO_SEED` 가 하는 일

데모 사용자에게 후보 3건과 그 분석 결과를 첫 요청에 채운다
(`src/lib/demo-seed.ts`). 단지명에 `(예시)` 를 붙여 실제 매물로 읽히지 않게 한다.

기본값은 **꺼짐**이다. 로컬 개발과 E2E 의 초기 상태를 바꾸지 않기 위해서다.
Firebase Admin 이 설정되면 저장소가 Firestore 로 바뀌므로 이 경로 자체를 타지
않는다 — 켜 둔 채로 실데이터 환경에 가도 부작용이 없다.

### 켜면 온보딩 화면을 지나간다

시드는 프로필(예산·직장·가구 구성)까지 채우고 `onboardingCompleted` 를 세우므로
데모 방문자는 로그인 직후 대시보드로 바로 간다. 온보딩 3스텝을 보여주려면
`DEMO_SEED` 를 끄고 배포한다. 반대로 방문자가 직접 온보딩을 마친 경우에는
시드가 그 프로필을 덮지 않는다 (`onboardingCompleted` 와 `seededAt` 으로 가른다).

### 실 API 키와 같이 켜지 않는다

시드는 후보 3건을 **분석까지** 만들고, 분석은 단지당 24개월 실거래를 조회한다.
`MOLIT_SERVICE_KEY` 가 함께 설정돼 있으면 인스턴스가 새로 뜰 때마다 시딩이
일일 쿼터를 갉아먹는다. 실데이터를 붙이는 단계에서는 `DEMO_SEED` 를 끈다.

## 3. 알고 배포하는 제약 — 인메모리 저장소

Firebase Admin 이 없으면 저장소가 **서버 프로세스 메모리**다
(`src/lib/repo/store.ts`). 서버리스에서는 인스턴스마다 메모리가 따로이고
인스턴스는 수시로 새로 뜬다. 결과:

- **읽기는 안전하다** — 시드 데이터는 어느 인스턴스에서든 같은 입력으로 다시
  만들어진다 (Mock Provider 가 결정적이라 좌표·점수가 동일하다)
- **쓰기는 남지 않는다** — 방문자가 등록한 단지, 바꾼 가중치, 추가한 호재는
  그 요청을 처리한 인스턴스에만 있다. 새로고침하면 사라져 보일 수 있다
- **방문자끼리 섞이지는 않는다** — 데모 쿠키에 방문자별 난수를 담고 그것으로
  저장 공간(`users/demo_<난수>/…`)을 가른다. 예전처럼 고정 uid 를 쓰면 공개
  주소에서 A 가 입력한 직장 주소를 B 가 그대로 보게 된다

시연·검토용으로는 충분하지만 **실사용은 불가능하다.** 영속 저장의 유일한 해법은
Firebase Admin 설정이고, 이는 어차피 해야 할 작업이다.

## 4. 실데이터·영속 저장으로 올리는 순서

Vercel → Settings → Environment Variables 에 추가한다. 넣는 만큼만 전환되고,
없는 항목은 계속 Mock 으로 동작한다.

| 단계 | 변수 | 효과 |
|---|---|---|
| 1 | `FIREBASE_ADMIN_PROJECT_ID`<br>`FIREBASE_ADMIN_CLIENT_EMAIL`<br>`FIREBASE_ADMIN_PRIVATE_KEY` | 저장소가 Firestore 로. **데이터가 남는다** |
| 2 | `NEXT_PUBLIC_FIREBASE_*` 6종 | 구글 로그인 활성화 (데모 로그인 대신 실계정) |
| 3 | `MOLIT_SERVICE_KEY` | 실거래가 → VALUE·AGE·INVESTMENT 축 실데이터 |
| 4 | `KAKAO_REST_API_KEY` / `NEXT_PUBLIC_KAKAO_JS_KEY` | 지오코딩·주변시설·지도 |
| 5 | `ODSAY_API_KEY` | 대중교통 경로 → COMMUTE 축 |

`FIREBASE_ADMIN_PRIVATE_KEY` 는 개행을 `\n` 으로 이스케이프한 한 줄로 넣는다.

1단계를 넣는 순간 데모 로그인이 **차단된다** (`/api/auth/session` 이
`isAdminConfigured` 일 때 데모 경로를 거부한다). 즉 1단계와 2단계는 같이 넣어야
로그인할 수 있다.

Firestore 를 켰다면 보안 규칙 배포를 빠뜨리지 않는다 — 콘솔에서 만든 Firestore 는
기본이 테스트 모드(전면 개방)다.

```bash
npm run deploy:rules
npm run check:firebase   # 배포본과 로컬 파일을 대조한다
```

## 5. Firebase 프로젝트 연결 (`estate-83713`)

호스팅은 Vercel, 로그인·저장은 Firebase(Spark 무료)로 쓴다. 코드 변경 없이
아래 콘솔 작업과 Vercel 환경변수만으로 전환된다. `.firebaserc` 의 기본 프로젝트가
`estate-83713` 이라 `npm run deploy:rules` 도 이 프로젝트를 대상으로 한다.

### 5.1 Firebase 콘솔

1. **Authentication** → 시작하기 → 로그인 방법 → **Google** 사용 설정 → 저장
2. **Firestore Database** → 데이터베이스 만들기 → 위치 `asia-northeast3`(서울)
   → **프로덕션 모드**로 시작. 테스트 모드로 만들면 전면 개방이다
3. **프로젝트 설정 → 일반 → 내 앱** → 웹(`</>`) 앱 추가. Firebase Hosting 은
   체크하지 않는다. 표시되는 `firebaseConfig` 6개 값을 아래 표의 `NEXT_PUBLIC_*` 에 쓴다
4. **프로젝트 설정 → 서비스 계정** → 새 비공개 키 생성 → JSON 다운로드.
   이 파일은 비밀이다 — 저장소·채팅에 올리지 않고 Vercel 환경변수에만 넣는다

복합 인덱스는 필요 없다. 저장소 계층이 `where`·`orderBy` 쿼리를 쓰지 않는다.

### 5.2 Vercel 환경변수

| 변수 | 값 |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `firebaseConfig.apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `firebaseConfig.authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `estate-83713` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `firebaseConfig.storageBucket` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `firebaseConfig.messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `firebaseConfig.appId` |
| `FIREBASE_ADMIN_PROJECT_ID` | `estate-83713` |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | JSON 의 `client_email` |
| `FIREBASE_ADMIN_PRIVATE_KEY` | JSON 의 `private_key` 값 그대로 (`\n` 포함, 따옴표 제외) |

`DEMO_SEED` 는 넣지 않는다 — Admin 이 설정되면 어차피 타지 않는 경로다.
`NEXT_PUBLIC_*` 는 빌드 시점에 번들에 박히므로, 배포 후에 넣었다면 Redeploy 한다.

### 5.3 배포 후

Authentication → 설정 → **승인된 도메인**에 Vercel 이 준 주소
(`<프로젝트>.vercel.app`)를 추가한다. 빠뜨리면 구글 로그인 팝업이
`auth/unauthorized-domain` 으로 실패한다. Preview 배포는 주소가 매번 달라
로그인이 되지 않는 것이 정상이다.
