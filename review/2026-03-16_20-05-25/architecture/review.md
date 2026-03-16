## 아키텍처 코드 리뷰

### 발견사항

---

**[WARNING] `broadcast.ts`의 단일 책임 원칙 위반**
- 위치: `lib/multiplayer/broadcast.ts`
- 상세: `toBroadcastState` (상태 변환)와 `calculateRankings` 재-export가 같은 모듈에 공존. 브로드캐스트 모듈이 랭킹 계산 책임까지 소유하는 구조.
- 제안: `calculateRankings`는 `lib/multiplayer/ranking.mjs`에서 직접 import하거나, `lib/multiplayer/index.ts` 배럴 파일을 통해 노출.

---

**[WARNING] 상수 중복 — 서버와 클라이언트 동기화 불가**
- 위치: `server.mjs:30-31` vs `lib/tetris/constants.ts`
- 상세: `BOARD_ROWS = 22`, `BOARD_COLS = 10`이 서버에 하드코딩되어 있고, `constants.ts`의 값과 별개로 관리됨. 값 변경 시 서버 쪽 누락 가능성.
- 제안: 서버가 TypeScript를 import할 수 없다면, `lib/tetris/constants.mjs` 공유 파일을 만들어 양쪽에서 import.

---

**[WARNING] `GameBoard.tsx`가 `HIDDEN_ROWS` 상수 대신 매직 넘버 사용**
- 위치: `app/components/GameBoard.tsx:54`
- 상세: `const hiddenRows = 2;` 로컬 변수를 사용. `OpponentBoard.tsx`는 동일한 값에 대해 `HIDDEN_ROWS` 상수를 import하는데, `GameBoard.tsx`는 하드코딩. DRY 위반.
- 제안: `import { HIDDEN_ROWS } from "@/lib/tetris/constants"` 사용.

---

**[WARNING] `TetrisGame.tsx`의 과도한 책임 (God Component)**
- 위치: `app/components/TetrisGame.tsx`
- 상세: 단일 컴포넌트가 게임 상태 관리(useReducer), 중력 타이머, 키보드 입력 처리, 멀티플레이어 상태 브로드캐스팅, 시작/일시정지/게임오버 오버레이 렌더링까지 담당. 300+ 라인.
- 제안: 키보드 이벤트 처리를 `useGameControls` 훅으로, 오버레이 UI를 별도 컴포넌트로 분리.

---

**[WARNING] Canvas 드로잉 로직 중복**
- 위치: `GameBoard.tsx`, `NextPiece.tsx`, `OpponentBoard.tsx`
- 상세: 셀 하이라이트/그림자 렌더링 패턴이 3곳에서 반복. `drawCell`/`drawMiniCell` 함수가 각각 독립적으로 존재하며 로직이 거의 동일.
- 제안: `lib/tetris/canvas.ts`에 `drawCell(ctx, x, y, size, color)` 공용 함수 추출 후 재사용.

---

**[INFO] `.mjs` 파일과 TypeScript 혼용**
- 위치: `lib/multiplayer/ranking.mjs`, `lib/multiplayer/sanitize.mjs`
- 상세: 프로젝트 전반이 TypeScript인데 서버-클라이언트 공유 유틸리티만 `.mjs`. 서버가 TypeScript를 직접 import할 수 없어서의 타협이지만, 타입 안전성이 없고 IDE 지원도 약함.
- 제안: `ranking.ts`/`sanitize.ts`로 작성하고 `tsconfig.server.json`으로 서버용 빌드를 분리하거나, Zod 같은 런타임 검증 라이브러리를 공유.

---

**[INFO] `MultiplayerGame.tsx`가 3개 Phase를 하나의 컴포넌트에서 처리**
- 위치: `app/components/MultiplayerGame.tsx`
- 상세: lobby/result/playing 단계가 if-else 분기로 하나의 컴포넌트에 존재. 각 Phase마다 렌더링 로직과 데이터가 다름.
- 제안: `LobbyView`, `PlayingView`로 분리하면 각 Phase별 테스트와 변경이 쉬워짐. (현재 규모에서는 낮은 우선순위)

---

**[INFO] WebSocket 경로 `/ws`가 여러 곳에 하드코딩**
- 위치: `server.mjs`, `useMultiplayer.ts`
- 상세: `/ws` 경로가 양쪽에 분산되어 있어 경로 변경 시 누락 위험.
- 제안: 공유 상수 파일에 `WS_PATH = "/ws"` 정의.

---

### 요약

전반적으로 게임 로직(`lib/tetris/`)과 UI(`app/components/`), 네트워크 레이어(`useMultiplayer`, `server.mjs`) 간 경계가 명확하게 설계되어 있으며, `gameEngine.ts`의 순수 함수 패턴과 `reducer.ts`의 Redux 패턴 적용이 적절하다. 순환 의존성은 없고, 타입 시스템도 잘 활용되고 있다. 다만 서버-클라이언트 간 상수 중복, `broadcast.ts`의 SRP 위반, `TetrisGame.tsx`의 God Component 문제, Canvas 드로잉 코드 중복이 규모가 커질수록 유지보수 부담이 될 수 있다. 특히 `.mjs` 공유 파일의 타입 안전성 부재는 향후 버그 유발 가능성이 있어 TypeScript 빌드 분리를 검토할 만하다.

### 위험도

**LOW**