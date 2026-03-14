## 부작용 코드 리뷰

### 발견사항

---

- **[WARNING]** `isStarted`와 `isPaused`의 암묵적 불변 조건 의존
  - 위치: `gameEngine.ts` - `tick`, `moveLeft`, `moveRight`, `softDrop`, `hardDrop`, `rotate`
  - 상세: 게임 로직 함수들이 `state.isPaused`만 검사하고 `state.isStarted`는 검사하지 않음. 현재는 `initGame()`이 `isPaused: true, isStarted: false`로 초기화하므로 정상 동작하지만, 이 설계는 "`isStarted: false`이면 항상 `isPaused: true`" 불변 조건에 암묵적으로 의존함. 해당 불변 조건이 미래 변경에서 깨질 경우, 게임 시작 전에 `tick`, `hardDrop` 등이 실행될 수 있음
  - 제안: 핵심 함수들에 `if (!state.isStarted) return state;` 명시적 가드 추가, 또는 `isPaused`가 시작 전 상태를 표현하는 것이 아닌 별도 상태임을 주석으로 문서화

---

- **[WARNING]** `RESTART` 후 게임이 미시작 상태로 복귀하는 행동 변경
  - 위치: `TetrisGame.tsx:43` (`case "RESTART": return initGame()`)
  - 상세: 기존에는 재시작 시 `isPaused: false`로 게임이 즉시 재개되었으나, 변경 후 `initGame()`이 `isStarted: false, isPaused: true`를 반환하므로 재시작 시 항상 Start 화면으로 돌아감. `RESTART` 호출처가 세 곳(키보드, 일시정지 오버레이, 사이드바 버튼)이고 모두 동일한 영향을 받음. 의도된 동작이라면 문제 없으나, 빠른 재시작 UX를 기대하는 사용자에게는 예상과 다를 수 있음
  - 제안: `RESTART` 액션을 두 가지로 분리하거나(`RESTART_TO_MENU` / `RESTART_AND_START`), 또는 현재 동작이 의도된 것임을 주석으로 명시

---

- **[WARNING]** Game Over 화면에서 Space 키로 재시작 추가 - 의도치 않은 트리거 가능
  - 위치: `TetrisGame.tsx` - `handleKeyDown` 내 `isGameOver` 분기
  - 상세: Game Over 상태에서 Space 키가 `RESTART`를 트리거하도록 추가됨. 그런데 게임 중 Space는 하드 드롭이었으므로, 게임이 끝나는 마지막 하드 드롭 입력이 연속적으로 처리될 때(키 입력이 빠를 경우) Game Over 직후 Space 키업 이벤트가 즉시 재시작을 유발할 수 있음. `keydown` 이벤트를 사용하므로 키 반복 입력도 고려 필요
  - 제안: Game Over 직후 짧은 쿨다운 적용 또는 별도 확인 UI 제공

---

- **[INFO]** `useEffect`(tick interval) 의존 배열에 `isStarted` 미포함
  - 위치: `TetrisGame.tsx:55-64`
  - 상세: `useEffect`가 `[state.level, state.isGameOver, state.isPaused]`에만 의존하며 `state.isStarted`는 없음. 현재는 `isPaused`가 시작 여부를 간접 반영하므로 기능상 문제없으나, 앞서 언급한 불변 조건이 깨지면 `isStarted: false`인데 타이머가 동작할 수 있음
  - 제안: `isStarted`를 의존 배열에 추가하고 `if (!state.isStarted || state.isGameOver || state.isPaused) return;` 명시

---

- **[INFO]** `types.ts` 중첩 주석 마커 (코스메틱)
  - 위치: `types.ts` 파일 상단과 하단
  - 상세: `[worker-ants]` 주석이 3중으로 중첩되어 파일 구조 파악에 혼란을 줌. 코드 동작에는 영향 없음
  - 제안: 외부 마커만 유지하고 내부 중복 마커 제거

---

- **[INFO]** `GameState` 인터페이스에 `isStarted` 필드 추가로 인한 하위 호환성
  - 위치: `types.ts:31`
  - 상세: TypeScript 타입이므로 런타임 영향은 없으며, `initGame()`이 새 필드를 포함하도록 업데이트됨. 테스트 코드나 외부에서 `GameState` 객체를 수동으로 생성하는 코드가 있다면 컴파일 에러 발생 가능. 현재 코드베이스 내에서는 문제 없음
  - 제안: 해당 사항 없음 (현재 범위에서 안전)

---

### 요약

이번 변경은 "게임 시작 전 대기 상태" 기능을 추가하기 위해 `isStarted` 상태와 `startGame()` 함수를 도입했습니다. 전반적으로 구조는 일관성을 유지하고 있으며 즉각적인 버그 위험은 낮습니다. 그러나 핵심 게임 로직 함수들(`tick`, `moveLeft` 등)이 `isStarted`를 직접 검사하지 않고 `isPaused: true`를 통해 간접적으로 가드되는 설계는 암묵적 불변 조건에 의존하는 취약한 구조입니다. `RESTART` 후 Start 화면으로 복귀하는 행동 변경과 Space 키의 이중 역할(시작/재시작/하드드롭)도 향후 유지보수 시 혼란을 유발할 수 있는 잠재적 부작용입니다.

### 위험도

**MEDIUM**