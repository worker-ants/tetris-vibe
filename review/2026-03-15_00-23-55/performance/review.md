## 리뷰 결과

### 발견사항

---

#### 개선 사항 (긍정적 변경)

- **[INFO] 캔버스 크기 초기화 분리** (`OpponentBoard.tsx`)
  - 위치: `useEffect([], [])` (마운트 전용)
  - 상세: `canvas.width = ...` 할당은 캔버스를 클리어하고 레이아웃 재계산을 유발한다. 이전 구현에서는 10fps로 state가 갱신될 때마다 이 연산이 실행되었다. 마운트 시 1회로 분리함으로써 불필요한 레이아웃 재계산이 완전히 제거되었다.
  - 평가: 높은 효과의 수정

- **[INFO] 격자 드로우 배치 처리** (`OpponentBoard.tsx`, draw useEffect)
  - 위치: `ctx.beginPath()` 단일화 → `ctx.stroke()` 1회 호출
  - 상세: 이전에는 32회(`VISIBLE_ROWS+1 + BOARD_COLS+1`)의 독립 path 생성/stroke 호출이 있었다. 단일 path로 배치 처리하여 canvas 상태 머신 전환 횟수를 32→1로 줄였다.
  - 평가: canvas 렌더링 최적화의 모범 사례

- **[INFO] 단일 플레이어 상태만 broadcast** (`server.mjs` `state_update`)
  - 위치: `broadcastAll(session, { states: { [playerId]: msg.state } })`
  - 상세: 이전에는 모든 플레이어 상태를 매 업데이트마다 전송(O(P²) 데이터). 이제 변경된 플레이어의 상태만 전송(O(1) 데이터)하고 클라이언트에서 incremental merge. 5명 기준 약 4배 payload 감소.

- **[INFO] `sessionsByPassword` 역방향 Map** (`server.mjs`)
  - 위치: `findSessionByPassword` 함수
  - 상세: 세션 전수 탐색 O(n) → O(1) Map 조회로 개선. 세션 수가 늘어날수록 효과적.

---

#### 잠재적 문제

- **[WARNING] `touchSession` 매 state_update 호출** (`server.mjs`, `state_update` 핸들러)
  - 위치: `touchSession(session)` — `state_update` case 내부
  - 상세: 5명 × 10fps = 초당 50회 `clearTimeout + setTimeout` 쌍이 실행된다. Node.js 타이머는 경량이지만, TTL 초기화 목적에 비해 타이머 객체 생성·GC 빈도가 불필요하게 높다. 실활동 시점만 기록하고 주기적 체크로 대체하면 타이머 churn을 제거할 수 있다.
  - 제안:
    ```js
    // touchSession 대신
    session.lastActivity = Date.now();
    // 별도 setInterval로 주기적 체크
    setInterval(() => {
      const now = Date.now();
      for (const [id, session] of sessions) {
        if (now - session.lastActivity > SESSION_IDLE_TTL) deleteSession(id);
      }
    }, 60_000);
    ```

- **[WARNING] `getLocalIP()` 매 WebSocket 연결 호출** (`server.mjs`, `connection` 핸들러)
  - 위치: `allowedOrigins` 배열 생성 내 `getLocalIP()` 호출
  - 상세: `networkInterfaces()`는 OS 시스템 콜이다. 현재 구현에서는 새 WebSocket 연결이 생길 때마다(최대 플레이어 참가 시마다) 호출된다. IP는 서버 실행 중 변경되지 않으므로 서버 시작 시 1회만 캐싱하면 충분하다.
  - 제안:
    ```js
    // app.prepare() 이전 또는 wss 초기화 시점
    const localIP = getLocalIP();
    const allowedOrigins = [
      `http://localhost:${port}`,
      `http://127.0.0.1:${port}`,
      `http://${localIP}:${port}`,
    ];
    ```

- **[INFO] `isValidWsUrl` 매 렌더 호출** (`ModeSelection.tsx`)
  - 위치: `disabled` 속성 및 `onClick` 핸들러
  - 상세: 입력 필드에 타이핑할 때마다 `new URL(endpoint.trim())`이 실행된다. URL 파싱은 단순한 문자열 비교보다 비용이 높다. 사용자가 빠르게 타이핑하는 경우 렌더 당 2회(disabled, onClick) 호출될 수 있다.
  - 제안: `useMemo`로 결과 캐시하거나, `disabled`와 `onClick` 중 하나의 결과를 재사용:
    ```tsx
    const isValid = useMemo(
      () => !playerName.trim() || !isValidWsUrl(endpoint.trim()) || !password.trim(),
      [playerName, endpoint, password]
    );
    ```

---

### 요약

이번 변경은 전반적으로 성능을 크게 개선하는 방향이다. 특히 canvas 크기 재초기화 제거, 격자 드로우 배치화, 단일 플레이어 상태 broadcast는 실측 영향이 있는 최적화다. `sessionsByPassword` 역방향 Map도 구조적으로 올바른 개선이다. 주요 잔여 이슈는 `touchSession`의 고빈도 타이머 churn이며, 현재 최대 5인 소규모 환경에서는 체감 영향이 없지만 설계 부채로 남는다. `getLocalIP()` 반복 호출은 단 몇 줄로 해결 가능한 캐싱 누락이다.

### 위험도

**LOW**