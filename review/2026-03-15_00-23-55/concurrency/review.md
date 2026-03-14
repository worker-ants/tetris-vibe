## 동시성 코드 리뷰

### 발견사항

---

- **[WARNING]** `useEffect` StrictMode 이중 실행 시 무음 연결 실패
  - 위치: `app/hooks/useMultiplayer.ts` — `connect()` / `app/components/MultiplayerGame.tsx` — `useEffect(() => { mp.connect(); }, [])`
  - 상세: React 18 StrictMode(개발 환경)에서 effect는 mount → cleanup → remount 순으로 두 번 실행된다. 첫 번째 `connect()` 호출로 `wsRef.current = ws1`이 설정된다. StrictMode cleanup이 `wsRef.current?.close()`를 호출하지만 `wsRef.current`를 `null`로 초기화하지 않는다. 두 번째 effect 실행 시 `if (wsRef.current) return` 가드가 닫힌 WebSocket 인스턴스를 보고 조기 반환한다. 이후 `ws.onclose` 콜백이 비동기로 실행되어 `wsRef.current = null`이 되지만, 두 번째 `connect()` 호출은 이미 종료된 상태다. 결과적으로 개발 환경에서 컴포넌트는 마운트되지만 WebSocket 연결이 수립되지 않는다.
  - 제안: cleanup 함수에서 `wsRef.current = null` 초기화 추가.
    ```ts
    useEffect(() => {
      return () => {
        wsRef.current?.close();
        wsRef.current = null; // 추가
      };
    }, []);
    ```

---

- **[WARNING]** idle 타이머 만료 시 `ws.on("close")` 핸들러와의 실행 순서 의존
  - 위치: `server.mjs` — `touchSession()` 타임아웃 콜백, `ws.on("close")` 핸들러
  - 상세: `touchSession` 타임아웃이 만료되면 각 플레이어의 `ws.close()`를 호출한 뒤 즉시 `deleteSession(session.id)`를 실행한다. Node.js 이벤트 루프에서 `ws.close()`에 의해 스케줄된 `close` 이벤트는 현재 콜백이 반환된 후 실행된다. 따라서 `deleteSession`이 먼저 실행되고, 이후 각 플레이어의 `ws.on("close")` 핸들러가 `sessions.get(currentSessionId)` → `undefined` → 조기 반환하는 흐름으로 안전하게 처리된다. 현재 코드는 이 순서에 묵시적으로 의존하고 있어 향후 비동기 처리 방식 변경 시 취약해질 수 있다.
  - 제안: `touchSession` 타임아웃 콜백에 주석으로 실행 순서 명시.
    ```js
    // ws.close() 이후 close 이벤트는 비동기로 실행됨.
    // deleteSession이 먼저 완료되므로 close 핸들러는 세션을 찾지 못하고 조기 반환한다.
    deleteSession(session.id);
    ```

---

- **[INFO]** `pong` 수신 시 `touchSession` 미호출로 인한 idle 만료 가능성
  - 위치: `server.mjs` — `ws.on("pong", ...)` 핸들러
  - 상세: `pong` 이벤트는 연결이 살아있음을 의미하지만 `touchSession`을 호출하지 않는다. 로비 대기 중이거나 모든 플레이어가 일시정지 상태일 때 `state_update` 메시지가 전송되지 않으면, `SESSION_IDLE_TTL`(5분) 후 활성 세션이 만료될 수 있다.
  - 제안:
    ```js
    ws.on("pong", () => {
      ws.isAlive = true;
      const session = sessions.get(currentSessionId);
      if (session) touchSession(session);
    });
    ```

---

- **[INFO]** `checkRoundEnd`에서 연결 끊긴 플레이어 상태 처리
  - 위치: `server.mjs` — `ws.on("close")` 핸들러 내 `checkRoundEnd(session)` 호출
  - 상세: 플레이어가 게임 도중 비정상 종료(disconnect)하면 `session.players.delete(playerId)` 후 `checkRoundEnd`가 호출된다. 해당 플레이어의 상태는 삭제되어 `allDead` 검사에서 제외된다. `isGameOver` 없이 떠난 플레이어는 생존자로 카운트되지 않으므로, 나머지 플레이어가 모두 사망해야 라운드가 종료된다. 의도된 동작이지만 "플레이어가 떠나면 사망 처리"하는 명시적 처리가 없어 엣지 케이스에서 라운드가 지연될 수 있다.
  - 제안: 플레이어 제거 전에 `state`를 game over로 마킹하거나, 주석으로 설계 의도를 명시.

---

### 요약

서버(`server.mjs`)는 Node.js 단일 스레드 이벤트 루프를 올바르게 활용하여 전통적인 race condition이나 deadlock은 존재하지 않는다. `checkRoundEnd`의 `gameStarted` 플래그를 이용한 idempotency 처리, `sessionsByPassword` 역방향 Map, `WebSocket.OPEN` 상수 사용 등은 적절하다. 클라이언트(`useMultiplayer.ts`)는 `handleMessageRef`와 `optionsRef` 패턴으로 stale closure를 방지하고, 함수형 setState로 상태 병합을 처리하는 것이 올바르다. 다만 React StrictMode 환경에서 `useEffect` 이중 실행으로 인해 개발 시 WebSocket 연결이 조용히 실패하는 문제가 가장 실질적인 위험이며, idle 타이머와 heartbeat 간의 누락된 `touchSession` 호출은 활성 세션의 예기치 않은 만료를 유발할 수 있다.

### 위험도
**LOW** (서버는 단일 스레드로 안전, 클라이언트 이슈는 개발 환경 한정 또는 엣지 케이스)