### 발견사항

- **[WARNING]** `state_broadcast` 메시지의 의미론적 파괴적 변경 (Breaking Change)
  - 위치: `server.mjs` state_update 핸들러, `useMultiplayer.ts` `state_broadcast` 케이스
  - 상세: 서버가 기존의 전체 플레이어 상태 스냅샷 전송에서 변경된 단일 플레이어 상태만 전송하도록 변경됨. `types.ts`의 타입 정의(`states: Record<string, BroadcastState>`)는 동일하게 유지되어 타입 시스템이 이 의미론적 변경을 감지하지 못함. 이 프로토콜을 구현하는 구버전 클라이언트(혹은 이전 방식을 가정하고 작성된 코드)는 전체 상태를 수신한다고 가정하기 때문에 상대방 상태를 누락하게 됨.
  - 제안: 타입 주석에 명시적으로 "partial/incremental update" 의미를 문서화하거나, 새로운 메시지 타입(`state_patch` 등)으로 분리하여 하위 호환성 확보.

- **[WARNING]** `create_session` 실패 시 `join_result` 메시지 타입 오용
  - 위치: `server.mjs` `create_session` 핸들러 (`MAX_SESSIONS` 초과 시)
  - 상세: 서버 용량 초과로 세션 생성에 실패할 경우 `join_result` 타입으로 에러를 반환함. 이는 `create_session` 요청에 대한 응답으로 `join_result`를 사용하는 것으로, API 계약 일관성 위반. 클라이언트의 `handleMessage`에서 `join_result`가 `create_session` 실패 경로에서도 동작하지만, 프로토콜 의미상 혼란을 야기함.
  - 제안: `session_created_error` 또는 `create_session_result` 전용 메시지 타입을 추가하여 응답 의미를 명확히 분리.

- **[INFO]** 서버 측 요청 거부 시 클라이언트에 피드백 없음 (Silent Failure)
  - 위치: `server.mjs` `start_game` 핸들러, `ws.on("message")` 메시지 크기 초과 처리
  - 상세: `start_game`이 플레이어 수 부족(`< 2`)으로 거부될 때 클라이언트에 에러 메시지를 전송하지 않음. 메시지 크기 초과(`> MAX_STATE_SIZE`) 시에도 마찬가지로 묵시적으로 무시됨. 클라이언트는 요청이 처리됐는지 거부됐는지 알 수 없음.
  - 제안: `start_game_result` 메시지 타입 추가 또는 기존 에러 전달 메커니즘을 통해 거부 사유를 클라이언트에 통지.

- **[INFO]** `host_transferred` 신규 메시지 타입 추가 — 프로토콜 버전 미관리
  - 위치: `types.ts` `ServerMessage`, `useMultiplayer.ts`, `server.mjs`
  - 상세: `host_transferred`는 additive change로 기존 클라이언트에서 `switch`의 default(무시)로 처리되므로 즉각적인 파괴적 변경은 아님. 그러나 WebSocket 프로토콜에 버전 정보가 없어 향후 클라이언트-서버 버전 불일치 시 진단이 어려움.
  - 제안: 핸드셰이크(`session_created` 또는 `join_result`) 응답에 `protocolVersion` 필드 추가 검토.

- **[INFO]** Origin 검증의 유연성 부족
  - 위치: `server.mjs` `wss.on("connection")` Origin 검증 로직
  - 상세: 허용 Origin 목록이 서버 시작 시점의 `getLocalIP()`로 고정됨. 다중 네트워크 인터페이스 환경, IPv6, DHCP 재할당 등의 경우 정상 클라이언트도 거부될 수 있음. 또한 HTTP 클라이언트(curl 등)에서 Origin 헤더가 없는 경우는 `if (origin && ...)` 조건으로 통과됨 — 의도된 보안 설계인지 명확히 해야 함.
  - 제안: Origin이 없는 연결의 처리 정책을 명시적으로 문서화하고, 필요 시 거부 처리.

---

### 요약

이번 변경의 핵심 API 계약 이슈는 `state_broadcast` 메시지의 **의미론적 파괴적 변경**이다. 타입 정의(`Record<string, BroadcastState>`)는 변경되지 않았지만, 실제 전송 데이터가 "전체 스냅샷"에서 "단일 플레이어 증분 업데이트"로 바뀌었으며, 이 변경은 클라이언트 측 병합 로직과 동시에 반영되어 현재 시스템 내에서는 동작하지만 타입 시스템과 문서가 새로운 의미를 표현하지 못한다. 추가로 `create_session` 실패 응답에 `join_result`를 재사용하는 메시지 타입 오용과, 서버 측 요청 거부 시 클라이언트에 피드백이 없는 Silent Failure 패턴은 프로토콜 신뢰성을 낮추는 요소다. `host_transferred`의 추가는 적절히 클라이언트에 반영되어 있으나, 프로토콜 버전 관리 체계가 없어 향후 확장성이 취약하다.

### 위험도
**MEDIUM**