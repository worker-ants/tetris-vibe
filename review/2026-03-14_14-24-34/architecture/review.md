### 발견사항

- **[WARNING]** `isPaused`를 "미시작" 상태의 대리 플래그로 재사용
  - 위치: `gameEngine.ts:initGame()` — `isPaused: true, isStarted: false`
  - 상세: 초기 상태에서 `isPaused: true`로 게임 틱을 막는 방식은, `tick()`/`moveLeft()` 등 모든 엔진 함수의 `isPaused` 가드에 의존합니다. 의미론적으로 "일시정지"와 "미시작"은 다른 상태이나 같은 플래그로 표현되어 있습니다. 누군가 `initGame()`의 초기값을 `isPaused: false`로 변경하면 게임이 시작 화면에서도 즉시 틱을 실행합니다.
  - 제안: `status: 'idle' | 'running' | 'paused' | 'gameover'` 형태의 명시적 상태 머신으로 전환하거나, 최소한 `useEffect`의 틱 조건에 `|| !state.isStarted`를 명시적으로 추가해 암묵적 의존을 제거

- **[WARNING]** `useEffect` 틱 조건에서 `isStarted` 미참조
  - 위치: `TetrisGame.tsx:55-62`
  - 상세: `if (state.isGameOver || state.isPaused) return;`는 현재 `isPaused: true`가 미시작 상태를 덮어주기 때문에 우연히 동작합니다. `state.isStarted`가 의존성 배열(`[state.level, state.isGameOver, state.isPaused]`)에도 없어, 향후 `isStarted` 상태 변화 시 effect가 재실행되지 않을 수 있습니다.
  - 제안: `if (state.isGameOver || state.isPaused || !state.isStarted) return;`으로 수정하고 `state.isStarted`를 의존성 배열에 추가

- **[INFO]** `types.ts` 상단 중첩 AI 마커 오염
  - 위치: `types.ts:1-3`
  - 상세: 동일 파일에 3개의 `[worker-ants]` 블록이 순차적으로 중첩되어 있습니다. 코드 자체의 문제는 아니지만 파일 경계 관리 없이 반복 수정이 이루어졌음을 보여주며, 파일이 누적될수록 노이즈가 심화됩니다.
  - 제안: 마커 정리 또는 단일 최상위 마커로 통합

- **[INFO]** `gameReducer`가 컴포넌트 파일 내부에 위치
  - 위치: `TetrisGame.tsx:27-47`
  - 상세: 현재 규모에서는 허용 가능하지만, `gameReducer`는 순수 비즈니스 로직으로 `lib/tetris/` 레이어에 위치하는 것이 레이어 책임 분리 원칙에 부합합니다. `gameEngine.ts`의 함수들은 이미 같은 레이어에 있습니다.
  - 제안: `lib/tetris/reducer.ts`로 분리 고려 (필수는 아님)

- **[INFO]** `ControlsInfo.tsx`의 컨트롤 데이터가 실제 키 처리 로직과 비동기화될 수 있는 구조
  - 위치: `ControlsInfo.tsx:3-11`
  - 상세: `CONTROLS` 상수는 하드코딩된 문자열이며, `TetrisGame.tsx`의 실제 `handleKeyDown` 로직과 독립적으로 관리됩니다. 키 바인딩이 변경될 경우 두 곳을 동시에 수정해야 합니다.
  - 제안: 단순 게임이므로 즉각적 리팩터링은 불필요하나, 향후 키 커스터마이징 기능 추가 시 단일 키 맵 상수에서 파생하는 구조로 전환 필요

---

### 요약

이번 변경은 게임 시작/일시정지 기능을 추가하는 목적에 맞게 타입-엔진-컴포넌트 레이어 경계를 대체로 잘 유지하고 있습니다. 그러나 핵심 설계 문제는 `isPaused`가 "미시작"과 "일시정지"라는 두 가지 의미를 암묵적으로 담게 된 점입니다. 현재는 초기화 로직과 틱 가드가 우연히 맞아떨어져 동작하지만, 이는 명시적 상태 머신(`idle/running/paused/gameover`)이 없는 데서 오는 취약한 결합입니다. `useEffect` 의존성 누락과 함께 이 부분이 향후 버그의 진원지가 될 가능성이 높습니다.

---

### 위험도

**MEDIUM**