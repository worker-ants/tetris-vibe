## 발견사항

- **[WARNING]** `tick()` 함수가 `isStarted`를 직접 체크하지 않음
  - 위치: `gameEngine.ts` → `tick()` 함수
  - 상세: `tick()`은 `isGameOver || isPaused`만 확인. 게임 시작 전 멈춤이 `isPaused: true` 초기값에 암묵적으로 의존함. `startGame()`이 동시에 `isStarted: true, isPaused: false`를 설정하므로 현재는 동작하지만, 상태 기계가 변경되면 게임이 시작 전에 tick될 위험 있음
  - 제안: `if (state.isGameOver || state.isPaused || !state.isStarted) return state;`로 명시적 가드 추가

- **[WARNING]** 게임 오버 후 Space 키 UX — 이중 입력 필요
  - 위치: `TetrisGame.tsx` → `handleKeyDown`, game over 분기
  - 상세: 게임 오버 중 Space → `RESTART` → `initGame()` → `isStarted: false` → 타이틀 화면으로 복귀. 이후 다시 Space를 눌러야 게임 시작. 요구사항 "처음부터 재시작"이 타이틀 복귀인지 즉시 플레이인지 명확하지 않으나, 일반적인 테트리스 UX에서는 게임 오버 후 즉시 재시작이 기대됨
  - 제안: 게임 오버 상태에서 Space/R 입력 시 `RESTART` 후 `START`를 연속 dispatch하거나, `restartAndStart()` 함수로 `isStarted: true` 상태로 반환

- **[WARNING]** Enter 키로 게임 시작 가능하나 ControlsInfo에 미표시
  - 위치: `TetrisGame.tsx:77`, `ControlsInfo.tsx`
  - 상세: `e.key === "Enter"`로 게임 시작이 가능하나 컨트롤 안내에 없음. 사용자 혼란 가능성은 낮지만 문서-구현 불일치
  - 제안: ControlsInfo의 Space 항목을 `"Space / Enter"`로 업데이트하거나 Enter 핸들링 제거

- **[INFO]** `types.ts` 중복 worker-ants 주석 마커
  - 위치: `types.ts` 상단 3~4행
  - 상세: 동일 파일에 3개의 중첩된 `[worker-ants]` 열기 마커와 닫기 마커가 존재. 기능 영향 없으나 유지보수 혼란 유발

- **[INFO]** ControlsInfo의 Space 키 설명이 게임 오버 재시작 동작을 미반영
  - 위치: `ControlsInfo.tsx`
  - 상세: Space가 "Start / Hard Drop"으로만 표시되나, 게임 오버 상태에서 Space는 Restart로도 동작함

---

## 요약

Turn 2 요구사항(초기 정지 상태, Space/버튼으로 시작, 일시정지/재개, 재시작)은 전체적으로 충실히 구현되었다. `isStarted` 필드 도입과 상태 전이 로직, UI 오버레이 및 버튼 구성 모두 요구사항을 만족한다. 다만 `tick()`이 `isStarted`를 직접 검사하지 않고 `isPaused: true` 초기값에 암묵적으로 의존하는 취약한 결합이 존재하며, 게임 오버 후 Space 키로 재시작 시 타이틀 화면을 한 번 더 거쳐야 하는 이중 입력 문제는 요구사항 해석에 따라 개선이 필요할 수 있다.

## 위험도

**LOW**