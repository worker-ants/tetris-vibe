## 발견사항

---

### **[CRITICAL]** `calculateRankings` — 입력 배열 원본 변이

- **위치**: `lib/multiplayer/broadcast.ts:30`
- **상세**: `Array.prototype.sort()`는 JavaScript에서 **원본 배열을 in-place 정렬**합니다. `calculateRankings`에 전달된 `players` 배열이 호출 후 변이됩니다.
  ```ts
  // players 배열 원본이 정렬되어 버림
  return players
    .sort((a, b) => b.score - a.score)
    .map(...)
  ```
  현재는 `server.mjs`에서 `.map()` 체이닝 후 전달하므로 중간 배열이 새로 생성되어 실제 피해는 없지만, 함수 시그니처만 보면 외부 배열이 변이될 수 있는 구조입니다.
- **제안**: `players.slice().sort(...)` 또는 `[...players].sort(...)`로 변경하여 순수 함수로 유지

---

### **[WARNING]** `connect()` — 기존 WebSocket 미종료 후 재연결

- **위치**: `app/hooks/useMultiplayer.ts:120`
- **상세**: `connect()` 호출 시 `wsRef.current`를 확인하지 않고 새 WebSocket을 생성합니다. React StrictMode(개발 환경)에서는 `useEffect`가 두 번 호출되므로, 첫 번째 연결이 닫히기 전에 두 번째 연결이 생성될 수 있습니다. 또한 `connect()` 가 있는 `useEffect`에 cleanup 함수가 없습니다.
  ```ts
  useEffect(() => {
    mp.connect(); // cleanup 없음
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  ```
- **제안**: `connect()` 내에서 `wsRef.current?.close()` 선행 호출, 또는 `useEffect` 반환값으로 cleanup 추가

---

### **[WARNING]** `TetrisGame` — 마운트 시 초기 상태를 즉시 브로드캐스트

- **위치**: `app/components/TetrisGame.tsx:43-46`
- **상세**: `onStateChangeRef.current?.(state)`를 state 의존성 `useEffect`로 호출하므로, 컴포넌트 마운트 직후 **게임 시작 전의 초기 상태**(isStarted: false, isPaused: true)가 멀티플레이 서버로 전송됩니다. 이로 인해 상대방 화면에 잠시 빈 상태나 일시정지 상태가 표시될 수 있습니다.
  ```ts
  useEffect(() => {
    onStateChangeRef.current?.(state); // 초기 렌더에도 호출됨
  }, [state]);
  ```
- **제안**: `state.isStarted`를 조건으로 추가하거나, `isMultiplayer && state.isStarted`일 때만 전송

---

### **[WARNING]** `ModeSelection` — 비밀번호 필드 `type="text"` 사용

- **위치**: `app/components/ModeSelection.tsx:116`
- **상세**: 패스워드 입력 필드가 `type="text"`로 되어 있어 입력값이 평문으로 화면에 노출됩니다.
  ```tsx
  <input type="text" value={password} ... />
  ```
- **제안**: `type="password"`로 변경 (자동 완성, 마스킹 처리)

---

### **[WARNING]** `useMultiplayer` — `handleMessage` 클로저 고착 문제

- **위치**: `app/hooks/useMultiplayer.ts:149`
- **상세**: `ws.onmessage = handleMessage`는 연결 시점의 `handleMessage`를 고정합니다. `handleMessage`는 `options.playerName` 의존성이 있어 재생성될 수 있지만, 기존 WebSocket은 갱신되지 않아 stale closure를 사용합니다. 실제 플레이 중 이름이 바뀌지는 않지만 구조적 위험입니다.
- **제안**: `ws.onmessage = (e) => handleMessageRef.current(e)` 형태로 ref를 통해 최신 handler 참조

---

### **[INFO]** `GameApp.tsx` — 모듈 최상위 레벨에 JSX 주석 문법 사용

- **위치**: `app/components/GameApp.tsx:10, 12, 22`
- **상세**: `{/* ... */}`는 JSX 트리 내부에서만 유효한 주석 문법이지만, 모듈 최상위 레벨(함수 외부)에 사용되었습니다. TypeScript/JavaScript에서 `{ /* 주석 */ }` 형태의 빈 블록 문으로 파싱되어 문법 오류는 아니지만, 의도와 다른 위치에 배치된 AI 생성 마커입니다.
- **제안**: 주석 위치를 수정하거나, `//` 형태 주석으로 교체

---

### **[INFO]** `OpponentBoard` — 매 상태 업데이트마다 캔버스 전체 리셋

- **위치**: `app/components/OpponentBoard.tsx:32-36`
- **상세**: `useEffect([state])`에서 `canvas.width/height`를 매번 재설정합니다. 이는 DOM을 불필요하게 수정하며 레이아웃 리플로우를 유발합니다(10fps 기준 초당 10회).
- **제안**: 캔버스 크기 설정은 마운트 시 `useEffect([], [])`로 분리하고, 그리기 로직만 state 변화에 반응

---

### **[INFO]** `ModeSelection` — 호스트/게스트 간 `playerName` 상태 공유

- **위치**: `app/components/ModeSelection.tsx:15`
- **상세**: `playerName` state가 host 단계와 guest 단계 간에 공유됩니다. 호스트 폼에서 이름 입력 후 뒤로 가서 게스트 폼을 열면 이전 이름이 그대로 남아있습니다. 의도된 동작일 수도 있으나 혼란을 줄 수 있습니다.

---

## 요약

이번 변경은 싱글플레이어 테트리스에 WebSocket 기반 멀티플레이어 기능을 추가한 상당한 규모의 작업입니다. 전반적으로 상태 관리가 적절하게 분리되어 있으며, 부작용이 잘 캡슐화되어 있습니다. 그러나 `calculateRankings`의 원본 배열 변이(CRITICAL), `connect()` 호출 시 기존 연결 미종료로 인한 WebSocket 누수(WARNING), 멀티플레이 중 초기 상태 즉시 브로드캐스트(WARNING)가 주요 위험 요소입니다. 특히 `broadcast.ts`의 배열 변이는 명확한 버그이며, 나머지 항목들은 React StrictMode 또는 엣지 케이스에서 문제가 될 수 있습니다.

## 위험도

**MEDIUM**