## 요구사항 관점 코드 리뷰

### 발견사항

---

**[WARNING]** 호스트 이탈 시 새 호스트 UI 미갱신 문제

- 위치: `server.mjs:267-272` (호스트 재지정 로직), `MultiplayerGame.tsx:24-28` (config.role 기반 UI)
- 상세: 서버는 호스트 이탈 시 다음 플레이어를 호스트로 재지정하지만, 클라이언트는 접속 시점의 `config.role`을 기반으로 UI를 렌더링합니다. 재지정된 새 호스트 클라이언트는 여전히 `config.role === "guest"` 상태이므로 "Waiting for host to start..." 메시지만 보이고 Start Game 버튼이 표시되지 않습니다. 게임을 시작할 수 없는 상태가 됩니다.
- 제안: `player_joined`/`player_left` 메시지에 `hostId` 정보를 포함하거나, 클라이언트에서 `mp.players`를 기반으로 현재 자신이 호스트인지 동적으로 판단하도록 수정 필요

---

**[WARNING]** `calculateRankings`에서 원본 배열 직접 변경

- 위치: `lib/multiplayer/broadcast.ts:30`
- 상세: `.sort()` 호출이 인수로 받은 배열을 제자리에서 변경합니다. 호출자(서버의 `checkRoundEnd`)는 `players.map(...)` 결과를 넘기므로 새 배열이지만, 함수 계약상 부수 효과가 있습니다. 향후 서버에서 직접 세션 플레이어 목록을 전달할 경우 세션 데이터 변형 버그로 이어질 수 있습니다.
- 제안: `players.slice().sort(...)` 또는 `[...players].sort(...)`로 복사 후 정렬

---

**[WARNING]** 서버에서 게임 시작 최소 인원 미검증

- 위치: `server.mjs:218-224` (`start_game` 핸들러)
- 상세: 클라이언트는 2명 미만 시 Start Game 버튼을 `disabled` 처리하지만, 서버 `start_game` 핸들러는 플레이어 수 검증 없이 게임을 시작합니다. 악의적 클라이언트나 버그 상황에서 1인 세션이 시작될 수 있습니다.
- 제안: `if (session.players.size < 2) break;` 조건 추가

---

**[WARNING]** 동점 처리 시 순위 로직 불일치

- 위치: `lib/multiplayer/__tests__/broadcast.test.ts:69-74`, `lib/multiplayer/broadcast.ts:32-36`
- 상세: 동점자 테스트 케이스에서 두 플레이어가 모두 500점임에도 순위를 1위, 2위로 별개 부여합니다. 요구사항 "스코어를 기반으로 순위 표시"의 일반적 의미는 동점자에게 동일 순위 부여이나, 현재는 배열 순서에 따라 임의로 결정됩니다.
- 제안: 동점 처리 방식을 명확히 정의하거나, 동점자에게 같은 순위를 부여하는 로직 추가

---

**[INFO]** 게스트 비밀번호 입력 필드 `type="text"` 사용

- 위치: `ModeSelection.tsx:101-110`
- 상세: 게스트의 비밀번호 입력 필드가 `type="text"`로 설정되어 있어 입력값이 평문으로 표시됩니다. 요구사항에서 호스트가 비밀번호를 공유하는 방식이므로 보안상 민감도는 낮지만, UX 측면에서 `type="password"` 사용이 더 자연스럽습니다.
- 제안: `type="password"` 또는 `type="text"` 의도적 선택 시 주석으로 명시

---

**[INFO]** 플레이어 이름 서버 측 유효성 검증 부재

- 위치: `server.mjs:152, 198` (`create_session`, `join_session` 핸들러)
- 상세: 클라이언트는 `maxLength={16}`으로 이름 길이를 제한하지만, 서버는 이름 길이나 내용을 검증하지 않습니다. 빈 문자열("")도 허용되며, 클라이언트 우회 시 매우 긴 문자열이 전달될 수 있습니다.
- 제안: 서버에서 `playerName` 존재 여부 및 길이 검증 추가 (예: `if (!msg.playerName?.trim() || msg.playerName.length > 16) { /* error */ }`)

---

**[INFO]** WebSocket 연결 유지 여부 미체크 (heartbeat 부재)

- 위치: `server.mjs`, `app/hooks/useMultiplayer.ts`
- 상세: WebSocket 연결이 조용히 끊어진 경우(NAT 타임아웃, 네트워크 오류 등) 서버와 클라이언트 양쪽에서 이를 감지하지 못합니다. 게임 중 연결이 끊어진 플레이어가 세션에 남아 있어 `checkRoundEnd`가 영원히 트리거되지 않는 상황이 발생할 수 있습니다.
- 제안: WebSocket ping/pong 또는 주기적 상태 전송을 활용한 연결 감지 로직 추가 고려

---

**[INFO]** 멀티플레이 게임 중 Back to Menu 시 세션 정리 검증

- 위치: `MultiplayerGame.tsx:44-47` (`handleBack`)
- 상세: `mp.disconnect()`는 클라이언트 WebSocket을 닫고 상태를 초기화하며, 서버의 `close` 핸들러가 세션에서 플레이어를 제거합니다. 기능적으로 정상이지만 게임 중 호스트가 Back to Menu를 누르면 서버에서 새 호스트 재지정 로직이 실행됩니다 — 이 동작이 사용자에게 명확하게 안내되지 않습니다.

---

### 요약

Turn 5(멀티플레이)와 Turn 6(메뉴 복귀) 요구사항의 핵심 기능은 전반적으로 구현되어 있습니다. 최대 5인 세션, 호스트/게스트 역할 구분, 좌/우 분할 UI, 라운드 종료 시 순위 표시, 멀티플레이에서 재시작 비활성화, 메뉴 복귀 버튼 모두 동작합니다. 그러나 **호스트 이탈 시 새 호스트의 게임 시작 불가** 문제는 실사용 시 게임 진행이 불가능해지는 기능적 결함으로, 가장 우선적으로 수정이 필요합니다. 추가로 서버 측 최소 인원 검증 누락, `calculateRankings` 배열 변경, 연결 유실 시나리오 처리 부재 등 엣지 케이스 미흡 사항이 존재합니다.

### 위험도

**MEDIUM**