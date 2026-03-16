## 부작용(Side Effect) 코드 리뷰

---

### 발견사항

---

**[WARNING] TetrisGame.tsx: Space/Enter `preventDefault` 무조건 실행**
- 위치: `TetrisGame.tsx` `handleKeyDown` 최상단 (약 line 46~50)
- 상세: `if (e.key === " " || e.key === "Enter") { e.preventDefault(); }` 가 게임 상태와 무관하게 항상 실행됩니다. 게임 시작 전·종료 후·일시정지 중에도 페이지 스크롤 및 포커스된 버튼의 기본 동작이 차단됩니다. 이는 전역 키보드 이벤트에 대한 의도치 않은 부작용입니다. 주석에서 메뉴 버튼 오작동 방지 목적임을 밝히고 있으나, 게임과 무관한 요소(예: 모달 열기, 폼 제출)가 동일 페이지에 추가될 경우 충돌이 발생할 수 있습니다.
- 제안: 게임이 활성 상태(`isStarted && !isGameOver`)일 때만 `preventDefault`를 호출하거나, 이벤트 핸들러를 게임 캔버스 영역에만 범위 제한하는 것을 검토하세요.

---

**[WARNING] useMultiplayer.ts: 예상치 못한 WebSocket 종료 시 stale 상태 유지**
- 위치: `useMultiplayer.ts` `ws.onclose` 핸들러
- 상세: `onclose`에서는 `isConnected: false`와 `wsRef.current = null`만 초기화합니다. `phase`, `players`, `opponentStates`, `sessionInfo`는 마지막 값을 그대로 유지합니다. 네트워크 오류나 서버 재시작으로 연결이 끊어지면, 사용자는 로비/게임 화면이 표시된 채로 있지만 연결은 끊긴 상태가 됩니다. 반면 `disconnect()`는 모든 상태를 초기화합니다—동작이 일관성이 없습니다.
- 제안: `onclose`에서 `phase`를 `"lobby"`로, `players`를 `[]`로 재설정하거나, 에러 상태를 통해 사용자에게 연결 끊김을 명시적으로 알려야 합니다.

---

**[WARNING] server.mjs: 플레이어 연결 해제 시 랭킹에서 점수 제외**
- 위치: `server.mjs` `handleClose` → `checkRoundEnd` 호출 순서
- 상세: `session.players.delete(conn.playerId)` 로 플레이어를 제거한 **후** `checkRoundEnd`를 호출합니다. `singleSurvivor` 조건이 발동되면, 방금 연결이 끊긴 플레이어의 점수는 `calculateRankings`에 포함되지 않습니다. 2명이 플레이 중 한 명이 연결 종료되면, 남은 1명만을 대상으로 1위 랭킹이 결정됩니다—연결 해제 직전까지의 상대방 점수가 결과에 반영되지 않습니다.
- 제안: 연결 해제 전 플레이어의 최종 상태를 랭킹 계산용으로 별도 보존하거나, `singleSurvivor` 조건과 `allDead` 조건을 분리해 처리 방식을 다르게 구성하세요.

---

**[INFO] GameBoard.tsx: 매 렌더마다 캔버스 크기 재설정**
- 위치: `GameBoard.tsx` `useEffect` 의존성 배열 `[gameState]`
- 상세: `canvas.width = CANVAS_WIDTH * dpr`와 `canvas.height = CANVAS_HEIGHT * dpr`가 상수 값임에도 `gameState`가 변경될 때마다 실행됩니다. 캔버스 크기 재설정은 컨텍스트를 초기화하므로 매 프레임마다 전체 재드로우가 발생합니다. 기능상 문제는 없으나 `OpponentBoard.tsx`에서 크기 초기화(`[]`)와 드로우(`[state]`)를 분리한 방식과 비일관적입니다.
- 제안: `OpponentBoard.tsx`처럼 크기 초기화 `useEffect`와 드로우 `useEffect`를 분리하면 불필요한 DOM 조작을 줄일 수 있습니다.

---

**[INFO] server.mjs: 모든 네트워크 인터페이스(`0.0.0.0`)에서 수신**
- 위치: `server.mjs` `server.listen(port, "0.0.0.0", ...)`
- 상세: LAN 멀티플레이를 위한 의도적 설계이나, 개발 환경에서도 방화벽 외부에 노출될 수 있습니다. 오리진 검증이 구현되어 있어 CSWSH는 방어되지만, WebSocket 서버 자체는 LAN 내 임의 클라이언트가 접근 가능합니다.
- 제안: 개발 모드(`dev === true`)에서는 `localhost`로만 바인딩하고, 프로덕션/LAN 모드에서만 `0.0.0.0`을 사용하는 것을 고려하세요.

---

### 요약

코드 전반적으로 부작용 관리가 양호합니다. 게임 엔진 로직(`gameEngine.ts`, `board.ts`, `reducer.ts` 등)은 순수 함수로 구성되어 있고, 서버의 세션 상태 변경은 단일 스레드 특성 덕분에 레이스 컨디션 위험이 낮습니다. 주요 위험은 두 가지입니다: `TetrisGame.tsx`의 전역 키 이벤트 차단이 게임 상태와 무관하게 동작하며, `useMultiplayer.ts`에서 예상치 못한 WebSocket 종료 시 UI 상태가 불완전하게 초기화됩니다. 서버 측에서는 플레이어 연결 해제 시 랭킹 계산에서 해당 플레이어의 점수가 제외되는 로직 순서 문제가 있습니다.

### 위험도

**MEDIUM**