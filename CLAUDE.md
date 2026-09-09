# CLAUDE.md — HomeFit 작업 규약

이 저장소에서 작업할 때 지켜야 할 규칙과, 실제로 걸렸던 함정을 모아둔다.
설계 배경은 `docs/`, 축적되는 지식은 `docs/10-KNOWLEDGE.md`,
알고리즘 변경 이력은 `docs/11-ALGORITHM-LAB.md` 를 본다.

## 프로젝트 한 줄 요약

부동산 앱에서 찾은 아파트가 **사용자 본인 조건에** 맞는지 0~100점으로 판정하고
후보 간 순위를 매기는 서비스. 매물 검색이 아니라 **의사결정 보조**가 정체성이다.

## 명령어

| 명령 | 용도 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run typecheck` | TypeScript strict 검사 |
| `npm run lint` | ESLint |
| `npm test` | 단위 테스트 (스코어링·캐시) |
| `npm run test:e2e` | E2E + 접근성 감사 |
| `npm run build` | 프로덕션 빌드 |
| `npm run check:firebase` | Firebase 설정 점검 |

## 구조

```
src/lib/scoring/    외부 의존 0인 순수 함수. 점수 로직은 전부 여기.
src/lib/providers/  외부 API 어댑터. real/mock 을 환경변수로 전환.
src/lib/cache*      응답 캐시와 일일 쿼터 가드.
src/lib/repo/       Firestore 접근. Admin 미설정 시 인메모리로 폴백.
src/app/(app)/      인증이 필요한 화면.
```

## 반드시 지킬 것

### 1. 결측은 0점이 아니라 제외

외부 API 하나가 실패해도 앱이 멈추면 안 된다. 해당 축만 `score: null` 로 두고
가중치째 빼서 나머지를 재정규화한다. 새 축을 만들 때도 이 규칙을 따른다.
"데이터가 없다"와 "값이 나쁘다"는 다르다 — 미입력을 0점으로 처리하지 말 것.

**만점으로 처리하는 것은 더 나쁘다.** 계산이 실패해 NaN·Infinity 가 나오면
결측으로 강등한다 (`ok()` 가 자동으로 처리한다). 축 곡선은 대부분 내림차순이라
비유한 값을 첫 구간으로 대체하면 그 축이 100점이 된다 — 데이터가 없는 단지가
1위로 올라오는데 화면에는 아무 경고도 뜨지 않는다. 자세한 경위는
`docs/11-ALGORITHM-LAB.md` D-005.

### 2. 스코어링 로직을 바꾸면 `ALGORITHM_VERSION` 을 올린다

`src/lib/scoring/types.ts` 의 상수. 올리지 않으면 기존 분석 캐시가 낡은 점수를
계속 반환한다. 곡선·가중치·집계식 중 하나라도 손대면 올린다.

### 3. 순수 함수는 `server-only` 경계 밖에 둔다

`analyze.ts` 같은 서버 모듈은 vitest 에서 import 할 수 없다. 테스트하고 싶은
변환 로직은 `lib/scoring/` 으로 빼낸다 (`landmarks.ts` 가 그 예).

### 4. 점수는 서버에서만 기록한다

Firestore 규칙이 `analyses` 의 클라이언트 쓰기를 막고 있다. 점수를 클라이언트에서
저장하는 코드를 넣지 말 것.

### 5. 화면과 점수의 기준을 일치시킨다

지도의 "도보 10분 반경"은 스코어링과 같은 보행속도·우회계수로 역산한다
(`metersForWalkMinutes` 는 `walkMinutes` 의 역함수이고 테스트로 고정되어 있다).
표시용 상수를 따로 만들지 말 것.

### 6. 검증 없이 푸시하지 않는다

```bash
npm run typecheck && npm run lint && npm test && npm run build
npm run test:e2e     # 화면·흐름을 건드렸다면
```

## 함정 (실제로 겪은 것)

### 개발 서버를 띄운 채 `npm run build` 금지

`.next` 가 프로덕션 산출물로 덮여 개발 서버가 깨진다. E2E 가 전부 타임아웃 나며
원인 파악에 시간이 걸린다. 빌드 후에는 개발 서버를 다시 시작한다.

### Tailwind v4 에서 CSS 변수는 `var()` 를 명시

`bg-[--color-brand]` 는 적용되지 않는다. `bg-[var(--color-brand)]` 로 쓴다.

### 브랜드색은 배경용과 텍스트용이 다르다

`--color-brand`(배경) / `--color-brand-text`(텍스트). 하나로 합치면 밝은 배경 위
작은 글자에서 WCAG AA(4.5:1)를 만족시킬 수 없다. 다크 모드는 텍스트용을 뒤집는다.
새 색을 추가하면 `npm run test:e2e` 의 접근성 감사가 대비를 검사한다.

### 프로덕션 모드에서는 데모 쿠키가 HTTP 로 전달되지 않는다

`secure` 플래그 때문이다. E2E 는 개발 서버로 돌린다.

### typedRoutes 는 새 라우트를 빌드해야 인식한다

새 페이지를 추가하고 `Link href` 타입 오류가 나면 `npm run build` 를 한 번 돌린다.

### 데모 저장소는 서버 프로세스 메모리에 남는다

Firebase Admin 미설정 시 인메모리 폴백이라, 같은 서버에 테스트를 반복하면 이전
상태가 남는다. E2E 는 이 상태에 무관하게 통과해야 한다(멱등).
**깨끗한 서버에서만 드러나는 결함이 있으므로 cold start 로도 확인한다:**

```bash
pkill -f "nex[t]-server"; rm -rf .next && npm run test:e2e
```

### 로그인 직후 URL 로 분기하지 않는다

데모 로그인은 쿠키를 받은 뒤 이동한다. 이동을 기다리지 않고 다음 요청을 보내면
쿠키 없이 랜딩에 머문다. `waitForURL` 로 이동을 기다린다.

### Zod 의 `z.number()` 는 Infinity 를 통과시킨다

NaN 은 막지만 `Infinity` 는 통과한다. 좌표·비율처럼 계산에 들어가는 값에는
`.finite()` 와 범위(`.min()/.max()`)를 반드시 붙인다. Infinity 좌표 하나가
거리 계산을 NaN 으로 만들고, 그것이 점수 산출 전체로 번진다.

### 번들에 무거운 라이브러리를 정적 import 하지 않는다

recharts·Firebase SDK 는 지연 로드했다. 새 라이브러리를 넣으면
`npm run build` 의 First Load JS 를 확인한다 (상세 125kB, 랜딩 114kB 기준).

## 코드 규약

- TypeScript strict. `any` 는 외부 API 응답 파싱부에서만, 즉시 좁힌다
- 사용자 노출 문자열은 한국어. 숫자는 천단위 구분·단위 병기
- 주석은 **왜** 를 적는다. 무엇을 하는지는 코드로 읽히게
- 모바일 360px 에서 가로 스크롤이 생기면 안 된다. 터치 타깃 44px 이상
- 점수·순위 화면에는 면책 고지(`<Disclaimer />`)를 노출한다

## 하지 않을 것

- 부동산 앱 스크래핑 (공식 Open API 만 사용)
- 매수·매도 권유로 읽힐 문구
- 출처 없는 호재·시세 정보를 확정처럼 표기
- 테스트를 건너뛰거나 비활성화해서 통과시키기

## 에이전트와 스킬

`.claude/agents/` 에 역할별 에이전트가 있다. 작업 성격에 맞는 것을 호출한다.

| 에이전트 | 쓰는 때 |
|---|---|
| `homefit-dev` | 기능 구현, 버그 수정, 리팩터링 |
| `homefit-research` | API 정책·도메인 사실 조사 (쓰기는 `docs/` 만) |
| `homefit-product` | 기획·우선순위·UX 개선안 (코드 수정 안 함) |
| `homefit-reviewer` | 변경분 검토 (읽기 전용) |

`.claude/skills/` 에 반복 절차가 있다.

| 스킬 | 쓰는 때 |
|---|---|
| `homefit-axis` | 스코어링 축 추가·가중치 조정 |
| `homefit-provider` | 새 외부 API 연동 |
| `homefit-feature` | 화면·기능 추가 |
| `homefit-ship` | 배포 전 최종 점검 |
