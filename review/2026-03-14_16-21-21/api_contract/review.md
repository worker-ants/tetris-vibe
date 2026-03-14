## 발견사항

### API 계약 분석 대상
이 변경은 WebSocket 기반의 멀티플레이 실시간 통신 프로토콜을 새로 도입합니다. `lib/multiplayer/types.ts`의 `ClientMessage` / `ServerMessage` 타입이 API 계약의 핵심이며, `server.mjs`와 `useMultiplayer.ts`가 계약의 양 끝단입니다.

---

- **[CRITICAL]** 호스트 이탈 시 역할 전환 메시지 누락
  - 위치: `server.mjs:260-275`, `app/hooks/useMultiplayer.ts`, `app/components/MultiplayerGame.tsx`
  - 상세: 서버는 호스트가 연결을 끊으면 내부적으로 새 호스트를 지정하고 `player_left` (업데이트된 `players` 배열 포함)를 브로드캐스트합니다. 그러나 클라이언트의 "게임 시작" 버튼 노출 여부는 `config.role === "host"`(마운트 시 고정)에 의존하므로, 새 호스트가 된 게스트는 게임을 시작할 수 없습니다. 서버 내부 상태와 클라이언트 UI 권한이 영구적으로 불일치합니다.
  - 제안: `ServerMessage` 유니온에 `{ type: "host_transferred"; newHostId: string }` 메시지를 추가하고, 클라이언트에서 수신 시 호스트 권한을 동적으로 부여하는 상태를 관리하세요.

- **[WARNING]** 게임 중 플레이어 이탈 시 라운드 종료 불발
  - 위치: `server.mjs:82-96`, `server.mjs:255-279`
  - 상세: `checkRoundEnd`는 `state_update` 수신 시에만 호출됩니다. 플레이어가 게임 오버 상태 없이 연결을 끊으면 해당 플레이어의 상태가 세션에서 제거되지만 `checkRoundEnd`가 호출되지 않습니다. 남은 플레이어들이 모두 사망해도 이탈한 플레이어의 상태 업데이트가 없으면 라운드가 영구적으로 종료되지 않을 수 있습니다.
  - 제안: `ws.on("close")` 핸들러에서 플레이어 삭제 후 `checkRoundEnd(session)`를 호출하세요.

- **[WARNING]** 서버 측 입력 검증 미비
  - 위치: `server.mjs:120-155`
  - 상세: 클라이언트에서 `playerName`은 `maxLength={16}`으로 제한하지만, 서버는 길이 검증 없이 `msg.playerName || "Host"`를 그대로 사용합니다. WebSocket 메시지를 직접 전송하는 공격자가 임의 길이의 이름을 주입할 수 있습니다. 같은 이유로 `password` 필드도 검증이 없습니다.
  - 제안: 서버에서 `playerName` 필드에 대해 문자열 타입 및 최대 길이(예: 16자) 검증을 추가하세요.

- **[WARNING]** 재연결 메커니즘 부재
  - 위치: `lib/multiplayer/types.ts`, `app/hooks/useMultiplayer.ts`
  - 상세: 프로토콜에 재연결 메시지 타입이 없습니다. 네트워크 불안정으로 연결이 끊기면 기존 세션 복구가 불가능하고 `player_left`로 처리되어 새 플레이어로만 재진입 가능합니다.
  - 제안: `reconnect_session` 클라이언트 메시지와 `reconnect_result` 서버 메시지를 프로토콜에 추가하는 것을 고려하세요.

- **[INFO]** `player_joined` 메시지의 `player` 필드가 클라이언트에서 사용되지 않음
  - 위치: `lib/multiplayer/types.ts:44`, `app/hooks/useMultiplayer.ts:84`
  - 상세: `ServerMessage`의 `player_joined`는 `player: PlayerInfo`와 `players: PlayerInfo[]`를 모두 포함하지만, 클라이언트는 `msg.players`만 사용하고 `msg.player`는 무시합니다. 계약에 불필요한 필드가 존재합니다.
  - 제안: `player` 필드를 타입에서 제거하거나, 클라이언트에서 해당 필드를 실제로 활용하도록 수정하세요.

- **[INFO]** 패스워드 평문 전송
  - 위치: `app/components/ModeSelection.tsx:106`, `app/hooks/useMultiplayer.ts:139`
  - 상세: 게스트 접속 시 세션 비밀번호가 평문 WebSocket 메시지로 전송됩니다. `type="text"` 입력 필드를 사용하여 화면에도 노출됩니다.
  - 제안: 입력 필드를 `type="password"`로 변경하고, 프로덕션 환경에서는 WSS(TLS) 사용을 강제하세요.

---

## 요약

이번 변경은 새로운 WebSocket 기반 멀티플레이 API 계약을 도입합니다. `types.ts`의 타입 정의와 `server.mjs`, `useMultiplayer.ts` 간의 메시지 구조 정합성은 전반적으로 양호하며, `TetrisGame` 컴포넌트는 선택적 props 기본값을 통해 하위 호환성을 유지합니다. 그러나 호스트 이탈 시 역할 전환 알림 메시지 누락이 가장 심각한 계약 결함으로, 서버 내부 상태와 클라이언트 권한 모델이 불일치하게 됩니다. 또한 게임 중 플레이어 이탈 시 라운드 종료 로직의 누락과 서버 측 입력 검증 부재도 개선이 필요합니다.

## 위험도

**MEDIUM**