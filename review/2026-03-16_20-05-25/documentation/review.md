### 발견사항

**[INFO] 일부 공개 함수에 JSDoc 누락**
- 위치: `lib/tetris/gameEngine.ts` — `getGhostRow`, `lockAndSpawn`, `shuffleBag`, `drawFromBag`, `spawnPiece`
- 상세: `startGame`, `togglePause`는 JSDoc이 있으나, export된 `getGhostRow`와 내부 핵심 함수들(`lockAndSpawn` 등)에는 없음
- 제안: `getGhostRow`에 최소한 한 줄 JSDoc 추가 (`startGame`/`togglePause`와 일관성 유지)

**[INFO] `server.mjs` 상수들의 주석이 불완전**
- 위치: `server.mjs` — `TOUCH_DEBOUNCE_MS`, `RATE_LIMIT_WINDOW`, `RATE_LIMIT_MAX`, `BOARD_ROWS`, `BOARD_COLS`
- 상세: 일부 상수는 인라인 주석이 있고(`// 10 seconds debounce`), 일부(`BOARD_ROWS`, `BOARD_COLS`)는 없음. `BOARD_ROWS`/`BOARD_COLS`는 `constants.ts`와 중복 정의된 이유가 불명확함
- 제안: `// Mirror of lib/tetris/constants — server can't import TS directly` 같은 주석 추가

**[WARNING] `broadcast.ts`의 `calculateRankings` re-export 이유 불명확**
- 위치: `lib/multiplayer/broadcast.ts:7` — `export { calculateRankings } from "./ranking.mjs"`
- 상세: ranking 로직이 `.mjs`에 분리된 이유(서버/클라이언트 공유 목적)가 주석 없이 re-export만 존재. 새로운 개발자가 왜 `.mjs`와 `.ts`를 혼용하는지 알기 어려움
- 제안: `// Re-exported for client use — ranking.mjs is .mjs to allow direct import in server.mjs (ESM-only)` 추가

**[INFO] `useMultiplayer.ts`의 eslint-disable 대체 주석이 분산**
- 위치: `app/hooks/useMultiplayer.ts` — `handleMessage` 콜백의 `[]` deps
- 상세: `// Server now sends only the changed player's state — merge incrementally` 주석은 있으나, `useCallback(fn, [])` 의 empty deps 이유("ref pattern으로 최신 상태 접근")를 설명하는 주석이 없음
- 제안: deps 배열 위에 `// Empty deps: reads all state via refs to avoid re-registering WebSocket handler` 추가

**[INFO] `GameApp.tsx`의 AI 생성 주석이 중첩되어 가독성 저하**
- 위치: `app/components/GameApp.tsx` — 파일 전체
- 상세: 중첩된 `[worker-ants]` 태그가 함수 시그니처를 둘러싸고 있어 코드 의도 파악이 어려움 (e.g., 함수 선언 전후로 열기/닫기 태그 4개가 연속). 이는 CLAUDE.md에 의거 삭제 불가이나 문서화 노이즈
- 제안: 리뷰 기록 목적의 태그임을 인지하고 별도 처리 불필요 (CLAUDE.md 규정 준수)

**[INFO] `GameState` 상태 전이 다이어그램이 `types.ts`에만 존재**
- 위치: `lib/tetris/types.ts:18-25`
- 상세: 상태 전이 JSDoc이 `types.ts`에 잘 작성되어 있으나, `gameEngine.ts`의 개별 함수들은 이 전이를 구현하면서 참조가 없음
- 제안: `gameEngine.ts` 파일 상단에 `// State machine: see GameState in types.ts` 한 줄 참조 추가

**[WARNING] README/환경변수 문서 없음 (확인 필요)**
- 위치: 프로젝트 루트
- 상세: `server.mjs`에서 `PORT`, `NODE_ENV` 환경변수를 사용하지만, README에 이 변수들과 실행 방법이 문서화되어 있는지 확인 불가
- 제안: README에 `PORT` (기본 3000), `NODE_ENV` 옵션, 멀티플레이어 실행 방법(`node server.mjs` vs `npm run dev`) 명시 필요

**[INFO] `ControlsInfo.tsx`의 유니코드 이스케이프 미문서화**
- 위치: `app/components/ControlsInfo.tsx:5-8`
- 상세: `"\u2190"` 등 유니코드 이스케이프 사용 이유(화살표 렌더링 보장)가 주석 없음
- 제안: `// Arrow characters as Unicode escapes for cross-platform consistency` 또는 직접 `←` 문자 사용

---

### 요약

전반적으로 문서화 수준은 양호한 편입니다. `types.ts`의 상태 전이 다이어그램, `server.mjs`의 각 핸들러 함수 JSDoc, `rotation.ts`의 벽킥 오프셋 주석 등 핵심 복잡 로직에 적절한 문서가 존재합니다. 주요 개선 여지는 `.mjs`/`.ts` 혼용 구조의 이유 명시, `BOARD_ROWS`/`BOARD_COLS` 중복 정의 이유, 환경변수 문서화 세 가지이며, 나머지는 일관성 개선 수준의 소소한 사항입니다.

### 위험도

**LOW**