### 발견사항

- **[WARNING]** `activePiece` 필드 서버 검증 누락
  - 위치: `server.mjs` - `isValidState()` 함수
  - 상세: `isValidState`는 `board`, `score`, `level` 등은 검증하지만 `activePiece` 필드의 구조(shape, row, col, type)는 검증하지 않음. 악의적 클라이언트가 비정상적인 `activePiece`를 전송하면 서버가 그대로 다른 클라이언트에 broadcast하고, `OpponentBoard.tsx`에서 `shape` 배열을 순회할 때 런타임 오류 발생 가능
  - 제안: `isValidState`에 `activePiece` 구조 검증 추가 (`null`이거나 `{ type, shape: number[][], row: number, col: number }` 형태인지 확인)

- **[WARNING]** 서버-상수 이중화로 인한 계약 불일치 위험
  - 위치: `server.mjs:33-34` vs `lib/tetris/constants.ts:4-5`
  - 상세: `BOARD_ROWS = 22`, `BOARD_COLS = 10`이 서버에 하드코딩되어 있어 `lib/tetris/constants.ts`와 별도로 관리됨. 게임 상수 변경 시 서버 검증이 모든 클라이언트 상태를 거부하는 breaking change 발생 가능
  - 제안: 서버와 클라이언트가 공유할 수 있는 단일 상수 소스(예: `lib/tetris/constants.mjs`) 사용

- **[WARNING]** `state_broadcast`가 발신자에게도 전송됨
  - 위치: `server.mjs` - `handleStateUpdate()`, `broadcastAll` 사용
  - 상세: 상태 업데이트 시 `broadcastAll`로 발신자 포함 전체 전송. 클라이언트가 `if (id !== myId)` 필터링으로 자신의 상태를 무시하지만, 불필요한 네트워크 트래픽 발생. 계약상 명시되지 않은 동작
  - 제안: `broadcast(session, ..., conn.playerId)`로 발신자 제외

- **[INFO]** `player_joined` 메시지의 `player` 필드 사용 불일치
  - 위치: `lib/multiplayer/types.ts:39` vs `app/hooks/useMultiplayer.ts`
  - 상세: `ServerMessage` 타입 정의에는 `player: PlayerInfo` 필드가 있으나, 클라이언트는 `players` 배열만 사용하고 `player` 단수 필드를 무시함. 계약 정의와 실제 사용의 불일치

- **[INFO]** `host_transferred`의 `newHostId` 필드 미사용
  - 위치: `lib/multiplayer/types.ts:41` vs `app/hooks/useMultiplayer.ts`
  - 상세: 서버가 `newHostId`를 전송하지만 클라이언트는 `players` 배열만 처리. `isHost` 파생은 `players` 목록에서 계산하므로 실용상 문제없지만 계약 불일치

- **[INFO]** API 버전 관리 없음
  - 위치: `server.mjs` - WebSocket 엔드포인트 `/ws`
  - 상세: 프로토콜 변경 시 구버전 클라이언트 호환성 보장 메커니즘이 없음. LAN 게임 특성상 클라이언트-서버가 항상 동일 버전이라는 암묵적 가정에 의존

---

### 요약

이 코드베이스는 WebSocket 기반 커스텀 바이너리-프리 JSON 프로토콜을 API 계약으로 사용한다. `ClientMessage`/`ServerMessage` 타입 정의와 실제 구현 간의 일관성은 대체로 유지되어 있으나, 두 가지 주요 위험이 존재한다: (1) 서버의 `isValidState`가 `activePiece` 구조를 검증하지 않아 악의적 클라이언트가 다른 클라이언트의 렌더링을 크래시시킬 수 있으며, (2) `BOARD_ROWS/BOARD_COLS` 상수의 이중화로 게임 설정 변경 시 클라이언트-서버 계약이 자동으로 깨질 수 있다. 나머지 발견사항들은 계약 문서화 품질과 불필요한 트래픽 측면의 개선점이다.

### 위험도
**MEDIUM**