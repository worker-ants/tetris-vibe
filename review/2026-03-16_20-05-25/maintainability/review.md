## 코드 리뷰 결과 - 유지보수성 (Maintainability)

### 발견사항

---

#### 1. AI 에이전트 마커 중첩 혼잡 (가독성)

- **[WARNING]** `GameApp.tsx`, `TetrisGame.tsx`, `MultiplayerGame.tsx`, `ModeSelection.tsx` 등 다수 파일에서 중첩된 AI 에이전트 마커가 코드 흐름을 심각하게 방해함
- **위치**: `app/components/GameApp.tsx` 전체, `app/hooks/useMultiplayer.ts` 전체
- **상세**: 열기/닫기 마커가 함수 선언 중간이나 switch-case 블록을 가로질러 삽입되어 있어, 실제 로직 구조를 파악하기 어려움. 예: `GameApp.tsx`의 함수 정의와 닫는 중괄호 사이에 마커가 삽입됨
- **제안**: CLAUDE.md에 따라 보존해야 하지만, 향후 마커 배치는 블록 중간이 아닌 의미 단위의 경계에 두도록 가이드라인 개선

---

#### 2. `server.mjs`의 매직 넘버/상수 중복 (매직 넘버)

- **[WARNING]** `server.mjs`의 `BOARD_ROWS = 22`, `BOARD_COLS = 10`이 `lib/tetris/constants.ts`에 이미 존재하는 값과 중복
- **위치**: `server.mjs:26-29`, `lib/tetris/constants.ts:4-7`
- **상세**: 서버가 `.mjs`로 작성되어 TypeScript 상수를 직접 임포트할 수 없어 복제됨. 보드 크기가 변경되면 두 곳을 동기화해야 하는 유지보수 부담이 생김
- **제안**: `lib/tetris/constants.mjs` 또는 JSON 파일로 공유 상수를 추출하거나, `server.mjs`에 명시적 주석으로 동기화 의존성 표시

---

#### 3. `GameBoard.tsx`와 `OpponentBoard.tsx`의 셀 드로잉 로직 중복 (중복 코드)

- **[WARNING]** `drawCell()` (GameBoard.tsx:100-117)와 `drawMiniCell()` (OpponentBoard.tsx:끝부분)가 동일한 3D 하이라이트/그림자 렌더링 로직을 가짐
- **위치**: `app/components/GameBoard.tsx:100-117`, `app/components/OpponentBoard.tsx` 하단
- **상세**: 두 함수 모두 `rgba(255,255,255,0.3)` 하이라이트와 `rgba(0,0,0,0.3)` 그림자를 그리는 동일한 패턴. 셀 시각적 스타일 변경 시 두 곳을 모두 수정해야 함
- **제안**: `lib/tetris/renderUtils.ts`에 `drawStyledCell(ctx, x, y, size, color)` 유틸리티 함수로 추출

---

#### 4. `useMultiplayer.ts`의 함수 길이 및 복잡도 (함수 길이)

- **[WARNING]** `handleMessage` 콜백 (약 70줄)과 `connect` 함수 (약 50줄)가 단일 함수 안에 너무 많은 케이스/로직을 포함
- **위치**: `app/hooks/useMultiplayer.ts:handleMessage`, `connect`
- **상세**: `handleMessage`의 switch-case가 8개 케이스를 처리하며, 각 케이스가 상태 업데이트 로직을 인라인으로 포함. 새 메시지 타입 추가 시 이 함수를 수정해야 함
- **제안**: 케이스별 핸들러(`handleSessionCreated`, `handlePlayerJoined` 등)로 분리하거나, reducer 패턴 적용 고려

---

#### 5. `ModeSelection.tsx`의 Guest 입력 필드 포맷팅 불일치 (일관성)

- **[INFO]** Password `<input>`이 한 줄로 작성되어 있어 다른 입력 필드의 멀티라인 포맷과 불일치
- **위치**: `app/components/ModeSelection.tsx:115`
- **상세**: Name, Endpoint 입력은 멀티라인으로 작성되어 있으나 Password 입력만 한 줄로 작성됨. 코드 리뷰 및 diff 확인 시 가독성 저하
- **제안**: 다른 입력 필드와 동일한 포맷으로 통일

---

#### 6. `page.tsx`의 중첩 AI 마커 (가독성)

- **[INFO]** 파일 최상단과 JSX 내부에 각각 다른 타임스탬프의 마커가 중첩되어 실제 코드가 7줄임에도 마커 포함 시 14줄로 2배 증가
- **위치**: `app/page.tsx` 전체
- **상세**: 두 마커가 완전히 동일한 내용을 감싸고 있어 외부 마커가 내부 마커보다 추가적인 가치를 제공하지 않음
- **제안**: 마커 중첩 없이 파일 단위 단일 마커 사용 정책 수립

---

#### 7. `useMultiplayer.ts`의 `isHost` 파생 로직 (가독성)

- **[INFO]** `isHost` 계산에서 `playerId`가 없을 때 `options.role === "host"`를 fallback으로 사용하는 이중 로직
- **위치**: `app/hooks/useMultiplayer.ts` 하단부 `isHost` 계산
- **상세**: `playerId`는 서버 확인 후에만 설정되므로, 연결 전 상태에서 `options.role`을 사용하는 것은 이해할 수 있으나, 이 이중 경로는 주석 없이는 의도 파악이 어려움
- **제안**: 주석으로 두 경로의 목적을 명확히 문서화 (이미 일부 있으나 `options.role` fallback 이유 설명 추가)

---

#### 8. `GameBoard.tsx`의 `hiddenRows` 매직 리터럴 (매직 넘버)

- **[INFO]** `const hiddenRows = 2`가 `constants.ts`에 `HIDDEN_ROWS = 2`로 이미 정의되어 있음에도 로컬 변수로 재선언
- **위치**: `app/components/GameBoard.tsx:47`
- **상세**: `OpponentBoard.tsx`는 `HIDDEN_ROWS`를 임포트해서 사용하는 반면, `GameBoard.tsx`는 로컬 상수로 재정의함. 일관성 없음
- **제안**: `HIDDEN_ROWS` 상수 임포트로 통일

---

### 요약

전체적으로 코드는 명확한 책임 분리(게임 엔진, 렌더링, 상태 관리, 네트워킹), 잘 정의된 타입 시스템, 적절한 상수 추출을 갖추고 있어 유지보수성 기반은 양호합니다. 주요 우려사항은 AI 에이전트 마커가 여러 파일에서 코드 블록 중간에 중첩 삽입되어 실제 로직 구조 파악을 방해한다는 점, `server.mjs`와 `constants.ts` 간 보드 크기 상수 중복, 그리고 `GameBoard`와 `OpponentBoard`의 셀 드로잉 로직 중복입니다. `useMultiplayer` 훅은 메시지 처리 로직이 단일 함수에 집중되어 있어 새 서버 이벤트 추가 시 수정 범위가 큽니다. 이러한 문제들은 즉각적인 기능 결함을 일으키지는 않지만, 장기적으로 변경 비용을 높이는 요소입니다.

### 위험도

**LOW**