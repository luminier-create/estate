---
name: homefit-feature
description: HomeFit 에 화면·기능을 추가하거나 UI 를 변경하는 절차. "화면 추가", "기능 만들어", "이 버튼 넣어", "폼 수정", "목록에 표시" 같은 요청에서 쓴다. 점수 계산 변경은 homefit-axis, 외부 API 연동은 homefit-provider 로 넘긴다.
---

# 화면·기능 추가 절차

## 0. 먼저 읽는다

- `CLAUDE.md` — 함정 목록
- `docs/00-PRD.md` — 범위 안인지 확인. **매물 검색 서비스로 확장하지 않는다**

## 1. 구현

### 서버·클라이언트 경계

- 데이터 조회는 서버 컴포넌트에서. 사용자 식별은 `requireUserOrRedirect()`
  (`requireUser()` 는 서버 액션용 — 페이지에서 쓰면 예외가 500 화면이 된다)
- 상태·이벤트가 필요한 부분만 `'use client'` 로 분리한다
- 서버 액션 입력은 Zod 로 검증한다

### 스타일

- CSS 변수는 `var()` 를 명시한다. `bg-[--color-x]` 는 Tailwind v4 에서 적용되지 않는다
- 텍스트에는 `--color-brand-text`, 배경에는 `--color-brand` 를 쓴다
- 모바일 우선. 기본 클래스가 모바일, `md:`/`lg:` 로 확장
- 터치 타깃 44px 이상 (`min-h-11`)
- 넓은 콘텐츠(표·차트)는 자체 `overflow-x-auto` 안에서 스크롤시킨다

### 무거운 라이브러리

정적 import 하지 않는다. 첫 페인트에 필요 없으면 `next/dynamic` 으로 지연 로드한다
(recharts 가 그 예 — 상세 페이지 220kB → 125kB).

## 2. 상태 처리를 빠뜨리지 않는다

- **로딩** — 새 라우트면 `loading.tsx`
- **빈 상태** — `EmptyState` 로 다음 행동을 안내한다
- **오류** — 오류 경계가 이미 있다(`(app)/error.tsx`). 서버 액션 실패는 폼에서 표시한다
- **결측** — 데이터 없음을 0이나 빈칸이 아니라 명시적으로 표기한다

## 3. 테스트

```bash
npm run test:e2e
```

- E2E 흐름에 새 동작을 추가한다
- **접근성 감사가 자동으로 색 대비를 검사한다.** 새 색을 넣었으면 여기서 걸린다
- 셀렉터는 취약하지 않게: 부분 문자열 매칭을 피하고(`'2위'` 가 `'12위'` 에 매칭된다),
  실행 순서·잔존 데이터에 의존하지 않게 한다

**흐름을 바꿨으면 cold start 로도 확인한다.** 깨끗한 서버에서만 드러나는 결함이 있다.

```bash
pkill -f "nex[t]-server"; rm -rf .next && npm run test:e2e
```

## 4. 최종 확인

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

`npm run build` 출력의 First Load JS 를 본다. 크게 늘었으면 원인을 찾는다.

새 라우트를 추가하고 `Link href` 타입 오류가 나면 빌드를 한 번 돌린다
(typedRoutes 가 빌드 시 타입을 생성한다).

## 5. 문서

화면이 늘었으면 `docs/00-PRD.md` 의 화면 목록을 갱신한다.
