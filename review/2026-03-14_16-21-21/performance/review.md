## 성능 코드 리뷰

---

### 발견사항

---

**[CRITICAL] `server.mjs` - state_update 시 전체 상태 Full Broadcast**
- 위치: `server.mjs`, `state_update` 핸들러 (약 240~265번째 줄)
- 상세: 플레이어 한 명이 상태를 전송할 때마다, 서버는 **모든 플레이어의 보드 상태 전체를 직렬화**해서 전원에게 전송합니다. 5인 플레이 기준: 플레이어당 10fps 전송 × 5명 = 50회/초의 업데이트 발생. 각 업데이트마다 5명 보드 전체(보드 22×10 × 5 = 1,100 셀 + active piece 등)를 JSON 직렬화 후 5명에게 전송 → **250회/초 대규모 JSON 직렬화 + 전송**.
- 제안: 변경된 플레이어의 상태만 해당 플레이어 ID와 함께 broadcast하고, 클라이언트가 각자 상태 맵을 관리하도록 변경.
  ```js
  // 현재: 모든 상태 전체를 매번 직렬화
  broadcastAll(session, { type: "state_broadcast", states });
  
  // 개선: 변경된 단일 플레이어 상태만 전송
  broadcastAll(session, { type: "state_update_single", playerId, state: msg.state });
  ```

---

**[WARNING] `OpponentBoard.tsx` - 매 state 변경마다 캔버스 크기 재설정 + 격자 전체 재드로우**
- 위치: `OpponentBoard.tsx:29~56` (useEffect 내부)
- 상세: `canvas.width = MINI_WIDTH * dpr`를 매 state 변경 시 재할당합니다. 캔버스 크기 설정은 컨텍스트를 초기화하므로 필수적이지만, `ctx.scale(dpr, dpr)` + 격자 32개 이상의 독립 `stroke()` 호출도 매번 실행됩니다. 4명의 상대방 × 10fps = 초당 40회 격자 전체 재드로우가 발생합니다.
- 제안 1 (즉시 적용): 격자 선 드로잉을 단일 `beginPath()`로 배치 처리.
  ```ts
  // 현재: 각 선마다 beginPath/stroke → 32+ 호출
  // 개선: 단일 path로 배치
  ctx.beginPath();
  for (let r = 0; r <= VISIBLE_ROWS; r++) {
    ctx.moveTo(0, r * MINI_CELL_SIZE);
    ctx.lineTo(MINI_WIDTH, r * MINI_CELL_SIZE);
  }
  for (let c = 0; c <= BOARD_COLS; c++) {
    ctx.moveTo(c * MINI_CELL_SIZE, 0);
    ctx.lineTo(c * MINI_CELL_SIZE, MINI_HEIGHT);
  }
  ctx.stroke();
  ```
- 제안 2 (근본적): 격자를 별도의 정적 캔버스(또는 `useMemo`로 생성한 OffscreenCanvas)에 한 번만 그리고 `drawImage`로 합성.

---

**[WARNING] `useMultiplayer.ts` - `connect` 콜백이 매 렌더마다 재생성**
- 위치: `useMultiplayer.ts:116~157` (`connect` useCallback)
- 상세: `connect`의 의존성 배열이 `[options, handleMessage]`인데, `options`는 `MultiplayerGame`이 렌더링될 때마다 새 객체 참조로 전달됩니다. 결과적으로 `connect`와 이를 참조하는 모든 콜백이 매 렌더마다 재생성됩니다. 현재는 `connect()`를 빈 의존성 `useEffect`에서 한 번만 호출하므로 동작 버그는 없지만, 불필요한 함수 재생성이 발생합니다.
- 제안: options를 ref로 유지하거나, 의존성을 개별 프리미티브로 분리.
  ```ts
  const optionsRef = useRef(options);
  optionsRef.current = options;
  
  const connect = useCallback(() => {
    const { role, playerName, endpoint, password } = optionsRef.current;
    // ...
  }, []); // 빈 의존성
  ```

---

