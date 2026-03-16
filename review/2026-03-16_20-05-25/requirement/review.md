## 요구사항 코드 리뷰

### 발견사항

---

**[WARNING]** `server.mjs` 보드 크기 상수 중복 정의
- 위치: `server.mjs:31-32` (`BOARD_ROWS = 22`, `BOARD_COLS = 10`)
- 상세: `lib/tetris/constants.ts`에 이미 정의된 `BOARD_ROWS`/`BOARD_COLS`를 서버에서 별도로 하드코딩. `isValidState()`의 보드 검증이 실제 게임 상수와 독립적으로 존재함. 보드 크기 변경 시 서버 검증이 자동으로 업데이트되지 않음.
- 제안: `ranking.mjs`처럼 서버에서 상수를 임포트하거나 별도 공유 파일로 추출

---

**[WARNING]** `MultiplayerGame.tsx` — `phase === "result"` + `rankings === null` 미처리
- 위치: `MultiplayerGame.tsx` result 분기
- 상세: `if (mp.phase === "result" && mp.rankings)` 조건에서 rankings가 null인 채 result phase인 경우 playing phase UI로 폴스루. `round_end` 메시지가 rankings 없이 수신되거나 상태 불일치 시 게임 보드가 그대로 노출됨.
- 제안: `phase === "result"` 단독 조건으로 분리하고 rankings null은 로딩/에러 상태 표시

---

**[WARNING]** `useMultiplayer.ts` — 연결 전 `isHost` 조기 노출
- 위치: `useMultiplayer.ts:isHost` 파생 계산
- 상세: `playerId`가 null인 동안(서버 응답 전) `options.role === "host"` 폴백으로 `isHost === true`가 됨. 이로 인해 lobby UI에서 "Start Game" 버튼이 연결 확인 전에 렌더링될 수 있음. 실제 클릭 시 `wsRef.current`가 아직 ready 상태가 아닐 수 있음.
- 제안: `isHost` 초기값을 `false`로 설정하고 `session_created` 수신 후에만 true로 전환

---

**[WARNING]** `server.mjs` — `isValidState()`에서 `activePiece` 구조 미검증
- 위치: `server.mjs:isValidState()` 함수
- 상세: 보드, score, level, linesCleared는 검증하지만 `activePiece`가 non-null일 때 `shape`, `row`, `col`, `type`의 유효성은 검증하지 않음. 비정상 shape 배열이 포함된 상태가 broadcast되어 다른 클라이언트의 OpponentBoard 렌더링에서 예외 발생 가능.
- 제안: `activePiece`가 non-null이면 `type`이 유효한 PieceType인지, `shape`이 배열의 배열인지 최소 검증 추가

---

**[WARNING]** `MultiplayerGame.tsx` — `mp.playerId`가 null일 때 opponents 계산 오류
- 위치: `MultiplayerGame.tsx` playing phase의 `opponents` 계산
- 상세: `mp.players.filter((p) => p.id !== mp.playerId)`에서 `playerId`가 null이면 모든 플레이어가 opponent로 필터링됨(`p.id !== null`은 항상 true). 자신의 게임 보드도 opponent 목록에 표시될 수 있음.
- 제안: `if (!mp.playerId) return <LoadingState />;` 가드 추가 또는 playing phase 진입 시 playerId 필수 보장

---

**[INFO]** `ModeSelection.tsx` — 패스워드 필드에 `maxLength` 누락
- 위치: `ModeSelection.tsx` password `<input>`
- 상세: playerName에는 `maxLength={16}`이 있지만 password 필드에는 없음. 서버의 `findSessionByPassword`는 O(1) 해시맵 조회이므로 기능상 문제는 없으나 UI 일관성 부재.
- 제안: `maxLength={32}` 정도 추가

---

**[INFO]** `rotation.ts` — 간소화된 Wall Kick (표준 SRS 미구현)
- 위치: `rotation.ts:STANDARD_OFFSETS`, `I_EXTRA_OFFSETS`
- 상세: 표준 Tetris SRS wall kick table 대신 단순화된 4방향 + I피스 2방향 오프셋만 시도. 일부 회전 시나리오(T-spin 등)에서 표준과 다른 동작.
- 제안: 요구사항에 SRS 준수가 포함된다면 공식 SRS 테이블로 교체 필요. 클래식 스타일 허용이면 현재 구현 유지 가능

---

**[INFO]** `useMultiplayer.ts` — `disconnect()` 시 `playerId` 미초기화
- 위치: `useMultiplayer.ts:disconnect()` 콜백
- 상세: disconnect 시 phase, players, opponentStates 등은 초기화하지만 `playerId` 상태는 초기화하지 않음. 실제로 disconnect는 컴포넌트 언마운트 전에 호출되므로 실용적 문제는 없으나 함수의 완전성 측면에서 갭 존재.
- 제안: `setPlayerId(null)` 추가

---

### 요약

전체적으로 요구사항 구현 완성도는 높으며 단일/멀티플레이어 게임, 로비, 결과 화면, WebSocket 통신, 서버 보안(rate limiting, origin validation, state validation)이 체계적으로 구현되어 있습니다. 다만 두 가지 실질적 결함이 존재합니다: (1) 서버와 클라이언트 간 보드 크기 상수 분리로 인한 유지보수 위험, (2) result phase에서 rankings null 시 폴스루 UI 버그. multiplayer 상태 파생(`isHost`, `opponents`)이 서버 응답을 받기 전의 초기 상태를 제대로 처리하지 못하는 부분도 개선이 필요합니다. 나머지 게임 로직(collision, board, scoring, reducer)은 요구사항을 정확히 반영하고 있고 테스트 커버리지도 적절합니다.

### 위험도

**MEDIUM**