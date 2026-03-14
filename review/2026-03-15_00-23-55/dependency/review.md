## 의존성 코드 리뷰

### 발견사항

- **[INFO]** `WebSocket` named import 추가
  - 위치: `server.mjs:6` — `import { WebSocketServer, WebSocket } from "ws"`
  - 상세: 이미 사용 중인 `ws` 패키지에서 `WebSocket` 클래스를 추가로 import. 기존 매직 넘버 `=== 1`을 `WebSocket.OPEN` 상수로 교체하기 위한 변경. 새 패키지 추가 없음.
  - 제안: 현재 방식 적절. `ws` 패키지는 표준 WebSocket readyState 상수(`OPEN=1`, `CLOSING=2`, `CLOSED=3`)를 준수함.

- **[INFO]** `URL` 빌트인 API 사용 (`ModeSelection.tsx`)
  - 위치: `ModeSelection.tsx:14` — `isValidWsUrl`의 `new URL(url)`
  - 상세: 외부 패키지 없이 브라우저 내장 `URL` 생성자 사용. Chrome 32+, Firefox 26+, Safari 10.1+ 지원. Next.js 환경에서 문제 없음.
  - 제안: 추가 의존성 없이 구현된 올바른 선택.

- **[INFO]** 내부 모듈 의존성 — `HIDDEN_ROWS` 상수 중앙화
  - 위치: `constants.ts:4`, `OpponentBoard.tsx:6`
  - 상세: 하드코딩된 `2`를 `HIDDEN_ROWS` 상수로 교체하여 `OpponentBoard.tsx`가 `@/lib/tetris/constants`에 새 의존성 추가. 매직 넘버 제거와 단일 진실 공급원(SSOT) 확보 목적.
  - 제안: 올바른 내부 의존성 구조. `BOARD_ROWS = VISIBLE_ROWS + HIDDEN_ROWS`로 관계를 명시적으로 표현하면 더 좋음.

- **[INFO]** `types.ts` 유니온 타입 확장
  - 위치: `types.ts:49` — `ServerMessage`에 `host_transferred` 추가
  - 상세: `useMultiplayer.ts` → `types.ts` 의존 관계에 새 메시지 타입이 추가됨. `server.mjs`의 실제 전송과 클라이언트 핸들러가 동일 타입을 참조하여 일관성 유지됨.
  - 제안: 타입 체인이 서버(`server.mjs`) → 타입 정의(`types.ts`) → 훅(`useMultiplayer.ts`) → 컴포넌트(`MultiplayerGame.tsx`) 순서로 명확히 흐름. 문제 없음.

- **[INFO]** `package.json` 변경 없음 확인
  - 상세: 이번 diff 전체에서 `package.json` 또는 `package-lock.json` 변경 없음. 모든 변경이 기존 의존성 범위 내에서 처리됨.

---

### 요약

이번 변경에서 새로운 외부 패키지는 전혀 추가되지 않았다. 가장 주목할 변경은 이미 사용 중인 `ws` 패키지에서 `WebSocket` 클래스를 명시적으로 import하여 매직 넘버 대신 `WebSocket.OPEN` 상수를 사용한 것으로, 이는 의존성을 늘리지 않으면서 코드 가독성과 안전성을 높인 적절한 선택이다. 내부 모듈 간 의존 관계도 `HIDDEN_ROWS` 상수 중앙화, `isHost` 상태의 훅 노출, `host_transferred` 타입 추가를 통해 계층이 명확해졌다. 번들 크기 영향 없음.

### 위험도

**NONE**