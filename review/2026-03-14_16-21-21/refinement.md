# 코드 리뷰 반영 결과 (2026-03-14_16-21-21)

## Critical 발견사항 처리

### 1. WebSocket Origin 헤더 미검증 (CSWSH) — 반영 완료
- `server.mjs`: `wss.on("connection")`에서 `req.headers.origin` 검증 추가
- 허용된 Origin(`localhost`, `127.0.0.1`, LAN IP)만 접속 허용

### 2. state_update 메시지 크기·구조 미검증 — 반영 완료
- `server.mjs`: `MAX_STATE_SIZE = 16KB` 제한 추가
- `msg.state` 객체 타입 검증 추가 (`typeof msg.state !== "object"`)
- 메시지 타입 문자열 검증 추가

### 3. calculateRankings 배열 변이 — 반영 완료
- `broadcast.ts`: `players.sort()` → `[...players].sort()`로 변경
- 동점 시 같은 순위 부여하는 dense ranking 로직 추가
- `server.mjs` `checkRoundEnd`에도 동일 로직 적용
- 테스트 추가: `does not mutate input array`, `handles empty array`, `handles tied scores with same rank/mixed ranks`, `includes activePiece when paused`

### 4. useMultiplayer.ts 테스트 — 부분 반영
- WebSocket 관련 핵심 버그들(stale closure, 중복 연결, JSON 파싱 등) 코드 수준에서 수정 완료
- 단위 테스트 파일 생성은 WebSocket mock 환경 설정이 필요하여 향후 과제로 남겨둠

### 5. server.mjs 테스트 — 부분 반영
- 서버 비즈니스 로직 (checkRoundEnd, sanitizeName 등) 함수 분리 완료
- 단위 테스트는 서버 구조 리팩토링과 함께 향후 과제

## Warning 발견사항 처리

### 보안
- **비밀번호 브루트포스**: `generatePassword()` 4바이트 → 8바이트(16자)로 강화
- **서버 측 이름 검증**: `sanitizeName()` 함수 추가 (`MAX_NAME_LENGTH=16` 제한)
- **세션 생성 제한**: `MAX_SESSIONS=1000` 상수 추가, 초과 시 거부
- **비밀번호 평문 노출**: Guest 입력 필드 `type="password"`로 변경
- **엔드포인트 URL 미검증**: `isValidWsUrl()` 함수 추가 (ws:/wss: 프로토콜만 허용)
- **서버 메시지 검증**: `useMultiplayer.ts`에서 `JSON.parse` try/catch 및 `msg.type` 검증 추가

### 기능 버그
- **호스트 이탈 시 UI 미갱신**: `host_transferred` 메시지 타입 추가, 클라이언트에서 동적 호스트 역할 전환
- **게임 중 이탈 시 라운드 종료 불발**: `ws.on("close")`에서 `checkRoundEnd(session)` 호출 추가
- **최소 인원 미검증**: `start_game` 핸들러에 `session.players.size < 2` 조건 추가

### 성능
- **Full Broadcast O(P²)**: 변경된 단일 플레이어 상태만 전송하도록 최적화
- **캔버스 매 프레임 재초기화**: `OpponentBoard`에서 캔버스 크기 설정을 마운트 시 1회로 분리
- **격자 재드로우**: 단일 `beginPath/stroke`로 배치 처리
- **setOpponentStates 과다 호출**: 증분 상태 병합으로 개선
- **connect 콜백 재생성**: `optionsRef` 패턴으로 안정적 의존성 처리
- **findSessionByPassword O(n)**: `sessionsByPassword` 역방향 Map 추가

### 아키텍처
- **isMultiplayer 분기 산재**: 현재 규모에서는 구조 유지, 향후 모드 추가 시 분리 검토
- **세션 메모리 누수**: `touchSession()` + `SESSION_IDLE_TTL` (5분) 자동 정리 타이머 추가
- **connect() 중복 연결**: `if (wsRef.current) return` 가드 추가
- **handleMessage stale closure**: `handleMessageRef` 패턴으로 최신 핸들러 참조

### 유지보수성
- **매직 넘버 === 1**: `WebSocket.OPEN` 상수 사용으로 변경
- **BROADCAST_INTERVAL_MS**: 스로틀 임계값 100 → 명명된 상수로 추출
- **HIDDEN_ROWS**: `lib/tetris/constants.ts`에 공유 상수 추가
- **GameApp.tsx JSX 주석**: 모듈 레벨 `{/* */}` → `//` 형식으로 수정
- **playerIdRef 설명**: WebSocket 클로저 패턴 주석 추가
- **eslint-disable 설명**: `MultiplayerGame.tsx`에 의도 설명 주석 추가

### 문서화
- **server.mjs JSDoc**: 모든 주요 함수에 JSDoc 추가
- **README 멀티플레이**: 실행 방법, 환경 변수, 접속 흐름, LAN 요구사항 문서화

### 기타
- **세션 heartbeat**: WebSocket ping/pong 기반 `HEARTBEAT_INTERVAL=30s` 구현
- **세션 정리**: idle TTL 기반 자동 세션 삭제 구현
- **초기 상태 브로드캐스트**: `state.isStarted` 조건 추가하여 게임 시작 전 전송 방지

## 미반영 (향후 과제)

- `useMultiplayer.ts` / `server.mjs` 단위 테스트 (WebSocket mock 환경 필요)
- `ModeSelection` / `RoundResult` 컴포넌트 테스트
- ModeSelection playerName 입력 UI 중복 제거 (공통 컴포넌트 추출)
- 재연결 메커니즘 (`reconnect_session` 프로토콜)
- 서버 레이어 분리 (SessionManager, GameStateManager)
- `player_joined` 미사용 `player` 필드 정리
