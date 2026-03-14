## 부작용 코드 리뷰 결과

---

### 발견사항

---

**[WARNING] 호스트 이탈 시 이중 broadcastAll로 중복 플레이어 목록 전송**
- 위치: `server.mjs` — `ws.on("close")` 핸들러
- 상세: 호스트 이탈 시 `host_transferred` → `player_left` 두 번의 `broadcastAll`이 연속 발생하며, 둘 다 동일한 `players` 목록을 포함합니다. 클라이언트에서 `players` 상태가 동일한 값으로 두 번 갱신됩니다. 불필요한 리렌더링이 발생하지만 기능상 오류는 아닙니다.
- 제안: `player_left` 메시지에서 `players` 필드를 제거하거나, `host_transferred` 메시지에 충분한 정보를 포함하여 `player_left` 의 플레이어 목록 갱신을 생략하도록 통합.

---

**[WARNING] `touchSession` 5분 idle 만료가 일시정지 상태의 활성 세션을 종료할 수 있음**
- 위치: `server.mjs` — `touchSession()` / `SESSION_IDLE_TTL = 5 * 60_000`
- 상세: `touchSession`은 `state_update` 수신 시에만 호출됩니다. 모든 플레이어가 게임을 일시정지(`TOGGLE_PAUSE`)한 경우 `state_update`가 전송되지 않으므로, 5분 후 세션이 강제 종료됩니다. 커넥션이 `ws.close(1000, "Session expired")`로 끊기면 클라이언트에는 오류 메시지 없이 연결 해제 처리됩니다.
- 제안: `TOGGLE_PAUSE` 이벤트 자체를 별도 클라이언트 메시지로 서버에 전달하여 `touchSession`을 호출하거나, TTL을 게임 중에는 비활성화.

---

**[WARNING] `opponentStates` 증분 병합 후 미수신 플레이어 상태 잔류**
- 위치: `app/hooks/useMultiplayer.ts` — `state_broadcast` 핸들러
- 상세: 기존 코드는 `setOpponentStates(others)`로 전체 교체하여 현재 연결된 플레이어만 남겼습니다. 변경 후 `{ ...prev, [id]: state }` 방식의 증분 병합을 사용하므로, 서버가 `player_left`를 보내지 않고 플레이어가 비정상 종료하는 경우 해당 플레이어의 마지막 상태가 `opponentStates`에 계속 남습니다. `player_left` 핸들러에서 정리하지만, 해당 메시지가 유실되면 UI에 고스트 상대방 보드가 표시됩니다.
- 제안: `round_end` 또는 `game_started` 수신 시 `opponentStates`를 초기화하는 방어 코드 추가.

---

**[WARNING] `OpponentBoard` — `dprRef` 기본값 1로 초기화되어 DPR 변경 시 비적용**
- 위치: `app/components/OpponentBoard.tsx` — `dprRef = useRef(1)` + 마운트 전용 `useEffect`
- 상세: 마운트 시 `window.devicePixelRatio`를 `dprRef.current`에 저장하며, 이후 `state` 변경 시 드로우 이펙트에서 이 값을 사용합니다. 창을 다른 DPI 모니터로 이동하는 경우(`devicePixelRatio` 변경), 캔버스 크기와 드로우 변환이 일치하지 않아 흐린 렌더링이 발생합니다. 기존 코드에서도 동일한 문제가 있었지만, useEffect를 분리하면서 더 명시적인 설계 결정이 됩니다.
- 제안: `window.matchMedia('(resolution: ...)').addEventListener` 또는 `ResizeObserver`로 DPR 변경 감지 시 캔버스 재초기화 트리거.

---

**[INFO] `ModeSelection` — 엔드포인트 유효성 검사 강화로 UX 동작 변경**
- 위치: `app/components/ModeSelection.tsx` — `isValidWsUrl()` 도입
- 상세: 기존에는 `!endpoint.trim()`이 falsy면 Join 버튼이 비활성화되었지만, 이제 `ws://` 또는 `wss://` 형식의 완전한 URL이 아니면 비활성화됩니다. 타이핑 중 중간 상태(`ws://192`)에서도 버튼이 비활성화되어 사용자가 혼란을 느낄 수 있습니다. 의도된 보안 개선이나, 실시간 URL 입력 피드백(오류 메시지)이 없어 사용자 경험이 저하될 수 있습니다.
- 제안: 버튼 비활성화 외에 입력 필드 아래 "유효한 WebSocket URL을 입력하세요 (ws:// 또는 wss://)" 안내 문구 추가.

---

**[INFO] `MultiplayerGame` — `config.role` 대신 `mp.isHost` 사용으로 동적 역할 의존**
- 위치: `app/components/MultiplayerGame.tsx` — `mp.sessionInfo && mp.isHost`, `mp.isHost && mp.isConnected`
- 상세: 기존 `config.role === "host"` 비교는 props에서 정적으로 결정되었습니다. 이제 `mp.isHost` 상태에 의존하므로 호스트 이전(host transfer) 시 UI가 동적으로 업데이트됩니다. 이는 의도된 기능 개선이지만, `isHost` 초기화가 `options.role === "host"`로 되어 있어, 컴포넌트 마운트 직후 서버 응답 전까지는 `role`과 `isHost`가 일치합니다. 문제없습니다.

---

**[INFO] `calculateRankings` 동점 순위 로직 변경 — dense ranking 적용**
- 위치: `lib/multiplayer/broadcast.ts`, `server.mjs` — `checkRoundEnd()`
- 상세: 기존 `index + 1` 방식에서 동점자에게 동일 순위를 부여하는 dense ranking으로 변경됩니다. `RoundResult` 컴포넌트가 `rank`를 기반으로 렌더링할 경우, 동점 시 두 항목의 `rank`가 같아집니다. 현재 `RoundResult` 구현이 이를 올바르게 처리하는지 확인이 필요합니다.

---

### 요약

이번 변경에서 발견된 부작용은 대부분 **의도된 기능 개선**의 부산물이며 치명적 문제는 없습니다. 핵심 위험 요소는 세 가지입니다: (1) 일시정지 상태에서 `touchSession`이 호출되지 않아 5분 idle 만료로 활성 세션이 강제 종료될 수 있고, (2) 증분 병합 방식의 `opponentStates`가 비정상 종료 플레이어의 상태를 잔류시킬 수 있으며, (3) `OpponentBoard`의 DPR 변경 미대응은 멀티모니터 환경에서 렌더링 품질 저하를 유발합니다. `server.mjs`의 호스트 이탈 시 이중 broadcast는 기능상 무해하지만 불필요한 네트워크 트래픽과 클라이언트 리렌더를 유발합니다.

### 위험도

**LOW**