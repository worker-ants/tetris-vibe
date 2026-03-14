### 발견사항

- **[INFO]** JSX 인라인 화살표 함수 반복 생성
  - 위치: `TetrisGame.tsx` - 새로 추가된 버튼들의 `onClick` 핸들러
  - 상세: `onClick={() => dispatch({ type: "START" })}` 형태의 인라인 함수가 매 렌더마다 새로운 함수 인스턴스를 생성함. 게임이 매 tick마다 리렌더되므로(level 0 기준 약 1초 간격), 버튼이 보이는 동안 지속적으로 새 함수 객체가 할당됨.
  - 제안: 오버레이/버튼이 커스텀 메모이즈된 컴포넌트가 아닌 일반 DOM 요소이므로 실질적 영향은 미미함. 필요하다면 `useCallback`으로 dispatch 래퍼를 고정할 수 있으나 현재 규모에서는 불필요.

- **[INFO]** `handleKeyDown` 이벤트 리스너 재등록 비용
  - 위치: `TetrisGame.tsx:130` - `useCallback` 의존성 배열 `[state.isGameOver, state.isStarted]`
  - 상세: `isGameOver` 또는 `isStarted` 변경 시 이벤트 리스너가 제거·재등록됨. 이전 코드 대비 의존성이 하나 추가되었으나, 두 값 모두 게임 생명주기에서 몇 번만 변경되므로 실질적 부담은 없음.
  - 제안: 현재 구조 유지. 대안으로 `useRef`에 최신 상태를 유지하는 패턴을 쓰면 리스너 재등록 없이 처리 가능하나 과도한 최적화임.

- **[INFO]** gravity tick 의존성에 `isStarted` 누락
  - 위치: `TetrisGame.tsx` - 첫 번째 `useEffect` 의존성 `[state.level, state.isGameOver, state.isPaused]`
  - 상세: `isStarted: false` 일 때 `isPaused: true`로 설정되어 tick이 차단되므로 동작상 문제는 없음. 그러나 의존성에 `isStarted`가 없어 의도가 불명확하고, 향후 `startGame` 로직이 변경될 경우 잠재적 버그 유입 가능성 존재.
  - 제안: `if (state.isGameOver || state.isPaused || !state.isStarted) return;` 형태로 명시적 가드를 추가하고 `isStarted`를 의존성에 포함하면 코드 의도가 명확해짐.

- **[INFO]** `types.ts` 중복 주석 헤더
  - 위치: `types.ts` 1~3행
  - 상세: `// [worker-ants] generated` 주석이 3중으로 중첩됨. 런타임 성능 영향은 없으나 파일 파싱 노이즈.
  - 제안: 가장 바깥쪽 블록 주석만 유지.

---

### 요약

이번 변경은 게임 시작 전 대기 상태(`isStarted: false`)를 추가하는 기능으로, 성능 관점에서 위험도가 낮다. `isPaused: true` 초기값이 tick 루프를 차단하므로 게임 미시작 시 불필요한 연산이 발생하지 않으며, 새로 추가된 `startGame`/`togglePause` 함수는 모두 O(1) 상태 스프레드 연산이다. 렌더 성능 측면에서 인라인 dispatch 함수와 이벤트 리스너 재등록이 다소 존재하지만, 현재 테트리스 규모에서는 측정 가능한 영향이 없다. gravity tick 의존성에 `isStarted`가 빠진 것은 현재 로직 상 동작하나 명시적 가드 추가를 권장한다.

### 위험도

**LOW**