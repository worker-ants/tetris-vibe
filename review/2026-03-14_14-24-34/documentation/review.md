## 문서화 코드 리뷰

### 발견사항

- **[CRITICAL]** `types.ts` 중첩 AI 생성 주석 오염
  - 위치: `types.ts` 상단/하단 (3개 중첩)
  - 상세: 파일 상단에 3개의 `[worker-ants]` 오프닝 마커가 누적되어 있고, 하단에도 3개의 클로징 마커가 역순으로 쌓여 있음. 이는 코드 히스토리가 아닌 노이즈로, 파일의 실제 내용을 파악하기 어렵게 만듦
  - 제안: 중복된 마커를 정리하고, 변경 이력은 git 히스토리에 위임

- **[WARNING]** `startGame()` 함수에 JSDoc 없음
  - 위치: `gameEngine.ts:168-171`
  - 상세: 공개 API로 export되는 함수임에도 파라미터, 반환값, 가드 조건(`isStarted`, `isGameOver` 체크)에 대한 문서 없음. 특히 이미 시작된 게임에서 호출 시 멱등성(idempotent)을 보장한다는 점이 문서화되어 있지 않음
  - 제안:
    ```ts
    /**
     * Transitions the game from the initial idle state to the active playing state.
     * No-op if the game has already started or is over.
     */
    export function startGame(state: GameState): GameState { ... }
    ```

- **[WARNING]** `GameState.isStarted` 필드 문서 없음, 상태 머신 미명시
  - 위치: `types.ts:30`
  - 상세: `isStarted`와 `isPaused`의 조합이 만드는 상태 머신이 문서화되어 있지 않음. 특히 `initGame()`에서 `isPaused: true`로 초기화하는 것은 "일시정지"가 아닌 "미시작" 상태를 표현하는 것인데, 이 의미 혼용이 코드만 봐서는 명확하지 않음
  - 제안: 인터페이스에 상태 전이 설명 추가
    ```ts
    /**
     * State machine:
     * isStarted=false, isPaused=true  → idle (initial)
     * isStarted=true,  isPaused=false → playing
     * isStarted=true,  isPaused=true  → paused
     * isGameOver=true                 → game over
     */
    export interface GameState { ... }
    ```

- **[WARNING]** `togglePause()` 동작 변경 후 주석 미갱신
  - 위치: `gameEngine.ts:173-175`
  - 상세: `!state.isStarted` 가드가 추가되어 동작이 변경되었으나, 이 조건의 의도가 설명되지 않음. `startGame()` 이전에는 일시정지 토글이 불가하다는 사실이 명시적으로 문서화되어 있지 않음
  - 제안: 간단한 인라인 주석으로 `// Cannot pause before the game has started` 추가

- **[INFO]** `ControlsInfo.tsx` "Start / Hard Drop" 이중 의미 미설명
  - 위치: `ControlsInfo.tsx:10`
  - 상세: Space 키가 게임 시작 전에는 "Start", 게임 중에는 "Hard Drop"으로 동작하는 컨텍스트 의존적 동작이지만, UI에서 슬래시(/)로만 구분하여 사용자에게 혼란을 줄 수 있음. 코드 수준에서도 이 이중 역할에 대한 주석이 없음
  - 제안: 주석으로 `// Space key is context-sensitive: starts game when idle, hard drops when playing` 추가

- **[INFO]** `handleKeyDown` 의존성 배열 변경 미문서화
  - 위치: `TetrisGame.tsx:130`
  - 상세: `useCallback` 의존성에 `state.isStarted`가 추가되었으나 왜 이 상태가 필요한지 설명 없음. 새로운 분기 로직이 추가되면서 의존성이 변경되었음을 명시하면 향후 유지보수에 도움
  - 제안: 의존성 배열 위에 `// Re-bind when game state changes to handle context-sensitive keys` 주석 추가

- **[INFO]** CHANGELOG 또는 prompts.md 기능 설명 부족
  - 위치: `prompts/prompts.md`
  - 상세: turn 2 프롬프트는 요구사항만 기록하고 있으며, 구현된 게임 플로우(idle → started → paused → game over)나 새로 추가된 UI 요소(Start 오버레이, 일시정지 버튼 패널)에 대한 설명이 없음. 개발 히스토리 추적 목적이라면 구현 결과도 함께 기록하는 것이 좋음

---

### 요약

이번 변경은 게임 시작/일시정지/재시작 상태 관리를 추가하는 기능 확장으로, 로직 자체는 명확하게 구현되어 있습니다. 그러나 문서화 관점에서는 몇 가지 중요한 문제가 있습니다. 가장 심각한 것은 `types.ts`에 AI 생성 마커가 3겹으로 중첩되어 파일 가독성을 크게 해치는 것이며, `startGame()`과 `GameState` 인터페이스에 상태 머신 전이에 대한 JSDoc이 없어 `isStarted`와 `isPaused`의 조합 의미를 코드만으로는 파악하기 어렵습니다. 특히 초기 상태에서 `isPaused: true`를 "미시작"을 표현하는 데 재사용하는 패턴은 문서 없이는 혼란을 유발합니다.

### 위험도

**MEDIUM**