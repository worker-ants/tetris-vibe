## 보안 코드 리뷰

### 발견사항

---

#### server.mjs

- **[CRITICAL]** WebSocket 메시지 입력값 미검증으로 인한 메모리 소진 공격 가능
  - 위치: `server.mjs`, `state_update` 핸들러 (~line 230)
  - 상세: `msg.state`를 구조 검증 없이 그대로 저장함. 악의적인 클라이언트가 수백 MB의 JSON 객체를 반복 전송하면 서버 메모리를 소진시킬 수 있음
  - 제안: `msg.state`의 크기/구조를 검증하고, 연결당 상태 업데이트에 size limit 추가

- **[CRITICAL]** WebSocket Origin 헤더 미검증 (CSWSH)
  - 위치: `server.mjs`, `wss.on("connection", ...)` (~line 120)
  - 상세: WebSocket 서버가 `Origin` 헤더를 검증하지 않아, 다른 도메인의 악성 웹페이지가 피해자의 브라우저를 통해 WebSocket에 연결하는 Cross-Site WebSocket Hijacking 공격이 가능
  - 제안:
    ```javascript
    wss.on("connection", (ws, req) => {
      const origin = req.headers.origin;
      const allowedOrigins = [`http://localhost:${port}`];
      if (!allowedOrigins.includes(origin)) {
        ws.close(1008, "Invalid origin");
        return;
      }
      // ...
    });
    ```

- **[HIGH]** 세션 비밀번호 브루트포스 취약점
  - 위치: `server.mjs`, `generatePassword()` (line 23), `findSessionByPassword()` (line 73)
  - 상세: 비밀번호가 4바이트(32비트, 약 42억 조합)로 생성되며 시도 횟수 제한이 없음. 자동화된 공격으로 분당 수천 번 시도 가능
  - 제안: 비밀번호를 최소 8바이트로 늘리고, IP당 로그인 시도 횟수 제한(rate limiting) 추가

- **[HIGH]** 서버 측 플레이어 이름 길이 미검증
  - 위치: `server.mjs`, `create_session` / `join_session` 핸들러
  - 상세: 클라이언트의 `maxLength={16}` 제한은 서버에서 강제되지 않음. 악의적인 클라이언트가 수 MB의 플레이어 이름을 전송 가능하며, 이를 전체 세션에 브로드캐스트함
  - 제안:
    ```javascript
    const name = (msg.playerName || "Host").slice(0, 32);
    ```

- **[HIGH]** 세션 생성 수 무제한
  - 위치: `server.mjs`, `create_session` 핸들러 (~line 133)
  - 상세: `sessions` Map의 크기 제한이 없어 공격자가 수백만 개의 세션을 생성하여 서버 메모리를 소진시킬 수 있음
  - 제안: 최대 세션 수 상수(예: 1000)를 정의하고 초과 시 거부

- **[MEDIUM]** 서버가 모든 인터페이스에서 수신 대기 (0.0.0.0)
  - 위치: `server.mjs`, line 297: `server.listen(port, "0.0.0.0", ...)`
  - 상세: 방화벽 규칙이 없는 환경에서 서버가 퍼블릭 네트워크에 노출될 수 있음. 개인 LAN 게임 용도라면 의도적일 수 있으나 명시적 문서화가 필요
  - 제안: 프로덕션 배포 시 방화벽 구성 필수화하고, README에 보안 고려사항 명시

---

#### ModeSelection.tsx

- **[HIGH]** 비밀번호 입력 필드가 평문 노출
  - 위치: `ModeSelection.tsx`, Guest step의 Password 입력 필드 (~line 107)
  - 상세: `type="text"`로 설정되어 비밀번호가 화면에 그대로 표시됨. 어깨너머 훔쳐보기(shoulder surfing), 화면 공유 등에 취약
  - 제안:
    ```jsx
    <input
      type="password"  // "text" → "password"로 변경
      value={password}
      ...
    ```

- **[MEDIUM]** Guest 엔드포인트 URL 미검증
  - 위치: `ModeSelection.tsx`, Guest step의 Endpoint 입력 (~line 96)
  - 상세: 사용자가 입력한 임의의 URL이 검증 없이 `useMultiplayer`로 전달됨. `ws://` 또는 `wss://` 외의 프로토콜이나 내부 네트워크 주소 입력이 가능
  - 제안:
    ```javascript
    const isValidWsUrl = (url: string) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
      } catch { return false; }
    };
    ```

---

#### useMultiplayer.ts

- **[MEDIUM]** 서버 메시지 구조 미검증
  - 위치: `useMultiplayer.ts`, `handleMessage` (~line 55)
  - 상세: `JSON.parse(event.data)`의 결과를 타입 단언(`as ServerMessage`)으로만 처리함. TypeScript 타입은 런타임에 강제되지 않으므로, 악의적이거나 오작동하는 서버가 예상치 못한 구조의 메시지를 보내면 런타임 오류 또는 예기치 않은 상태 변경이 발생 가능
  - 제안: 메시지 수신 시 `msg.type`과 필수 필드의 존재를 명시적으로 검증

- **[LOW]** `handleMessage`의 JSON.parse 예외 미처리
  - 위치: `useMultiplayer.ts`, line ~56
  - 상세: 서버가 비정상 JSON을 전송하면 `JSON.parse`가 예외를 던지고 React 상태 업데이트 흐름이 중단될 수 있음. (서버 자체가 신뢰되는 경우 낮은 위험도)
  - 제안:
    ```javascript
    let msg: ServerMessage;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    ```

---

#### OpponentBoard.tsx

- **[LOW]** 미검증 색상 문자열을 canvas fillStyle에 직접 사용
  - 위치: `OpponentBoard.tsx`, `drawMiniCell` 함수 및 useEffect 내 (~line 80)
  - 상세: `state.board[boardRow]?.[c]`의 색상 문자열이 `ctx.fillStyle = color`에 그대로 사용됨. 악의적인 서버가 비정상적인 문자열을 전송해도 Canvas API는 이를 무시하므로 직접적 위협은 낮으나, 데이터 신뢰 경계 설정이 필요
  - 제안: 색상값을 허용 목록(allowlist)과 비교하거나 정규식으로 검증 (`/^#[0-9a-fA-F]{6}$/`)

---

### 요약

이 멀티플레이 테트리스 구현은 프론트엔드(React/JSX)의 XSS 방어는 프레임워크 수준에서 잘 처리되어 있으나, WebSocket 서버(`server.mjs`) 측에서 심각한 보안 결함들이 발견되었습니다. 가장 중요한 문제는 Origin 검증 부재로 인한 CSWSH 취약점, 메시지 크기 제한 없이 상태를 저장/브로드캐스트하여 발생하는 메모리 소진 공격 가능성, 브루트포스 방어 부재입니다. 또한 클라이언트에서 비밀번호 필드가 평문 노출되는 UX 보안 문제도 즉시 수정이 필요합니다. 이 게임은 LAN 환경 전용이더라도, 신뢰할 수 없는 참가자가 존재하는 네트워크에서는 위 취약점들이 악용될 수 있습니다.

### 위험도

**HIGH**