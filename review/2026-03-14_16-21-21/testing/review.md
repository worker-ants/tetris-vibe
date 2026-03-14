### 발견사항

---

**[CRITICAL] `calculateRankings`가 입력 배열을 직접 변이(mutation)함**
- 위치: `lib/multiplayer/broadcast.ts:31`, `lib/multiplayer/__tests__/broadcast.test.ts`
- 상세: `.sort()`는 원본 배열을 직접 변이하여 부수효과를 일으킵니다. 테스트 각각이 새 배열을 생성하므로 이 버그를 잡지 못합니다.
- 제안:
  ```ts
  return [...players]
    .sort((a, b) => b.score - a.score)
    .map(...)
  ```
  및 변이를 검증하는 테스트 추가:
  ```ts
  it("does not mutate input array", () => {
    const players = [{ id: "a", name: "A", score: 200 }, { id: "b", name: "B", score: 100 }];
    const copy = [...players];
    calculateRankings(players);
    expect(players).toEqual(copy);
  });
  ```

---

**[CRITICAL] `useMultiplayer.ts`에 대한 테스트 없음**
- 위치: `app/hooks/useMultiplayer.ts` 전체
- 상세: 핵심 멀티플레이 상태 관리 로직(WebSocket 연결, 메시지 핸들링, 스로틀링, 에러 처리 등)에 대한 테스트가 전혀 없습니다. `WebSocket`이 생성자에서 직접 생성되어 의존성 주입이 불가능하며, 테스트 격리가 어렵습니다.
- 제안: WebSocket을 외부에서 주입할 수 있도록 구조를 변경하거나, `vi.stubGlobal('WebSocket', MockWebSocket)` 패턴으로 테스트 작성.
  ```ts
  it("sets error when connection fails", () => {
    // mock WebSocket onerror
    // verify error state
  });
  ```

---

**[CRITICAL] `server.mjs` 서버 로직에 대한 테스트 없음**
- 위치: `server.mjs` 전체
- 상세: 세션 생성/참여, 게임 시작 권한 확인, `checkRoundEnd` 로직, 호스트 재배정, 플레이어 이탈 처리 등 서버의 핵심 비즈니스 로직에 테스트가 없습니다. 특히 `checkRoundEnd`는 `p.state`가 `null`인 플레이어(아직 state를 전송하지 않은 플레이어)가 있을 때 라운드 종료를 영구 차단하는 엣지 케이스가 있습니다.
- 제안: 서버 함수들을 `server.mjs`에서 분리하여 단위 테스트 가능하게 구조 개선.

---

**[WARNING] 동점 처리 테스트가 비결정적(non-deterministic)**
- 위치: `lib/multiplayer/__tests__/broadcast.test.ts:76-87`
- 상세: 동점 케이스에서 어느 플레이어가 1위를 받는지 검증하지 않습니다. `Array.sort()`의 안정성은 JS 엔진 구현에 따라 다를 수 있으며, 동점 처리 정책(예: 먼저 사망한 순서 등)이 있다면 이를 테스트해야 합니다.
- 제안:
  ```ts
  it("handles tied scores with stable ordering", () => {
    // 동점 시 어떤 기준으로 순서가 정해지는지 명시적으로 검증
  });
  ```

---

**[WARNING] `toBroadcastState`에서 일시정지 상태의 activePiece 포함 여부 미검증**
- 위치: `lib/multiplayer/__tests__/broadcast.test.ts`
- 상세: `isGameOver`가 `false`이고 `isPaused`가 `true`일 때 `activePiece`가 포함되는지 검증하는 테스트가 없습니다. 현재 구현은 포함하지만, 이것이 의도된 동작인지 테스트로 명시되어 있지 않습니다.

---

**[WARNING] `broadcast.test.ts`에서 빈 배열 케이스 누락**
- 위치: `lib/multiplayer/__tests__/broadcast.test.ts`
- 상세: `calculateRankings([])` 호출 시 동작이 테스트되지 않습니다. 서버 로직(`checkRoundEnd`)이 빈 플레이어 배열을 먼저 걸러내지만, 순수 함수로서 빈 입력도 검증해야 합니다.

---

**[WARNING] `connect()` 중복 호출 시 다중 WebSocket 연결 미보호**
- 위치: `app/hooks/useMultiplayer.ts:108`
- 상세: 기존 연결이 있는 상태에서 `connect()`를 재호출하면 이전 WebSocket을 닫지 않고 새 연결을 생성합니다. 이 경우를 검증하는 테스트가 없습니다.

---

**[WARNING] `ModeSelection`, `RoundResult` 컴포넌트 테스트 없음**
- 위치: `app/components/ModeSelection.tsx`, `app/components/RoundResult.tsx`
- 상세: 폼 유효성 검사(빈 이름/엔드포인트/비밀번호 시 버튼 비활성화), 단계 전환(mode → host → mode), 올바른 `GameConfig`가 `onSelect`에 전달되는지 등의 검증이 없습니다.
- 제안:
  ```tsx
  it("disables 'Create Session' button when playerName is empty", () => {
    render(<ModeSelection onSelect={vi.fn()} />);
    fireEvent.click(screen.getByText("Multiplayer - Host"));
    expect(screen.getByText("Create Session")).toBeDisabled();
  });
  ```

---

**[INFO] `OpponentBoard` Canvas 렌더링 테스트 불가**
- 위치: `app/components/OpponentBoard.tsx`
- 상세: jsdom 환경에서 Canvas 2D API가 지원되지 않아 렌더링 로직 테스트가 어렵습니다. `jest-canvas-mock` 또는 `vitest` 환경에서 Canvas mock 설정이 필요합니다.
- 제안: Canvas 드로잉 로직을 별도 순수 함수로 분리하면 테스트 가능성이 높아집니다.

---

**[INFO] `useMultiplayer`의 `handleMessage`가 JSON 파싱 에러를 미처리**
- 위치: `app/hooks/useMultiplayer.ts:56`
- 상세: 서버에서 잘못된 JSON 메시지를 수신할 경우 `JSON.parse(event.data)`가 예외를 발생시키지만, 클라이언트에서는 try/catch가 없습니다(서버의 `ws.on("message")`와 달리). 이 케이스를 검증하는 테스트가 없습니다.

---

### 요약

`broadcast.ts`의 순수 함수들에 대한 단위 테스트(`broadcast.test.ts`)는 잘 구성되어 있으나, 입력 배열 변이 버그를 포함한 몇 가지 엣지 케이스를 놓치고 있습니다. 그보다 더 큰 문제는 이번 변경의 핵심인 `useMultiplayer` 훅과 `server.mjs` 서버 로직에 대한 테스트가 전혀 없다는 점입니다. 멀티플레이 세션 관리, WebSocket 통신, 라운드 종료 조건 등 결함 시 사용자 경험에 직접 영향을 주는 코드들이 테스트 범위 밖에 있습니다. UI 컴포넌트들도 마찬가지로 중요한 인터랙션(폼 유효성, 단계 전환)에 대한 테스트가 없습니다. WebSocket을 직접 생성자에서 인스턴스화하는 방식은 테스트 격리를 어렵게 만들므로, 의존성 주입 패턴 적용을 검토해야 합니다.

### 위험도

**HIGH**