파일 쓰기 권한이 필요합니다. 권한을 허용해 주시면 `review/2026-03-15_00-23-55/SUMMARY.md`에 통합 보고서를 저장하겠습니다.

그 전에 보고서 내용을 먼저 공유합니다:

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 보안(게임 상태 신뢰, Origin 검증 우회), 아키텍처(랭킹 로직 중복·God Object), 테스트 커버리지 부족이 복합적으로 존재하나 LAN 한정 환경에서 즉각적 치명 결함은 없음

---

## Critical 발견사항 (5건)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 서버가 클라이언트 보고 `isGameOver`·`score` 값을 무조건 신뢰 — 즉시 전송으로 라운드 조기 종료·점수 조작 가능 | `server.mjs` — `case "state_update"` | 필드별 타입·범위 검증 추가 또는 서버 게임 로직 처리 |
| 2 | Architecture / Maintainability | 랭킹 로직 중복 구현(DRY 위반) — `calculateRankings`와 `checkRoundEnd`에 동점 처리 로직 각각 독립 구현, 현재도 서버 `playerId` vs 클라이언트 `id` 미묘한 차이 존재 | `broadcast.ts:calculateRankings`, `server.mjs:checkRoundEnd` | `lib/multiplayer/ranking.ts`로 분리 후 양측 import |
| 3 | Architecture | `isHost` 이중 소스 진실 — `useState(options.role === "host")`로 초기화, `host_transferred`로 동적 변경, `connect()` 내부는 여전히 `optionsRef.current.role` 참조 | `app/hooks/useMultiplayer.ts:48`, `connect()` | `players` 배열 기반 파생 상태로 전환 또는 `role` 제거 |
| 4 | Testing | `isValidWsUrl` 테스트 없음 — 보안 목적 URL 검증 함수이나 엣지 케이스 미검증 | `ModeSelection.tsx:14-20` | ws/wss 허용, http/bare IP/빈 문자열 거부 케이스 추가 |
| 5 | Testing | `checkRoundEnd` 서버 측 순위 로직 테스트 없음 — 양측 불일치 발생 시 감지 불가 | `server.mjs:148-172` | 공통 유틸 추출 후 단일 테스트 |

---

## 경고 (WARNING) - 20건

**보안(4):** Origin 우회(CSWSH) / ws:// 평문 전송 / 상태 스키마 검증 부재 / 서버 빈도 제한 없음

**API Contract(3):** `state_broadcast` 의미론적 파괴적 변경(타입 미반영) / `create_session` 실패에 `join_result` 오용 / Silent Failure(거부 미통지)

**유지보수(4):** connection 콜백 순환복잡도 15+ / `calculateRankings` JSDoc "dense ranking" 오기재 / `BOARD_ROWS` 리터럴 유지 / `MultiplayerGame.tsx` 들여쓰기 16칸→8칸 불일치

**요구사항/UX(2):** 플레이어 이탈 후 라운드 미종료 / URL 오류 피드백 없음

**동시성(1):** React StrictMode 이중 실행 시 WebSocket 무음 연결 실패(cleanup에 `wsRef.current = null` 누락)

**성능/부작용(4):** `touchSession` 초당 50회 타이머 churn / `getLocalIP()` 연결마다 재호출 / `opponentStates` 증분 병합 후 이탈 플레이어 잔류 / 호스트 이탈 시 이중 `broadcastAll`

**테스트(2):** `useMultiplayer.ts` 핵심 변경 무테스트 / `sanitizeName` 미테스트

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM/HIGH | 게임 상태 무검증, Origin 우회, 평문 전송 |
| architecture | MEDIUM | DRY 위반, isHost 이중 소스, God Object |
| maintainability | MEDIUM | 랭킹 중복, 고복잡도 핸들러, AI 마커 중첩 |
| testing | MEDIUM | 핵심 변경 무테스트 |
| api_contract | MEDIUM | 의미론적 파괴적 변경, 타입 오용 |
| requirement | LOW | 이탈 후 라운드 미종료, UX 피드백 |
| performance | LOW | 타이머 churn, getLocalIP 반복 |
| concurrency | LOW | StrictMode 무음 실패, pong touchSession 누락 |
| side_effect | LOW | 상태 잔류, 이중 broadcast, idle 만료 |
| documentation | LOW | JSDoc 오기재 |
| scope | LOW | 들여쓰기 불일치 |
| dependency | **NONE** | 신규 외부 패키지 없음 |
| database | **NONE** | 해당 없음 |

---

## 권장 조치사항 (우선순위 순)

1. **[즉시]** 게임 상태 서버 측 검증 추가 (`score`, `isGameOver`, `board` 필드)
2. **[즉시]** StrictMode WebSocket 연결 실패 수정 — cleanup에 `wsRef.current = null` 추가
3. **[단기]** 랭킹 로직 공통 유틸 추출 (`lib/multiplayer/ranking.ts`)
4. **[단기]** Origin 검증 강화 — origin 부재 시도 차단
5. **[단기]** 플레이어 이탈 후 라운드 강제 종료 처리
6. **[단기]** `calculateRankings` JSDoc "dense ranking" → "standard competition ranking" 수정
7. **[단기]** `getLocalIP()` 서버 시작 시 1회 캐싱
8. **[단기]** `pong` 핸들러에 `touchSession` 추가
9. **[중기]** `isValidWsUrl` / `sanitizeName` 테스트 작성
10. **[중기]** URL 오류 인라인 피드백 UX 개선
11. **[중기]** `state_broadcast` 타입 `Partial<Record<...>>` 으로 명세 수정
12. **[장기]** `server.mjs` `SessionManager` 추출
13. **[장기]** `useMultiplayer.ts` 단위 테스트 환경 구성