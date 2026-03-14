## 아키텍처 코드 리뷰

### 발견사항

---

#### 1. `TetrisGame.tsx` - OCP 위반 및 SRP 약화
- **[WARNING]** `isMultiplayer` 플래그로 인한 조건부 분기 확산
  - 위치: `TetrisGame.tsx` 전반 (`!isMultiplayer && ...` 패턴)
  - 상세: 기존 싱글플레이어 컴포넌트를 직접 수정해 멀티플레이어 로직을 주입. 게임보드 렌더링, 키보드 핸들링, 상태 브로드캐스팅, 모드별 UI가 한 컴포넌트에 혼재. `isMultiplayer`가 추가될수록 분기가 기하급수적으로 늘어남
  - 제안: `TetrisGame`을 순수 싱글플레이어로 유지하고, 멀티플레이어 행동은 `MultiplayerTetrisGame` 래퍼 또는 Render Props 패턴으로 분리. `onStateChange`, `autoStart`, `onBack`은 별도 인터페이스로 추출

---

#### 2. `MultiplayerGame.tsx` - SRP 위반 (다중 페이즈 관리)
- **[WARNING]** 로비/플레이/결과 세 페이즈를 단일 컴포넌트가 처리
  - 위치: `MultiplayerGame.tsx:52~205`
  - 상세: 조건부 early return으로 `lobby`, `result`, `playing` 세 가지 완전히 다른 UI를 한 컴포넌트가 렌더링. 각 페이즈는 독립적인 책임을 가짐
  - 제안: `MultiplayerLobby`, `MultiplayerPlaying`, `RoundResult` 세 컴포넌트로 분리하고 `MultiplayerGame`은 페이즈 라우터 역할만 담당

---

#### 3. `server.mjs` - 단일 파일 모놀리식 서버 (레이어 분리 부재)
- **[WARNING]** HTTP 핸들링, WebSocket 프로토콜, 세션 관리, 게임 비즈니스 로직이 306줄 단일 파일에 혼재
  - 위치: `server.mjs` 전체
  - 상세: `checkRoundEnd`, `findSessionByPassword`, `broadcastAll` 등 비즈니스 로직이 서버 엔트리포인트와 분리되지 않음. 세션 상태 만료/정리 메커니즘도 없어 메모리 누수 가능성 있음
  - 제안: `SessionManager`, `GameStateManager` 클래스로 분리. `server.mjs`는 진입점만 담당

---

#### 4. `broadcast.ts:calculateRankings` - 입력 배열 직접 변경
- **[WARNING]** Array.sort()의 in-place 변이로 인한 잠재적 버그
  - 위치: `broadcast.ts:29` — `players.sort(...)`
  - 상세: `Array.prototype.sort()`는 원본 배열을 변경함. 호출자가 원본 배열을 이후에 참조할 경우 순서가 바뀐 상태로 읽힘
  - 제안: `[...players].sort(...)` 또는 `players.toSorted(...)` 사용

---

#### 5. `useMultiplayer.ts` - `options` 객체의 참조 불안정
- **[WARNING]** `connect` 콜백의 `options` 의존성이 매 렌더마다 새 참조
  - 위치: `useMultiplayer.ts:119` — `}, [options, handleMessage]);`
  - 상세: `MultiplayerGame`이 렌더될 때마다 `options` 객체가 재생성됨. `connect`가 `useCallback`으로 메모이제이션되어도 `options` 변경으로 무효화될 수 있음. `useEffect`에서 `mp.connect()`를 `eslint-disable` 처리한 것이 이 문제의 증거
  - 제안: 옵션의 개별 원시값을 의존성으로 분리 (`role`, `playerName`, `endpoint`, `password`)

---

#### 6. `OpponentBoard.tsx` - 캔버스 초기화와 드로잉의 혼재
- **[INFO]** 매 상태 업데이트마다 캔버스 크기 및 DPR 재설정
  - 위치: `OpponentBoard.tsx:31~38`
  - 상세: `canvas.width`, `canvas.height`, `canvas.style`, `ctx.scale()` 설정이 `state`에 의존하는 `useEffect` 안에 있어 매 프레임 실행됨. 캔버스 크기가 변하지 않으면 불필요한 재설정
  - 제안: 초기화 로직을 `useEffect(()=>{...}, [])` (마운트 시 1회)로 분리하고, 드로잉만 `state` 의존 effect에 둠

---

#### 7. `server.mjs` - 세션 수명 관리 부재
- **[INFO]** 게임이 끝난 세션이 메모리에 영구적으로 잔류할 수 있음
  - 위치: `server.mjs:checkRoundEnd` 및 `ws.on('close')`
  - 상세: `round_end` 후 `gameStarted=false`로 리셋되지만 세션 자체는 삭제되지 않음. 모든 플레이어가 떠나야만 세션이 제거됨. 장기 운용 시 메모리 누수 가능
  - 제안: 라운드 종료 후 일정 시간(예: 5분) 후 세션 자동 삭제 타이머 추가

---

#### 8. `GameApp.tsx` - JSX 외부에서의 JSX 코멘트 문법 사용
- **[INFO]** AI 마커 코멘트 형식이 부적절
  - 위치: `GameApp.tsx:10~12`
  - 상세: `{/* ... */}` 형식은 JSX 표현식 내부에서만 유효. 함수 본문 최상위(JSX return 외부)에서 사용 시 JavaScript 블록문으로 파싱되어 의도한 주석 역할을 하지 못함. 현재는 동작하지만 TSX strict 설정에 따라 문제가 될 수 있음
  - 제안: JSX 외부에서는 `//` 또는 `/* */` 사용

---

### 요약

전체 아키텍처는 `lib/multiplayer/types.ts`의 discriminated union 타입 설계, `useMultiplayer` 훅의 WebSocket 추상화, `broadcast.ts`의 직렬화 분리 등 적절한 레이어 분리를 시도한 흔적이 보인다. 그러나 핵심 문제는 **기존 `TetrisGame` 컴포넌트를 확장 없이 수정(OCP 위반)** 한 것으로, `isMultiplayer` 플래그가 컴포넌트 전체에 조건 분기를 퍼뜨려 향후 모드 추가 시 유지보수 비용을 높인다. 서버 측도 단일 파일에 모든 책임이 집중되어 있어 게임 규칙 변경이나 세션 관리 고도화 시 위험 지점이 된다. `calculateRankings`의 배열 변이는 실제 버그로 이어질 수 있는 유일한 즉각적 결함이다.

### 위험도

**MEDIUM**