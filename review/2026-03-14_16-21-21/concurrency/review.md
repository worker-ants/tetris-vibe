### 발견사항

---

- **[WARNING]** `useMultiplayer.ts` — WebSocket 메시지 핸들러 스테일 클로저 캡처
  - 위치: `useMultiplayer.ts`, `connect` 콜백 내 `ws.onmessage = handleMessage`
  - 상세: `connect`는 연결 시점의 `handleMessage` 참조를 WebSocket에 직접 할당. `handleMessage`가 `[options.playerName]` 의존성으로 `useCallback`에 묶여 있어, 이론상 playerName이 바뀌면 WebSocket은 구버전 핸들러를 계속 사용하게 됨. 실제로는 config가 마운트 시점에 고정되어 무해하지만, 구조적으로 불안정한 패턴.
  - 제안:
    ```ts
    const handleMessageRef = useRef(handleMessage);
    handleMessageRef.current = handleMessage;
    // ws.onmessage에는 ref를 경유하는 래퍼 등록
    ws.onmessage = (e) => handleMessageRef.current(e);
    ```

---

- **[INFO]** `server.mjs` — `checkRoundEnd` 중복 호출 가드는 올바르게 작동
  - 위치: `server.mjs:checkRoundEnd`, `state_update` 케이스
  - 상세: 여러 클라이언트가 거의 동시에 `state_update`를 전송하면 `checkRoundEnd`가 반복 호출된다. 그러나 Node.js는 단일 스레드 이벤트 루프이므로 각 메시지는 순차 처리되고, `session.gameStarted = false` 설정이 원자적으로 완료된 뒤 다음 메시지가 처리된다. `round_end` 중복 브로드캐스트는 발생하지 않음.
  - 제안: 의도를 명확히 하는 주석 추가 권장.
    ```js
    // Node.js single-threaded: no race between handlers; gameStarted acts as idempotency guard
    broadcastAll(session, { type: "round_end", rankings });
    session.gameStarted = false;
    ```

---

- **[INFO]** `broadcast.ts:30` — `calculateRankings`가 입력 배열을 직접 변경
  - 위치: `broadcast.ts`, `calculateRankings` 함수
  - 상세: `.sort()`는 원본 배열을 in-place 변경. 현재는 테스트에서만 사용되고 실제 서버 코드(`server.mjs`)는 독자적인 정렬을 사용하므로 무해하지만, 호출자의 배열을 예기치 않게 변경하는 부작용이 있음.
  - 제안:
    ```ts
    return [...players]
      .sort((a, b) => b.score - a.score)
      .map(...)
    ```

---

- **[INFO]** `server.mjs` — 비정상 종료 시 세션 정리 메커니즘 부재
  - 위치: `server.mjs`, `sessions` Map
  - 상세: 세션 제거는 WebSocket `close` 이벤트에만 의존. 네트워크 단절로 `close`가 지연되거나 누락되면 빈 세션이 메모리에 잔류할 수 있음. 장시간 운영 시 메모리 누수 가능성.
  - 제안: 세션별 TTL 또는 ping/pong heartbeat 기반 생존 확인 로직 추가.

---

- **[INFO]** `useMultiplayer.ts` — `connect` 중복 호출 방어 없음
  - 위치: `useMultiplayer.ts`, `connect` 콜백
  - 상세: 기존 WebSocket이 열려 있는 상태에서 `connect`가 다시 호출되면 `wsRef.current`를 덮어쓰고 이전 연결이 누수됨. `MultiplayerGame`의 `useEffect([], ...)` 패턴으로 현재는 1회만 호출되어 무해하지만, API가 외부에 노출되어 있어 잠재적 위험 존재.
  - 제안:
    ```ts
    const connect = useCallback(() => {
      if (wsRef.current) return; // 중복 연결 방지
      ...
    }, [options, handleMessage]);
    ```

---

### 요약

이 코드베이스는 동시성 관점에서 전반적으로 안전하게 설계되어 있다. 서버(`server.mjs`)는 Node.js의 단일 스레드 이벤트 루프 특성을 활용하여 공유 상태(`sessions` Map)에 대한 실질적인 경쟁 조건이 발생하지 않으며, `checkRoundEnd`의 `gameStarted` 플래그 가드도 의도대로 동작한다. 클라이언트(`useMultiplayer.ts`, `TetrisGame.tsx`)는 React의 `useRef`를 이용한 최신 콜백 참조 패턴을 올바르게 적용했고, 상태 업데이트 배칭도 React 18 기준으로 적절하다. 다만 WebSocket 메시지 핸들러를 연결 시점에 직접 할당하는 스테일 클로저 패턴, `calculateRankings`의 입력 배열 변경, 세션 TTL 부재는 개선이 필요한 부분이다.

### 위험도

**LOW**