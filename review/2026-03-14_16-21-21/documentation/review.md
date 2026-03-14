## 문서화 코드 리뷰

### 발견사항

---

- **[WARNING]** `server.mjs` 서버 함수들에 JSDoc 전혀 없음
  - 위치: `server.mjs` 전체 (`generateId`, `generatePassword`, `getLocalIP`, `broadcastAll`, `broadcast`, `findSessionByPassword`, `checkRoundEnd`)
  - 상세: 멀티플레이어 세션 관리의 핵심 로직이 담긴 파일임에도 불구하고 모든 함수에 JSDoc이 없음. 특히 `broadcast(session, message, excludeId)` 의 `excludeId` 파라미터 역할, `checkRoundEnd`의 라운드 종료 판정 조건 등은 비자명한 로직임.
  - 제안: 최소한 `broadcastAll`/`broadcast` 차이, `checkRoundEnd` 조건, 세션 데이터 구조에 대한 JSDoc 추가

---

- **[WARNING]** `README.md` 멀티플레이어 기능 반영 없음
  - 위치: 프로젝트 루트
  - 상세: `package.json`에 `dev` vs `dev:solo` 스크립트가 분리되어 있고, WebSocket 서버(`server.mjs`)가 새로 추가되었으나 README에 이에 대한 설명이 없음. 멀티플레이 실행 방법, 네트워크 요구사항(LAN 환경), PORT 환경 변수, 호스트/게스트 접속 흐름 등이 문서화되어야 함.
  - 제안: README에 "멀티플레이 실행 방법", "환경 변수 설정(PORT)", "싱글플레이 전용 실행(`dev:solo`)" 섹션 추가

---

- **[WARNING]** `package.json` 스크립트 분기 이유 미기재
  - 위치: `package.json` `scripts` 섹션
  - 상세: `dev`(WebSocket 서버 포함)와 `dev:solo`(Next.js 단독)의 차이가 파일 내에서 전혀 설명되지 않음. 개발자가 어떤 스크립트를 선택해야 할지 알 수 없음.
  - 제안: README 혹은 `package.json` 내 주석(jsonc 허용 시)으로 스크립트 용도 명시

---

- **[WARNING]** `useMultiplayer.ts` — `playerIdRef` 패턴 설명 누락
  - 위치: `app/hooks/useMultiplayer.ts:53`
  - 상세: `playerIdRef`는 WebSocket 클로저에서 최신 `playerId` 상태를 참조하기 위한 패턴인데, 이에 대한 설명이 없음. 같은 파일의 `onStateChangeRef` 패턴(`TetrisGame.tsx`)은 "Notify parent of state changes" 주석이 있지만, `playerIdRef`는 왜 `useState` 대신 `useRef`를 사용해야 하는지 설명이 없음.
  - 제안: `// WebSocket 콜백에서 최신 playerId를 참조하기 위해 ref 사용 (클로저 캡처 문제 방지)` 주석 추가

---

- **[WARNING]** `eslint-disable-next-line` 억제 이유 미기재
  - 위치: `app/components/MultiplayerGame.tsx:32`
  - 상세: `// eslint-disable-next-line react-hooks/exhaustive-deps` 주석만 있고, 왜 `mp.connect`를 의존성에서 제외해도 안전한지(마운트 시 1회만 실행 의도) 설명 없음.
  - 제안: `// 마운트 시 1회만 연결 — mp.connect는 의도적으로 의존성에서 제외` 형태로 의도 명시

---

- **[INFO]** `lib/multiplayer/types.ts` — `ClientMessage`/`ServerMessage` 각 variant 설명 없음
  - 위치: `lib/multiplayer/types.ts:33-48`
  - 상세: `broadcast.ts`의 `toBroadcastState`, `calculateRankings`에는 JSDoc이 있으나, 프로토콜 정의 핵심인 메시지 타입들에는 각 variant의 목적 설명이 없음. 예: `join_result`의 `players?` 필드가 언제 포함되는지 불명확.
  - 제안: 각 메시지 타입 앞에 한 줄 주석으로 용도 기재

---

- **[INFO]** `app/components/OpponentBoard.tsx` — 렌더링 상수 설명 없음
  - 위치: `OpponentBoard.tsx:9-11`
  - 상세: `MINI_CELL_SIZE = 14`의 단위(px), 결정 근거가 없음. `hiddenRows = 2`의 의미(테트리스 보드 상단 2행은 스폰 영역으로 숨김)도 `// board data has 22 rows: 2 hidden + 20 visible` 주석이 useEffect 내부에만 있고 상수 선언 위치에는 없음.
  - 제안: 상수 선언 위치에 단위와 의미 주석 추가

---

- **[INFO]** `app/components/RoundResult.tsx` — `RANK_LABELS` 범위 초과 처리 동작 미문서화
  - 위치: `RoundResult.tsx:13-20`
  - 상세: `RANK_LABELS`는 5개까지만 정의되어 있으며, 6위 이상은 `` `${entry.rank}th` `` 폴백 처리됨. `MAX_PLAYERS = 5`와 연동되어 있지만 두 파일 간 연결이 코드 주석으로 명시되지 않음.
  - 제안: `// MAX_PLAYERS(5)와 동기화 필요` 주석 추가

---

- **[INFO]** `GameApp.tsx` — JSX 컨텍스트 외 `{/* */}` 사용
  - 위치: `GameApp.tsx:10-12`
  - 상세: AI 마커가 JSX 문법(`{/* */}`)으로 함수 선언 바깥에 작성되어 있어 TypeScript 컴파일 오류 가능성이 있음. 이는 문서화 마커가 코드 문법을 훼손한 사례.
  - 제안: 함수 외부에서는 `//` 라인 주석 사용

---

### 요약

`broadcast.ts`와 `types.ts` 일부는 JSDoc이 적절히 작성되어 있으나, 가장 복잡한 파일인 `server.mjs`와 `useMultiplayer.ts`에 함수/패턴 설명이 전무하다. 특히 WebSocket 프로토콜, 세션 관리, 클로저 캡처 패턴 등 비자명한 로직에 인라인 설명이 부족하며, 멀티플레이어 기능 추가에 따른 실행 환경 변화(커스텀 서버, LAN 요구, 스크립트 분기)가 README에 전혀 반영되지 않아 신규 개발자가 프로젝트를 온보딩하거나 배포하는 데 혼란을 줄 수 있다.

### 위험도

**MEDIUM**