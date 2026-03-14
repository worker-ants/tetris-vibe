파일 쓰기 권한이 필요합니다. 허용해 주시면 `review/2026-03-14_16-21-21/SUMMARY.md`에 통합 보고서를 저장하겠습니다.

아래는 작성된 통합 보고서 내용입니다:

---

# Code Review 통합 보고서

## 전체 위험도
**HIGH** - WebSocket 서버의 보안 취약점(Origin 미검증, 입력 미검증, 무제한 세션 생성)과 테스트 미비가 실서비스 위험을 초래하며, 호스트 이탈 시 게임 진행 불가 버그가 존재함

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | WebSocket Origin 헤더 미검증 (CSWSH) — 다른 도메인의 악성 웹페이지가 피해자 브라우저를 통해 WebSocket에 연결 가능 | `server.mjs` `wss.on("connection")` | `req.headers.origin` 검증 후 허용된 Origin만 접속 허용 |
| 2 | 보안 | `state_update` 메시지 크기·구조 미검증으로 메모리 소진 공격 가능 | `server.mjs` `state_update` 핸들러 | `msg.state` 크기·구조 검증 및 연결당 size limit 추가 |
| 3 | 버그 | `calculateRankings`가 입력 배열을 in-place 변이(`Array.prototype.sort`) | `lib/multiplayer/broadcast.ts:30` | `[...players].sort(...)` 또는 `players.toSorted(...)` 사용 |
| 4 | 테스트 | `useMultiplayer.ts` 핵심 로직 테스트 전무 | `app/hooks/useMultiplayer.ts` 전체 | `vi.stubGlobal('WebSocket', MockWebSocket)` 패턴으로 테스트 작성 |
| 5 | 테스트 | `server.mjs` 서버 비즈니스 로직 테스트 전무 | `server.mjs` 전체 | 서버 함수들을 분리하여 단위 테스트 가능하게 구조 개선 |

---

## 경고 (WARNING) — 20개 항목

주요 내용:
- **보안**: 브루트포스 방어 부재, 세션 생성 무제한, 서버 측 이름 길이 미검증, 비밀번호 평문 노출, 엔드포인트 URL 미검증, 수신 메시지 구조 미검증
- **기능 버그**: 호스트 이탈 시 새 호스트 UI 미갱신, 게임 중 이탈 시 라운드 종료 불발, 최소 인원 미검증
- **성능**: Full Broadcast O(P²), 캔버스 매 프레임 재초기화, `setOpponentStates` 과다 호출
- **아키텍처**: `isMultiplayer` 분기 산재, 세션 메모리 누수, `connect()` 중복 연결 문제
- **테스트**: 동점 처리 비결정적, `ModeSelection`/`RoundResult` 테스트 없음
- **문서화**: `server.mjs` JSDoc 전무, README 미반영

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 |
|----------|--------|
| security | **HIGH** |
| testing | **HIGH** |
| performance | MEDIUM |
| architecture | MEDIUM |
| api_contract | MEDIUM |
| requirement | MEDIUM |
| maintainability | MEDIUM |
| side_effect | MEDIUM |
| documentation | MEDIUM |
| dependency | LOW |
| concurrency | LOW |
| scope | LOW |
| database | NONE |

---

## 권장 조치사항 (우선순위순)

1. **[즉시]** `calculateRankings` 배열 변이 수정 → `[...players].sort(...)`
2. **[즉시]** 비밀번호 입력 필드 `type="password"` 변경
3. **[즉시]** 서버 입력 검증 추가 (이름 길이, 메시지 크기, 최소 인원 2명)
4. **[즉시]** 세션 생성 수 제한 추가
5. **[단기]** WebSocket Origin 검증 (CSWSH 방어)
6. **[단기]** 호스트 이탈 시 `host_transferred` 메시지 구현
7. **[단기]** `ws.on("close")`에서 `checkRoundEnd` 호출
8. **[단기]** `useMultiplayer.ts` / `server.mjs` 테스트 작성
9. **[중기]** State Broadcast 구조 최적화 (단일 플레이어 상태만 전송)
10. **[중기~장기]** 캔버스 초기화 분리, README 보강, 서버 레이어 분리, heartbeat 구현