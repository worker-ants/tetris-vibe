## 유지보수성 코드 리뷰

---

### 발견사항

---

**[CRITICAL] `calculateRankings`가 입력 배열을 직접 변경함**
- 위치: `lib/multiplayer/broadcast.ts:31`
- 상세: `.sort()`는 원본 배열을 직접 변경(in-place mutate)합니다. 호출자가 전달한 배열이 예상치 못하게 정렬되어 참조 기반 버그가 발생할 수 있습니다.
- 제안:
  ```ts
  return [...players]
    .sort((a, b) => b.score - a.score)
    .map(...)
  ```

---

**[WARNING] 세션 메모리 누수 — 라운드 종료 후 세션이 잔존함**
- 위치: `server.mjs:checkRoundEnd()`
- 상세: `round_end` 이벤트 후 `gameStarted`를 `false`로 재설정하지만 세션 객체는 `sessions` Map에 영구적으로 남습니다. 모든 플레이어가 접속을 끊기 전까지 정리되지 않아 장기 운영 시 메모리가 계속 증가합니다.
- 제안: 일정 시간(예: 5분) 후 비활성 세션을 정리하는 타이머를 추가하거나, `round_end` 직후 cleanup 로직을 실행하세요.

---

**[WARNING] 매직 넘버 `=== 1` (WebSocket.OPEN)**
- 위치: `server.mjs:50, 55`
- 상세: `readyState === 1` 조건에서 `1`은 `WebSocket.OPEN`을 의미하지만 숫자 리터럴로만 표기되어 있습니다. `ws` 패키지에서 상수를 사용할 수 있습니다.
- 제안:
  ```js
  import { WebSocket } from "ws";
  // ...
  if (player.ws.readyState === WebSocket.OPEN)
  ```

---

**[WARNING] `ModeSelection.tsx`에서 playerName 입력 UI 중복**
- 위치: `app/components/ModeSelection.tsx:54-62, 88-98`
- 상세: Host 폼과 Guest 폼 모두 "Your Name" 입력 필드(label, input, className 포함)가 거의 동일하게 반복됩니다. 향후 스타일이나 동작 변경 시 두 곳을 모두 수정해야 합니다.
- 제안: `<NameInput value={playerName} onChange={setPlayerName} />` 와 같은 작은 컴포넌트나 공통 렌더 함수로 추출하세요.

---

**[WARNING] 비밀번호 입력 필드가 `type="text"`로 노출됨**
- 위치: `app/components/ModeSelection.tsx:101-108`
- 상세: Guest 폼의 Password 입력 필드가 `type="text"`로 되어 있어 패스워드가 화면에 평문으로 표시됩니다. 유지보수 관점에서도 의도가 불명확하여 혼란을 유발합니다.
- 제안: `type="password"`로 변경하세요.

---

**[WARNING] `TetrisGame.tsx` 전반에 `isMultiplayer` 분기가 산재함**
- 위치: `app/components/TetrisGame.tsx` (전체)
- 상세: `!isMultiplayer` 조건이 키보드 핸들러, 일시정지 오버레이, 게임오버 오버레이, 사이드 패널 등 6곳 이상에 분산되어 있습니다. 멀티플레이어 동작 변경 시 모든 위치를 찾아 수정해야 합니다.
- 제안: 멀티플레이어 전용 오버레이/컨트롤을 별도 컴포넌트(`MultiplayerOverlay`)로 추출하거나, 단일플레이어/멀티플레이어 렌더링 경로를 조기에 분기하는 방식을 고려하세요.

---

**[WARNING] `{/* */}` 주석 구문이 JSX 외부에서 사용됨**
- 위치: `app/components/GameApp.tsx:10-12`
- 상세: `{/* ... */}`는 JSX 트리 내부에서만 유효한 주석 구문입니다. 모듈 최상위 레벨에서는 블록 구문(`{ /* ... */ }`)으로 파싱되어 의도가 불명확하고 일부 린터/포매터가 오작동할 수 있습니다. `// ...` 또는 `/* ... */` 을 사용해야 합니다.
- 제안: CLAUDE.md 지침에 따라 AI Agent 코멘트는 유지하되, JSX 외부에서는 `// [worker-ants] ...` 형식의 주석을 사용하도록 AI 에이전트 생성 규칙을 수정하세요.

