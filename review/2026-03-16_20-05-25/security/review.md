## 발견사항

### 서버 (server.mjs)

- **[CRITICAL]** 클라이언트 권위적 점수 신뢰
  - 위치: `handleStateUpdate()`, `checkRoundEnd()`
  - 상세: 클라이언트가 전송하는 `state.score`를 서버가 그대로 신뢰하여 순위 산정에 사용. 악의적인 클라이언트가 `score: 999999999`를 전송하면 항상 1위.
  - 제안: 서버 측에서 독립적으로 점수를 추적하거나, 최소한 이전 점수 대비 증가분이 물리적으로 가능한 범위인지 검증 필요.

- **[WARNING]** 동일 연결에서 세션 중복 생성/참가 가능
  - 위치: `handleCreateSession()`, `handleJoinSession()`
  - 상세: `conn.playerId`가 이미 설정된 경우에 대한 검사 없음. 동일 WebSocket에서 `create_session`을 두 번 호출하면 새 플레이어 ID와 세션이 추가로 생성되며, `conn.sessionId`가 덮어써짐.
  - 제안: 두 핸들러 앞에 `if (conn.playerId) return;` 가드 추가.

- **[WARNING]** `isValidState()` 에서 점수 상한 및 셀 색상값 미검증
  - 위치: `server.mjs` `isValidState()`
  - 상세: `state.score`가 `Number.MAX_SAFE_INTEGER` 혹은 `Infinity`여도 통과됨. 보드 셀 값이 `null` 또는 임의의 문자열을 허용하므로 브로드캐스트 데이터에 예상치 못한 값이 섞일 수 있음. `activePiece`는 구조 검증 없음.
  - 제안: 점수 상한(`MAX_SCORE`) 적용, 셀 값을 허용된 색상 집합(`Set<string>`)에 대해 검증, `activePiece` 필드 타입 및 범위 검증.

- **[WARNING]** WebSocket 암호화 미적용 (ws:// only)
  - 위치: `server.mjs` — endpoint 생성 로직, `useMultiplayer.ts` — host wsUrl 구성
  - 상세: 세션 비밀번호·플레이어 이름·게임 상태가 모두 평문으로 전송됨. LAN 환경 전제이나 같은 네트워크의 공격자가 패킷을 캡처하면 비밀번호 획득 가능.
  - 제안: 프로덕션 배포 시 TLS 종단(역방향 프록시 또는 wss://) 권고. 현재 구조상 LAN 전용임을 문서화.

- **[WARNING]** Origin 헤더 스푸핑 가능성
  - 위치: `server.mjs` — CSWSH 검증
  - 상세: `req.headers.origin`은 브라우저가 설정하지만 `websocat` 같은 CLI 도구로 스푸핑 가능. 서버 측 인증이 origin 검사뿐이므로, 비브라우저 클라이언트가 임의 점수를 전송할 수 있음.
  - 제안: Origin 검사는 CSWSH 방어로서 유효하나, 게임 무결성은 서버 권위적 검증으로만 보장 가능함을 인지.

- **[INFO]** 플레이어 ID 엔트로피 낮음 (32비트)
  - 위치: `generateId()` — `crypto.randomBytes(4)`
  - 상세: 세션 내 플레이어 인증에 사용되는 ID가 4바이트(~42억 경우의 수). 세션 내 플레이어 수가 적어 실질적 위협은 낮지만, 세션 password와 동일한 강도(8바이트)로 통일 권장.

- **[INFO]** `checkRoundEnd` — `singleSurvivor` 조기 종료
  - 위치: `checkRoundEnd()`
  - 상세: 플레이어가 연결 해제되면 `players.length === 1`이 되어 게임 중 즉시 라운드 종료. 남은 플레이어가 아직 state를 전송하지 않았으면 `score = 0`으로 집계됨.

### 클라이언트 (useMultiplayer.ts, ModeSelection.tsx)

- **[INFO]** 비밀번호 평문 노출 (UI)
  - 위치: `MultiplayerGame.tsx` — `{mp.sessionInfo.password}` 렌더링
  - 상세: 세션 비밀번호가 화면에 그대로 노출됨. 화면 공유 시 유출 가능. 보안 요구사항이 높지 않은 LAN 게임이므로 용인 가능하나, 가시성 토글 추가 고려.

- **[INFO]** `msg.states` 타입 검증 부재 (클라이언트)
  - 위치: `useMultiplayer.ts` — `state_broadcast` 처리
  - 상세: 서버로부터 받은 `msg.states`의 개별 항목을 타입 검증 없이 `opponentStates`에 저장. 캔버스 렌더링이므로 XSS 위협은 없으나, 예상치 못한 구조로 런타임 오류 유발 가능.

---

### 요약

이 코드베이스는 LAN 멀티플레이어 테트리스에 적합한 수준의 보안 조치(Origin 검증, 속도 제한, 메시지 크기 제한, 입력 새니타이징, 세션 비밀번호에 `crypto.randomBytes` 사용)를 갖추고 있습니다. 가장 심각한 문제는 **클라이언트가 보고하는 점수를 서버가 무조건 신뢰**한다는 점으로, 이는 악의적 플레이어가 순위를 조작할 수 있는 구조적 취약점입니다. 세션 중복 참가 가드 누락과 게임 상태 필드 검증 미흡도 개선이 필요합니다. 인터넷 공개 배포가 아닌 신뢰된 LAN 환경을 전제로 한다면 전반적 위험도는 관리 가능한 수준입니다.

### 위험도

**MEDIUM** (LAN 내부 신뢰 환경 기준) / **HIGH** (인터넷 공개 배포 시)