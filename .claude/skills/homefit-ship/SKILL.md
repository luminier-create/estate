---
name: homefit-ship
description: HomeFit 배포 전 최종 점검 절차. "배포 준비", "릴리스", "머지 전 확인", "다 됐나 확인해줘", "최종 점검" 같은 요청에서 쓴다. 검증 항목을 빠짐없이 돌리고 회귀를 확인한다.
---

# 배포 전 점검

## 1. 전체 검증

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

E2E 는 **cold start 로** 돌린다. 깨끗한 서버에서만 드러나는 결함이 있다.

```bash
pkill -f "nex[t]-server"; rm -rf .next && npm run test:e2e
```

## 2. 회귀 확인

### 번들 크기

`npm run build` 출력의 First Load JS 를 기준과 대조한다.

| 화면 | 기준 |
|---|---|
| 랜딩 | 114 kB |
| 대시보드 | 116 kB |
| 단지 상세 | 125 kB |
| 비교 | 122 kB |

늘었으면 무엇이 정적 import 되었는지 찾는다.

### 알고리즘

스코어링을 건드렸다면 `ALGORITHM_VERSION` 이 올라갔는지 확인한다.
골든 케이스 순서(우수 > 중간 > 열위)가 유지되는지 확인한다.

### 접근성

E2E 의 접근성 감사가 라이트·다크 양쪽에서 통과했는지 확인한다.

## 3. 설정 점검

```bash
npm run check:firebase     # 실 연동 환경이라면
```

`.env.example` 에 새 환경변수가 반영되었는지 확인한다.
**실제 키가 저장소에 커밋되지 않았는지 확인한다** — `.env.local` 은 gitignore 대상이다.

```bash
git status --short
git diff --cached | grep -iE "AIza|BEGIN PRIVATE KEY|serviceKey=" || echo "키 노출 없음"
```

## 4. 문서 최신화

| 문서 | 확인 |
|---|---|
| `README.md` | 명령어·성능 수치가 현재와 맞는가 |
| `docs/00-PRD.md` | 화면 목록·범위가 구현과 맞는가 |
| `docs/01-ALGORITHM.md` | 곡선·가중치가 코드와 맞는가 |
| `docs/10-KNOWLEDGE.md` | 확인일 90일 초과 항목이 `[검증필요]` 로 강등되었는가 |
| `docs/11-ALGORITHM-LAB.md` | 이번 변경의 결정 이력이 남았는가 |

## 5. 배포 형태 확인

- **Firebase App Hosting** — Blaze(종량제) 필수. 결제 계정 연결이 되어 있어야 한다
- **Vercel** — Hobby 무료로 가능. Firebase 는 Auth·Firestore 만 쓰고 Spark 유지

배포 후 **카카오 사이트 도메인**과 **Firebase Auth 승인된 도메인**에
실제 배포 주소를 추가해야 로그인·지도가 동작한다.

## 6. 보고

검증 결과를 숫자로 밝힌다 — 단위 테스트 건수, E2E 건수, 번들 크기.
통과하지 못한 것이 있으면 숨기지 않고 무엇이 왜 실패했는지 적는다.