---

**[WARNING] `checkRoundEnd`가 매 상태 업데이트마다 전체 플레이어를 순회함**
- 위치: `server.mjs:checkRoundEnd(), case "state_update"`
- 상세: 상태 업데이트마다 모든 플레이어의 `isGameOver`를 검사합니다. 현재는 최대 5명이므로 문제없지만, 로직이 커질 경우 병목이 될 수 있습니다. 또한 동시에 여러 상태 업데이트가 도달할 때 `round_end`가 여러 번 broadcast될 가능성이 있습니다(race condition).
- 제안: `session.roundEndSent` 플래그를 추가하여 `round_end`가 한 번만 전송되도록 보호하세요.

---

**[INFO] `RANK_LABELS` / `RANK_COLORS` 길이가 `MAX_PLAYERS`와 암묵적으로 연결됨**
- 위치: `app/components/RoundResult.tsx:13-20`
- 상세: 배열이 5개 요소로 하드코딩되어 있는데, 이는 `MAX_PLAYERS = 5`와 일치합니다. 향후 `MAX_PLAYERS`가 변경될 때 이 배열도 함께 업데이트해야 한다는 사실이 코드에서 드러나지 않습니다.
- 제안: 주석으로 연관성을 명시하거나, `MAX_PLAYERS`를 import해서 배열 길이를 동적으로 검증하는 `assert`를 추가하세요.

---

**[INFO] `hiddenRows = 2`가 공유 상수로 정의되지 않음**
- 위치: `app/components/OpponentBoard.tsx:60`
- 상세: `const hiddenRows = 2`가 로컬로 하드코딩되어 있습니다. `lib/tetris/constants.ts`에 이미 `BOARD_COLS`, `VISIBLE_ROWS` 등의 상수가 있으며, 숨겨진 행 수도 그곳에서 관리되는 것이 일관성에 맞습니다.
- 제안: `constants.ts`에 `HIDDEN_ROWS = 2` 상수를 추가하고 공유하세요.

---

**[INFO] `useMultiplayer` 훅이 12개 프로퍼티를 평탄하게 반환함**
- 위치: `app/hooks/useMultiplayer.ts:195-208`
- 상세: 반환값이 평탄한 객체이므로 소비하는 쪽(`MultiplayerGame.tsx`)에서 `mp.phase`, `mp.isConnected`, `mp.sendState` 등으로 접근합니다. 프로퍼티 수가 많아 인터페이스 파악이 어렵습니다.
- 제안: 관련 프로퍼티를 그룹화하는 것을 고려하세요. (예: `{ state: { phase, players, ... }, actions: { connect, sendState, ... } }`)

---

**[INFO] `sendState` 내 스로틀 임계값이 매직 넘버**
- 위치: `app/hooks/useMultiplayer.ts:167`
- 상세: `< 100` (10fps 기준 100ms)이 설명 없이 하드코딩되어 있습니다.
- 제안:
  ```ts
  const BROADCAST_INTERVAL_MS = 100; // 10fps
  if (!state.isGameOver && now - throttleRef.current < BROADCAST_INTERVAL_MS) return;
  ```

---

### 요약

전반적으로 코드 구조는 역할별로 잘 분리되어 있고(`GameApp` → `ModeSelection`/`MultiplayerGame`, `useMultiplayer` 훅 추출 등) 타입 정의도 체계적입니다. 그러나 `calculateRankings`의 입력 배열 변이(mutation)는 런타임 버그로 이어질 수 있는 실질적 위험이고, 서버의 세션 메모리 누수와 race condition은 장기 운영 시 문제가 됩니다. `TetrisGame.tsx`는 멀티플레이어 분기가 컴포넌트 전반에 흩어져 있어 단일/다중 플레이어 동작을 함께 추론하기 어렵고, `ModeSelection.tsx`의 폼 코드 중복과 `server.mjs`의 매직 넘버들은 향후 수정 비용을 높입니다.

### 위험도

**MEDIUM**