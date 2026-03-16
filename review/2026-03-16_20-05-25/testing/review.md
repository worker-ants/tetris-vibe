### 발견사항

- **[CRITICAL]** 핵심 순수 함수 모듈들의 테스트 완전 부재
  - 위치: `lib/tetris/collision.ts`, `lib/tetris/board.ts`, `lib/tetris/rotation.ts`, `lib/tetris/scoring.ts`
  - 상세: `isValidPosition`, `placePiece`, `clearLines`, `tryRotate`, `calculateScore`, `getLevel`, `getDropInterval` 등 게임의 핵심 로직이 전혀 테스트되지 않음. 이 함수들은 부수효과 없는 순수함수라 테스트하기 가장 쉬운 대상임에도 불구하고 누락.
  - 제안: 각 모듈별 `__tests__` 파일 생성. 특히 `clearLines`의 1~4줄 동시 클리어, `tryRotate`의 wall kick 동작, `isValidPosition`의 경계값(음수 row, 보드 밖 col) 케이스를 우선 커버.

- **[CRITICAL]** `gameEngine.test.ts`에서 실제 이동/드랍 동작 미검증
  - 위치: `lib/tetris/__tests__/gameEngine.test.ts`
  - 상세: `moveLeft`, `moveRight`, `softDrop`, `hardDrop`, `rotate`의 가드 조건(paused/gameOver/!started)만 검증하고, 실제 동작(column 변경, score 증가, 피스 락킹, 게임오버 전환)은 전혀 테스트 없음. `getGhostRow`도 export되어 있으나 테스트 파일에 없음.
  - 제안:
    ```ts
    it("moveLeft decreases col by 1 when space available", () => {
      const state = runningState();
      const originalCol = state.activePiece.col;
      const result = moveLeft(state);
      expect(result.activePiece.col).toBe(originalCol - 1);
    });
    
    it("softDrop adds SOFT_DROP_POINTS to score", () => {
      const state = runningState();
      const result = softDrop(state);
      expect(result.score).toBe(SOFT_DROP_POINTS);
    });
    
    it("hardDrop locks piece and spawns next", () => {
      const state = runningState();
      const result = hardDrop(state);
      expect(result.score).toBeGreaterThan(0);
      expect(result.activePiece).not.toBe(state.activePiece);
    });
    ```

- **[WARNING]** `useMultiplayer.test.ts`가 사실상 무의미한 smoke test
  - 위치: `app/hooks/__tests__/useMultiplayer.test.ts`
  - 상세: 모듈 import 가능 여부만 확인. 훅의 상태 전환(lobby→playing→result), WebSocket 메시지 처리, 재연결, throttle 동작 등 핵심 로직이 전혀 테스트되지 않음.
  - 제안: `@testing-library/react-hooks`와 `vitest`의 `vi.fn()`으로 WebSocket을 모킹하여 `session_created`, `join_result`, `round_end` 메시지 핸들링과 phase 전환 테스트 추가.

- **[WARNING]** `server.mjs`의 서버 사이드 로직 테스트 전무
  - 위치: `server.mjs`
  - 상세: `isValidState`, `checkRoundEnd`, `handleJoinSession`(패스워드 검증, 만원 세션), `touchSession` debounce, rate limiting 로직이 모두 미검증. 특히 `isValidState`는 악의적 입력으로부터 서버를 보호하는 보안 함수.
  - 제안: 서버 로직을 별도 모듈로 분리하거나, `isValidState` 같은 순수 검증 함수만이라도 단위 테스트 추가.

- **[WARNING]** `ModeSelection` 컴포넌트의 입력 검증 로직 미검증
  - 위치: `app/components/ModeSelection.tsx`
  - 상세: Guest 입장 시 `isValidWsUrl` 검증과 버튼 disabled 조건이 복잡하게 조합되어 있으나, 컴포넌트 레벨 테스트 없음. `@testing-library/react`로 렌더링 후 입력 흐름 검증 필요.
  - 제안: 빈 playerName으로 Join 버튼이 disabled 상태인지, 유효하지 않은 WebSocket URL 입력 시 에러 메시지가 표시되는지 테스트.

- **[INFO]** `toBroadcastState` 테스트에서 filled 셀의 color 매핑 미검증
  - 위치: `lib/multiplayer/__tests__/broadcast.test.ts`
  - 상세: 빈 셀 → null 변환은 테스트되어 있으나, filled=true인 셀이 color 문자열로 올바르게 변환되는지 검증 없음.
  - 제안: `placePiece`로 피스를 놓은 후 `toBroadcastState` 호출 시 해당 셀이 색상 문자열을 반환하는지 검증.

- **[INFO]** `reducer.ts` 단위 테스트 없음
  - 위치: `lib/tetris/reducer.ts`
  - 상세: `gameReducer`의 RESTART 액션이 `isStarted: true, isPaused: false`로 초기화되는지 등 reducer 레벨 검증 없음. gameEngine 테스트와 중복될 수 있으나, RESTART 등 reducer 고유 로직은 별도 검증 가치 있음.

---

### 요약

테스트 커버리지가 심각하게 불균형합니다. `calculateRankings`, `isValidWsUrl`, `sanitizeName`, `toBroadcastState`같은 유틸리티 함수들은 잘 커버되어 있으나, 게임의 실제 핵심 로직인 `collision`, `board`, `rotation`, `scoring` 모듈은 테스트가 전혀 없습니다. `gameEngine.test.ts`는 가드 조건만 검증하고 실제 이동·드랍·락킹 동작을 검증하지 않아 리그레션 안전망으로서 기능이 매우 제한적입니다. `useMultiplayer` 훅과 서버 로직도 사실상 미테스트 상태입니다. 순수함수들부터 우선 테스트를 보강하고, 이후 훅·컴포넌트 레이어로 확장하는 것을 권장합니다.

### 위험도
**HIGH**