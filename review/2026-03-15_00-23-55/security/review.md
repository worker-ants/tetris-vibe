## 보안 코드 리뷰

### 발견사항

---

**[CRITICAL] 서버가 클라이언트 보고 게임 상태를 무조건 신뢰**
- 위치: `server.mjs` — `case "state_update"` 핸들러
- 상세: `player.state = msg.state` 시 `isGameOver`와 `score` 값에 대한 서버 측 검증이 없습니다. 악의적인 클라이언트는 `{ isGameOver: true, score: 9999999 }`를 즉시 전송해 라운드를 조기 종료하거나 점수를 조작할 수 있습니다. `checkRoundEnd`는 이 값을 그대로 신뢰합니다.
- 제안: `score >= 0`, `isGameOver: boolean` 등 필드별 타입/범위 검증을 추가하거나, 서버에서 직접 게임 로직을 처리하는 구조로 전환하세요.

---

**[WARNING] Origin 검증이 선택적으로만 동작 (CSWSH 우회 가능)**
- 위치: `server.mjs` — `wss.on("connection")` Origin 검증 로직
- 상세: `if (origin && !allowedOrigins.includes(origin))` 조건은 Origin 헤더가 없을 때(curl, native WebSocket 클라이언트, 일부 도구) 검증을 **완전히 건너뜁니다**. 즉, 비브라우저 클라이언트는 Origin 없이 접속 가능합니다.
- 제안: Origin 헤더가 없는 경우도 차단하도록 변경하세요:
  ```js
  if (!origin || !allowedOrigins.includes(origin)) {
    ws.close(1008, "Invalid origin");
    return;
  }
  ```

---

**[WARNING] 암호화되지 않은 WebSocket (ws://) — 패스워드 평문 전송**
- 위치: `server.mjs` — `endpoint` 생성, `useMultiplayer.ts` — `join_session` 전송
- 상세: 세션 패스워드와 모든 게임 상태가 `ws://`(평문)로 전송됩니다. LAN 환경에서 ARP 스푸핑 등으로 트래픽 도청이 가능합니다.
- 제안: LAN 환경이라도 자가 서명 인증서를 이용한 `wss://` 사용을 검토하거나, 최소한 README에 보안 한계를 명시하세요 (신뢰할 수 있는 LAN 전용임을 문서화).

---

**[WARNING] 게임 상태 객체 스키마 검증 부재**
- 위치: `server.mjs` — `state_update` 핸들러
- 상세: `typeof msg.state !== "object"` 검사만으로는 부족합니다. `msg.state`는 파싱된 JSON 객체이므로 `board`, `activePiece`, `score` 등 각 필드의 타입/구조 검증 없이 저장·브로드캐스트됩니다. 조작된 `board` 배열(예: 매우 큰 2D 배열)이 다른 클라이언트로 전달되어 렌더링 오류를 일으킬 수 있습니다.
- 제안: 최소한 `score: number`, `isGameOver: boolean`, `board: Array` 등 핵심 필드의 타입 검증을 추가하세요.

---

**[WARNING] 서버 측 메시지 발송 빈도 제한 없음**
- 위치: `server.mjs` — `ws.on("message")` 핸들러
- 상세: 클라이언트 측에 `BROADCAST_INTERVAL_MS(100ms)` 스로틀이 있지만, 서버는 단일 연결에서 초당 수천 건의 메시지를 처리합니다. 악의적 클라이언트가 스로틀을 우회하여 DoS를 일으킬 수 있습니다.
- 제안: 서버에서도 연결당 메시지 빈도 제한(예: 초당 20건)을 적용하세요.

---

**[INFO] `isValidWsUrl` — `javascript:` 등 비표준 프로토콜 우회 가능성 (이미 방어됨)**
- 위치: `ModeSelection.tsx` — `isValidWsUrl()`
- 상세: `new URL(url)` 파싱 후 프로토콜을 `ws:` 또는 `wss:`로만 제한하므로, XSS 벡터(`javascript:`)는 차단됩니다. 기존 구현이 적절합니다.

---

**[INFO] `sessionsByPassword` 맵에서 패스워드 충돌 가능성**
- 위치: `server.mjs` — `generatePassword()`, `sessionsByPassword.set()`
- 상세: `crypto.randomBytes(8).toString("hex")`는 16자 hex 패스워드로 충돌 확률이 매우 낮습니다(`1/2^64`). 실용상 문제없으나, 이론적으로 기존 세션을 덮어쓸 수 있습니다.
- 제안: 세션 생성 시 패스워드 중복 여부를 확인하거나, 현재 규모에서는 무시해도 무방합니다.

---

**[INFO] 세션 패스워드 UI 노출 (설계상 의도)**
- 위치: `MultiplayerGame.tsx` — `mp.sessionInfo.password` 표시
- 상세: 호스트 화면에 패스워드가 평문으로 표시됩니다. 이는 설계상 의도된 동작이지만, 화면 공유 시 패스워드가 노출될 수 있습니다.
- 제안: 별도 표시/숨김 토글 버튼을 추가하는 것을 고려하세요.

---

### 요약

이번 변경에서 Origin 검증, 메시지 크기 제한, 패스워드 강화, 이름 새니타이징, JSON 파싱 방어, 입력 URL 검증 등 이전 리뷰에서 지적된 주요 보안 이슈 대부분이 반영되었습니다. 그러나 서버가 클라이언트 보고 게임 상태(`isGameOver`, `score`)를 무조건 신뢰하는 구조적 취약점이 남아 있어, LAN 환경 외에서는 점수 조작과 라운드 강제 종료가 가능합니다. 또한 Origin 검증이 헤더 부재 시 우회되는 점과 ws:// 평문 전송도 주의가 필요합니다. 프로젝트 목적(신뢰할 수 있는 LAN 멀티플레이)을 감안하면 현재 수준은 합리적이나, 외부 노출 환경에서는 서버 측 게임 로직 검증이 반드시 필요합니다.

### 위험도

**MEDIUM** (LAN 환경 한정 시) / **HIGH** (외부 네트워크 노출 시)