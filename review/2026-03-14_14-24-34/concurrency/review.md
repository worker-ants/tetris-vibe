## 발견사항

- **[WARNING]** `tick()` 함수의 `isStarted` 가드 누락
  - 위치: `lib/tetris/gameEngine.ts` — `tick()` 함수
  - 상세: `tick`은 `isGameOver || isPaused`만 체크하고 `isStarted`는 확인하지 않는다. 현재는 `initGame()`이 `isPaused: true`로 설정하므로 동작에 문제가 없으나, `isStarted: false`이면서 `isPaused: false`인 상태가 생기면 (예: 향후 리팩터링, 버그, 직접 dispatch 등) 게임이 시작되지 않은 상태에서 피스가 이동한다.
  - 제안: `if (state.isGameOver || state.isPaused || !state.isStarted) return state;`

- **[WARNING]** gravity tick effect의 `isStarted` 의존성 누락
  - 위치: `app/components/TetrisGame.tsx` — gravity tick `useEffect`
  - 상세: `useEffect` 의존 배열이 `[state.level, state.isGameOver, state.isPaused]`이고 `state.isStarted`가 없다. 타이머가 시작되지 않는 것은 `isPaused: true`로 우회되는 암묵적 커플링에 의존하는 것이다. 두 상태 간의 결합이 코드에서 명시되지 않아 유지보수 중 실수할 수 있다.
  - 제안: effect 내부에 `if (!state.isStarted) return;` 조건을 추가하고 의존 배열에 `state.isStarted` 포함.

- **[INFO]** `handleKeyDown`의 stale closure는 현재 안전하지만 취약하다
  - 위치: `app/components/TetrisGame.tsx` — `useCallback` 의존 배열 `[state.isGameOver, state.isStarted]`
  - 상세: `setInterval` TICK과 keyboard 이벤트는 단일 스레드 이벤트 루프에서 순차 처리되므로 실제 race condition은 없다. 그러나 `Space` 키가 게임 오버 시 RESTART, 미시작 시 START, 진행 중에는 HARD_DROP 세 가지로 분기되는데, 상태 전환 직후에 빠르게 Space를 누르면 이전 렌더에서 캡처된 클로저로 인해 의도치 않은 액션이 한 프레임 지연 처리될 수 있다. React 단일 스레드 모델에서는 실질적 영향이 거의 없으나, `useReducer`의 `dispatch`가 최신 상태를 기준으로 동작하므로 클로저보다 reducer 내부에서 상태 검증을 강화하는 것이 더 견고하다.
  - 제안: reducer의 `START`/`RESTART` 케이스에서 현재 상태를 재검증하는 방어 로직 유지 (현재 `startGame`에서 `isStarted` 체크 존재 — 적절함).

---

### 요약

이 코드는 JavaScript 단일 스레드 + React `useReducer` 패턴을 사용하므로, OS 수준의 경쟁 조건·데드락·뮤텍스 문제는 해당 없다. 주요 동시성 관련 위험은 `isStarted`와 `isPaused` 상태 간의 **암묵적 커플링**에 있다. 현재 구현에서 `initGame()`의 `isPaused: true`가 사실상 "아직 시작 안 됨" 역할을 겸하고 있어, `tick()` 및 gravity effect가 `isStarted`를 직접 체크하지 않아도 동작한다. 이는 현 시점에서는 버그를 유발하지 않지만, 코드 진화 시 방어 로직의 공백이 될 수 있다.

### 위험도
**LOW**