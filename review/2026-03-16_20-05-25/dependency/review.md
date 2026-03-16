## 의존성 코드 리뷰

### 발견사항

- **[WARNING]** `BOARD_ROWS` / `BOARD_COLS` 상수 중복 정의
  - 위치: `server.mjs:37-38`
  - 상세: `BOARD_ROWS = 22`, `BOARD_COLS = 10`이 `lib/tetris/constants.ts`와 별도로 하드코딩되어 있음. `server.mjs`는 순수 JS이므로 `.ts`를 직접 import할 수 없지만, `lib/multiplayer/ranking.mjs`, `sanitize.mjs` 패턴처럼 공유 `.mjs` 상수 파일로 분리할 수 있음
  - 제안: `lib/tetris/constants.mjs`를 만들어 양쪽에서 공유하거나, 최소한 주석으로 constants.ts와 동기화 지점을 명시

- **[WARNING]** `MAX_PLAYERS` 상수 중복
  - 위치: `server.mjs:33` / `lib/multiplayer/types.ts:4`
  - 상세: 동일한 값(5)이 두 곳에 독립적으로 정의되어 있어 변경 시 불일치 발생 가능
  - 제안: `lib/multiplayer/types.mjs`로 공유하거나, server.mjs에서 types의 값을 참조

- **[WARNING]** TypeScript에서 `.mjs` 파일 직접 re-export
  - 위치: `lib/multiplayer/broadcast.ts:6`
  - 상세: `export { calculateRankings } from "./ranking.mjs"` — TypeScript가 `.mjs` 확장자를 직접 import하는 것은 `tsconfig.json`의 `moduleResolution` 설정에 따라 타입 추론 없이 동작하거나 실패할 수 있음. `ranking.mjs`에 대응하는 `.d.mts` 타입 선언이 없으면 `calculateRankings`의 타입이 `any`로 추론됨
  - 제안: `ranking.ts`로 통일하거나, `ranking.mjs` 옆에 `ranking.d.mts` 타입 선언 파일 추가

- **[INFO]** `lib` 계층에 `.mjs`와 `.ts` 혼용
  - 위치: `lib/multiplayer/ranking.mjs`, `lib/multiplayer/sanitize.mjs`
  - 상세: 서버(Node.js ESM)와 공유하기 위해 `.mjs`를 사용하는 의도는 이해되나, 타입 안전성이 없어 오류 감지가 런타임으로 미뤄짐
  - 제안: 현재 구조를 유지한다면 JSDoc 타입 어노테이션이라도 추가

- **[INFO]** `getRotations` 미사용 export
  - 위치: `lib/tetris/tetrominoes.ts:143`
  - 상세: `export function getRotations`가 리뷰 대상 파일 어디에서도 사용되지 않음 (dead export 가능성)
  - 제안: 미사용 확인 후 제거 또는 내부(non-export)로 변경

- **[INFO]** `ws` 외부 패키지 — 서버 전용
  - 위치: `server.mjs:6`
  - 상세: `ws` 라이브러리는 서버 사이드 전용으로만 사용되고 있어 클라이언트 번들에는 포함되지 않음. 별도 이슈 없음

---

### 요약

외부 의존성 추가는 최소화되어 있으며(`ws`, Next.js, Tailwind 등 기존 스택 활용), 주요 위험은 **내부 모듈 간 의존성 관리**에 있다. `BOARD_ROWS`/`BOARD_COLS`/`MAX_PLAYERS`의 중복 정의는 서버와 클라이언트 간 상수 불일치를 유발할 수 있는 잠재적 버그 경로이며, `broadcast.ts`에서 `.mjs` 파일을 re-export하는 패턴은 TypeScript 타입 안전성 공백을 만든다. `lib/` 내 `.ts`와 `.mjs` 혼용 구조는 Node.js 공유 목적에서 이해되나, 타입 선언 파일 보완이 필요하다.

### 위험도
**LOW** (기능적 결함보다는 유지보수성 및 타입 안전성 위험)