# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 테스트 커버리지 심각 불균형 및 서버 측 점수 검증 부재로 인한 보안/품질 위험

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 클라이언트가 보고하는 `score`를 서버가 그대로 신뢰하여 순위 산정에 사용. 악의적 클라이언트가 `score: 999999999` 전송 시 항상 1위 획득 가능 | `server.mjs` — `handleStateUpdate()`, `checkRoundEnd()` | 서버 측 독립 점수 추적 또는 이전 점수 대비 증가분의 물리적 유효성 검증 |
| 2 | 테스팅 | 게임 핵심 순수 함수 모듈(`collision.ts`, `board.ts`, `rotation.ts`, `scoring.ts`) 테스트 전무. `isValidPosition`, `clearLines`, `tryRotate`, `calculateScore` 등 부수효과 없는 함수들이 완전히 미검증 | `lib/tetris/collision.ts`, `board.ts`, `rotation.ts`, `scoring.ts` | 각 모듈별 `__tests__` 파일 생성. 경계값·wall kick·다중 라인 클리어 케이스 우선 커버 |
| 3 | 테스팅 | `gameEngine.test.ts`가 가드 조건(paused/gameOver)만 검증하고 실제 이동·드랍·락킹 동작은 전혀 미검증. `getGhostRow`도 테스트 없음 | `lib/tetris/__tests__/gameEngine.test.ts` | `moveLeft`, `softDrop`, `hardDrop`, `rotate`의 실제 상태 변경 결과 검증 테스트 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안·유지보수 | `BOARD_ROWS=22`, `BOARD_COLS=10`, `MAX_PLAYERS=5` 상수가 `server.mjs`와 `lib/tetris/constants.ts`/`lib/multiplayer/types.ts`에 중복 정의. 변경 시 불일치로 클라이언트 상태 전체 거부 발생 가능 | `server.mjs:31-34`, `lib/tetris/constants.ts`, `lib/multiplayer/types.ts` | `lib/tetris/constants.mjs` 공유 파일 추출 후 양쪽에서 import |
| 2 | 보안 | `isValidState()`가 `activePiece`의 `shape`, `row`, `col`, `type` 구조를 검증하지 않아 비정상 배열이 broadcast되면 다른 클라이언트 `OpponentBoard` 렌더링에서 런타임 오류 발생 가능 | `server.mjs` — `isValidState()` | `activePiece` non-null 시 `type` 유효성, `shape` 배열-의-배열 최소 검증 추가 |
| 3 | 보안 | 동일 WebSocket 연결에서 `create_session` / `join_session`을 중복 호출해도 `conn.playerId` 기존 설정 여부 검사 없음. 새 플레이어 ID·세션이 중복 생성됨 | `server.mjs` — `handleCreateSession()`, `handleJoinSession()` | 두 핸들러 앞에 `if (conn.playerId) return;` 가드 추가 |
| 4 | 보안 | WebSocket 암호화 미적용(ws://). 세션 비밀번호·플레이어 이름·게임 상태가 평문 전송 | `server.mjs`, `useMultiplayer.ts` | 프로덕션 배포 시 TLS 종단(wss://) 권고. 현재 LAN 전용임을 문서화 |
| 5 | 테스팅 | `useMultiplayer.test.ts`가 모듈 import 여부만 확인하는 사실상 무의미한 smoke test. 상태 전환·WebSocket 메시지 처리·throttle 동작 미검증 | `app/hooks/__tests__/useMultiplayer.test.ts` | WebSocket 모킹 후 `session_created`, `join_result`, `round_end` 메시지 핸들링 및 phase 전환 테스트 추가 |
| 6 | 테스팅 | `server.mjs`의 `isValidState`, `checkRoundEnd`, 패스워드 검증, rate limiting 로직 테스트 전무 | `server.mjs` | 순수 검증 함수를 별도 모듈로 분리하여 단위 테스트 추가 |
| 7 | 요구사항 | `phase === "result"` 이면서 `rankings === null`인 경우 playing phase UI로 폴스루. `round_end` 메시지를 rankings 없이 수신하거나 상태 불일치 시 게임 보드가 노출됨 | `app/components/MultiplayerGame.tsx` — result 분기 | `phase === "result"` 조건 단독 분리, rankings null 시 로딩/에러 상태 표시 |
| 8 | 요구사항 | `mp.players.filter((p) => p.id !== mp.playerId)`에서 `playerId`가 null이면 모든 플레이어가 opponent로 분류되어 자신의 보드도 상대방 목록에 표시됨 | `app/components/MultiplayerGame.tsx` — playing phase opponents 계산 | `if (!mp.playerId) return <LoadingState />;` 가드 추가 |
| 9 | 요구사항 | `playerId`가 null(서버 응답 전)인 동안 `options.role === "host"` 폴백으로 `isHost === true`가 되어 "Start Game" 버튼이 연결 확인 전에 노출됨 | `app/hooks/useMultiplayer.ts` — `isHost` 파생 계산 | `isHost` 초기값 `false`로 설정, `session_created` 수신 후에만 `true` 전환 |
| 10 | 부작용 | 예상치 못한 WebSocket 종료 시 `onclose`가 `isConnected: false`만 초기화하고 `phase`, `players`, `opponentStates` 등을 stale 상태로 유지. `disconnect()`와 동작 불일치 | `app/hooks/useMultiplayer.ts` — `ws.onclose` 핸들러 | `onclose`에서 phase를 `"lobby"`로, players를 `[]`로 재설정하거나 명시적 에러 상태 표시 |
| 11 | 부작용 | `session.players.delete()` 후 `checkRoundEnd()` 호출로 연결 해제된 플레이어의 점수가 rankings 계산에서 제외됨. 2인 플레이 중 1인 이탈 시 불완전한 순위 결과 전송 | `server.mjs` — `handleClose()` | 연결 해제 전 플레이어 최종 상태를 rankings 계산용으로 별도 보존 |
| 12 | 부작용 | `handleKeyDown`에서 `Space`/`Enter`의 `preventDefault`가 게임 상태와 무관하게 항상 실행. 게임 시작 전·종료 후·일시정지 중에도 페이지 스크롤·버튼 기본 동작 차단 | `app/components/TetrisGame.tsx` — `handleKeyDown` | 게임 활성 상태(`isStarted && !isGameOver`)일 때만 `preventDefault` 호출 |
| 13 | 성능 | `GameBoard.tsx`에서 매 틱마다 canvas 크기(`width`/`height`) 재설정 및 그리드 선 전체 재렌더링. `OpponentBoard.tsx`는 크기 초기화(`[]`)와 드로잉(`[state]`) useEffect를 이미 올바르게 분리 | `app/components/GameBoard.tsx:27-50` | 크기 초기화 `useEffect([], [])` 분리, 드로잉 로직만 `useEffect([gameState])` 유지 |
| 14 | 성능 | `TetrisGame.tsx`의 `onStateChangeRef` 업데이트 useEffect에 의존성 배열 없어 매 렌더마다 실행 | `app/components/TetrisGame.tsx:40-42` | `useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange])` 또는 렌더 중 직접 ref 할당 |
| 15 | 유지보수 | `GameBoard.tsx`와 `OpponentBoard.tsx`의 셀 하이라이트/그림자 렌더링 로직 중복. 셀 스타일 변경 시 두 곳 동시 수정 필요 | `app/components/GameBoard.tsx:100-117`, `app/components/OpponentBoard.tsx` | `lib/tetris/canvas.ts`에 `drawCell(ctx, x, y, size, color)` 공용 함수 추출 |
| 16 | 유지보수 | `useMultiplayer.ts`의 `handleMessage` 콜백(~70줄)이 8개 switch-case를 인라인으로 처리. 새 메시지 타입 추가 시 단일 함수 집중 수정 필요 | `app/hooks/useMultiplayer.ts` — `handleMessage` | 케이스별 핸들러 함수(`handleSessionCreated` 등)로 분리 또는 reducer 패턴 적용 |
| 17 | 의존성 | TypeScript에서 `.mjs` 직접 re-export 시 타입 선언 파일 없으면 `calculateRankings` 타입이 `any`로 추론됨 | `lib/multiplayer/broadcast.ts:6` — `export { calculateRankings } from "./ranking.mjs"` | `ranking.d.mts` 타입 선언 파일 추가 또는 `ranking.ts`로 통일 |
| 18 | 아키텍처 | `TetrisGame.tsx`가 게임 상태 관리, 중력 타이머, 키보드 입력, 멀티플레이어 브로드캐스팅, 오버레이 렌더링을 단일 컴포넌트에서 처리(300+ 라인) | `app/components/TetrisGame.tsx` | 키보드 이벤트를 `useGameControls` 훅으로, 오버레이 UI를 별도 컴포넌트로 분리 |
| 19 | API 계약 | `state_broadcast`가 `broadcastAll`로 발신자 포함 전체 전송. 클라이언트가 자신의 ID를 필터링하지만 불필요한 네트워크 트래픽 발생 | `server.mjs` — `handleStateUpdate()` | `broadcast(session, ..., conn.playerId)`로 발신자 제외 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | `gameEngine.ts`의 일부 export 함수(`getGhostRow` 등) JSDoc 누락. `startGame`/`togglePause`와 일관성 불균형 | `lib/tetris/gameEngine.ts` | `getGhostRow`에 최소 한 줄 JSDoc 추가 |
| 2 | 문서화 | `server.mjs`의 `BOARD_ROWS`/`BOARD_COLS`가 `constants.ts`와 중복 정의된 이유 주석 없음 | `server.mjs:31-32` | `// Mirror of lib/tetris/constants — server can't import TS directly` 주석 추가 |
| 3 | 문서화 | README에 `PORT`, `NODE_ENV` 환경변수 및 멀티플레이어 실행 방법 미문서화 | 프로젝트 루트 | README에 환경변수 및 서버 실행 방법 명시 |
| 4 | 유지보수 | `GameBoard.tsx`가 `HIDDEN_ROWS` 상수 대신 로컬 `const hiddenRows = 2` 사용. `OpponentBoard.tsx`는 상수 import 사용으로 불일치 | `app/components/GameBoard.tsx:47` | `import { HIDDEN_ROWS } from "@/lib/tetris/constants"` 사용으로 통일 |
| 5 | 보안 | 플레이어 ID 엔트로피 낮음 (`crypto.randomBytes(4)` = 32비트). 세션 비밀번호(8바이트)와 강도 불일치 | `server.mjs` — `generateId()` | `randomBytes(8)`로 통일 |
| 6 | 보안 | 세션 비밀번호가 `{mp.sessionInfo.password}`로 화면에 평문 노출. 화면 공유 시 유출 가능 | `app/components/MultiplayerGame.tsx` | 비밀번호 가시성 토글 추가 고려 |
| 7 | 아키텍처 | `/ws` 경로가 `server.mjs`와 `useMultiplayer.ts` 양쪽에 하드코딩 | 두 파일 | 공유 상수 파일에 `WS_PATH = "/ws"` 정의 |
| 8 | 아키텍처 | `broadcast.ts`가 `toBroadcastState`(상태 변환)와 `calculateRankings` re-export를 동시 담당하여 SRP 위반 | `lib/multiplayer/broadcast.ts` | `calculateRankings`를 `ranking.mjs`에서 직접 import하거나 배럴 파일 활용 |
| 9 | 의존성 | `getRotations` 함수가 export되어 있으나 리뷰 대상 코드 어디에서도 사용되지 않는 dead export | `lib/tetris/tetrominoes.ts:143` | 미사용 확인 후 제거 또는 non-export로 변경 |
| 10 | 테스팅 | `toBroadcastState` 테스트에서 filled 셀의 color 매핑(filled=true → 색상 문자열) 미검증 | `lib/multiplayer/__tests__/broadcast.test.ts` | filled=true 셀이 올바른 색상 문자열을 반환하는지 검증 추가 |
| 11 | 테스팅 | `reducer.ts`의 RESTART 액션 등 reducer 고유 로직 단위 테스트 없음 | `lib/tetris/reducer.ts` | RESTART 액션의 초기화 동작 등 검증 |
| 12 | 요구사항 | `disconnect()` 시 `playerId` 상태 미초기화 | `app/hooks/useMultiplayer.ts` — `disconnect()` | `setPlayerId(null)` 추가 |
| 13 | API 계약 | `ServerMessage` 타입의 `player_joined.player` 단수 필드와 `host_transferred.newHostId` 필드가 클라이언트에서 미사용 | `lib/multiplayer/types.ts`, `useMultiplayer.ts` | 타입 정의와 실제 사용 일치시키거나 미사용 필드 문서화 |
| 14 | 동시성 | 레이트 리미터가 고정 윈도우 방식으로 윈도우 경계에서 버스트(최대 60개) 허용 | `server.mjs` — 메시지 핸들러 | 게임 트래픽(10fps) 상 실질 영향 낮으나, 슬라이딩 윈도우 또는 토큰 버킷 방식 고려 |
| 15 | 범위 | AI 에이전트 마커가 이중 중첩(`page.tsx`), 고아 닫힘 태그(`GameApp.tsx`), 순서 불일치(`TetrisGame.tsx`) 상태 | `app/page.tsx`, `app/components/GameApp.tsx`, `TetrisGame.tsx` | CLAUDE.md 규정 준수하되, 향후 마커는 의미 단위 경계에 배치하는 가이드라인 수립 |
| 16 | 유지보수 | `ModeSelection.tsx` password `<input>`이 다른 입력 필드의 멀티라인 포맷과 불일치 | `app/components/ModeSelection.tsx` | 기존 코드 스타일에 맞게 포맷팅 정리 및 `maxLength` 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM~HIGH | 클라이언트 점수 무조건 신뢰, isValidState 불완전, 세션 중복 생성 가드 누락 |
| testing | HIGH | 핵심 순수 함수 모듈 테스트 전무, gameEngine 테스트가 가드 조건만 검증 |
| api_contract | MEDIUM | activePiece 서버 검증 누락, 상수 중복으로 계약 불일치 위험 |
| requirement | MEDIUM | result phase rankings null 폴스루, opponents 계산 오류, isHost 조기 노출 |
| side_effect | MEDIUM | WebSocket 비정상 종료 시 stale 상태, 키 이벤트 무조건 preventDefault |
| concurrency | LOW | 플레이어 이탈 시 불완전 rankings, 고정 윈도우 레이트 리밋 버스트 |
| performance | LOW | GameBoard canvas 크기 매 틱 재설정, onStateChangeRef 의존성 배열 누락 |
| architecture | LOW | 상수 중복, God Component(TetrisGame), canvas 드로잉 로직 중복 |
| maintainability | LOW | 상수 중복, 셀 드로잉 중복, handleMessage 복잡도 |
| dependency | LOW | .mjs/.ts 혼용으로 타입 안전성 공백, MAX_PLAYERS 중복 |
| documentation | LOW | 일부 JSDoc 누락, 환경변수 문서화 미흡, 상수 중복 이유 미명시 |
| scope | LOW | AI 마커 정합성 오류, broadcastAll 발신자 포함 |
| database | NONE | 해당 없음 (DB 미사용 프로젝트) |

---

## 발견 없는 에이전트

| 에이전트 |
|----------|
| database |

---

## 권장 조치사항

1. **[즉시] 서버 측 점수 검증 도입** — 클라이언트 보고 점수를 맹목적으로 신뢰하지 않도록 이전 점수 대비 증가분 유효성 검증 또는 서버 독립 추적 구현
2. **[즉시] 핵심 순수 함수 테스트 작성** — `collision.ts`, `board.ts`, `rotation.ts`, `scoring.ts` 모듈 `__tests__` 파일 생성. `gameEngine.test.ts`에 실제 이동·드랍·락킹 동작 검증 추가
3. **[단기] 공유 상수 파일 추출** — `lib/tetris/constants.mjs` 생성으로 `server.mjs`와 클라이언트 간 `BOARD_ROWS`, `BOARD_COLS`, `MAX_PLAYERS` 단일 소스화
4. **[단기] `isValidState` 강화** — `activePiece` 구조(shape 배열, row/col 범위, type 유효성) 검증 추가
5. **[단기] `MultiplayerGame.tsx` result/opponents 버그 수정** — `rankings === null` 폴스루 처리, `playerId === null` 시 opponents 계산 가드 추가
6. **[단기] WebSocket 비정상 종료 처리** — `onclose`에서 phase/players 상태 초기화하여 `disconnect()`와 동작 일관성 확보
7. **[단기] 세션 중복 생성 가드** — `handleCreateSession`, `handleJoinSession` 앞에 `if (conn.playerId) return;` 추가
8. **[단기] `GameBoard.tsx` canvas 최적화** — `OpponentBoard.tsx` 패턴대로 크기 초기화와 드로잉 useEffect 분리, `HIDDEN_ROWS` 상수 import 통일
9. **[중기] 셀 드로잉 유틸리티 추출** — `lib/tetris/canvas.ts`에 공용 `drawCell` 함수로 `GameBoard`·`NextPiece`·`OpponentBoard` 중복 제거
10. **[중기] `.mjs` 파일 타입 선언 보완** — `ranking.d.mts`, `sanitize.d.mts` 추가 또는 JSDoc 타입 어노테이션으로 타입 안전성 확보