**[WARNING] `server.mjs` - `findSessionByPassword` O(n) 선형 탐색**
- 위치: `server.mjs:68~74`
- 상세: 비밀번호로 세션을 찾을 때 모든 세션을 순회합니다. 세션 수가 적으면 무해하지만, 서버가 오래 실행될수록 누적됩니다. (세션 정리 로직은 있으나 disconnect 기반이므로 네트워크 이상 시 누수 가능)
- 제안: `password → session` 역방향 Map 추가.
  ```js
  const sessionsByPassword = new Map();
  // create_session 시: sessionsByPassword.set(password, session)
  // session 삭제 시: sessionsByPassword.delete(password)
  ```

---

**[WARNING] `useMultiplayer.ts` - 매 broadcast마다 무조건 `setOpponentStates` 호출**
- 위치: `useMultiplayer.ts:90~102` (`state_broadcast` 처리)
- 상세: 서버로부터 `state_broadcast`를 받을 때마다 항상 새 `others` 객체를 생성하고 `setOpponentStates(others)`를 호출합니다. 이는 초당 최대 50회(5명 × 10fps)의 React 상태 업데이트를 유발하며, `MultiplayerGame`과 모든 `OpponentBoard`의 리렌더링을 트리거합니다.
- 제안: 클라이언트 측에서도 throttle 적용 또는 얕은 비교 후 변경 시에만 업데이트. 또는 React 18의 `startTransition`으로 낮은 우선순위 처리.

---

**[WARNING] `broadcast.ts` - `calculateRankings`에서 원본 배열 변이(mutation)**
- 위치: `broadcast.ts:30`
- 상세: `players.sort(...)` 는 전달된 배열을 **직접 변이(in-place sort)** 합니다. `server.mjs`에서 `session.players`의 values를 `Array.from`으로 변환한 후 전달하므로 현재는 원본 Map에 영향을 주지 않지만, 호출 방식이 변경될 경우 버그로 이어질 수 있습니다.
- 제안: `[...players].sort(...)` 로 복사 후 정렬.

---

**[INFO] `ModeSelection.tsx` - 렌더마다 `.trim()` 중복 호출**
- 위치: `ModeSelection.tsx:55~74` (host step), `ModeSelection.tsx:108~136` (guest step)
- 상세: `disabled={!playerName.trim()}` 와 `onClick` 핸들러 내의 `!playerName.trim()`이 동일한 계산을 반복합니다. 폼 입력 컴포넌트에서 미미한 수준이지만, 메모이제이션 또는 파생 변수로 개선 가능합니다.
- 제안: `const isNameValid = playerName.trim().length > 0;` 형태로 변수화.

---

**[INFO] `TetrisGame.tsx` - 싱글플레이 시에도 onStateChange effect 실행**
- 위치: `TetrisGame.tsx:47~50`
- 상세: `useEffect(() => { onStateChangeRef.current?.(state); }, [state])` 는 싱글플레이어 모드에서도 매 TICK마다 실행됩니다. `onStateChangeRef.current`가 `undefined`이므로 함수 호출 자체는 없지만, effect 오버헤드(React 스케줄링)는 발생합니다.
- 제안: `isMultiplayer` 조건 또는 ref 값 체크로 early return.

---

**[INFO] `server.mjs` - 세션 만료(expiry) 미구현**
- 위치: `server.mjs` 전체
- 상세: 비정상 종료(네트워크 끊김 등)로 `ws.close` 이벤트가 발생하지 않으면 세션이 메모리에 무기한 잔류합니다. WebSocket heartbeat(ping/pong) + TTL 기반 세션 만료가 없습니다.
- 제안: `wss`의 `ping` 인터벌 설정 또는 세션별 마지막 활동 타임스탬프 추적 후 주기적 정리.

---

### 요약

전체적으로 코드 구조는 명확하고 React 패턴도 적절하게 사용되었습니다. 그러나 **멀티플레이어 상태 동기화 아키텍처**에 근본적인 성능 문제가 있습니다: 플레이어 한 명의 상태 변경이 서버에서 모든 플레이어의 전체 상태를 재직렬화해서 전원에게 전송하는 구조(O(P²) 데이터 전송량)이며, 클라이언트에서도 이를 매번 React 상태로 반영하여 리렌더링을 유발합니다. `OpponentBoard`의 격자 재드로우 비효율과 함께, 5인 풀방 기준 실제 플레이 시 체감 가능한 성능 저하가 발생할 수 있습니다. `findSessionByPassword`의 선형 탐색과 세션 만료 미구현은 장기 운영 시 메모리 누수 위험을 내포합니다.

### 위험도

**MEDIUM**