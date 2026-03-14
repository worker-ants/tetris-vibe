## 요구사항 리뷰

### 발견사항

---

**[WARNING]** 플레이어 1명만 남은 상태에서 라운드 미종료
- 위치: `server.mjs` `checkRoundEnd()` + `ws.on("close")` 핸들러
- 상세: 게임 중 플레이어가 연결을 끊으면 해당 플레이어는 삭제 후 `checkRoundEnd` 호출. 그러나 남은 플레이어가 아직 `isGameOver: true`를 전송하지 않았다면 라운드가 종료되지 않음. 즉, 플레이어 2명 중 1명이 이탈하면 남은 1명이 직접 죽어야만 라운드가 끝나는 구조임
- 제안: 플레이어 이탈 후 살아있는 플레이어가 1명 이하일 경우 라운드를 즉시 종료 처리

```js
// ws.on("close") 내부
session.players.delete(playerId);
// 추가: 살아있는(gameStarted 중) 플레이어가 1명 이하면 강제 종료
if (session.gameStarted) {
  const alive = Array.from(session.players.values()).filter(
    p => !p.state?.isGameOver
  );
  if (alive.length <= 1) { /* 강제 round_end */ }
}
checkRoundEnd(session);
```

---

**[WARNING]** URL 유효성 실패 시 사용자 피드백 없음
- 위치: `ModeSelection.tsx` Guest 입력 폼 (Endpoint 필드)
- 상세: `isValidWsUrl()` 검증 실패 시 "Join Session" 버튼이 비활성화되지만 왜 비활성화됐는지 사용자에게 알려주지 않음. `http://` URL 입력 시 아무 반응 없이 버튼만 회색이 됨
- 제안: Endpoint 입력 필드 아래에 인라인 에러 메시지 표시 (`ws:// 또는 wss://로 시작해야 합니다`)

---

**[WARNING]** Origin 없는 비브라우저 클라이언트 접속 허용
- 위치: `server.mjs:202` - `wss.on("connection")` Origin 검증 로직
- 상세: `if (origin && !allowedOrigins.includes(origin))` — origin 헤더가 없으면(비브라우저 WS 클라이언트, `wscat`, 자동화 스크립트 등) 검증을 완전히 건너뜀. CSWSH 방어 목적이라면 origin 부재도 차단해야 일관성 있음
- 제안: LAN 환경 특성상 허용 가능하다면 현 상태 유지. 엄격히 제한하려면 `if (!origin || !allowedOrigins.includes(origin))` 로 변경

---

**[WARNING]** `sendState`가 playing 페이즈 외에서도 호출 가능
- 위치: `useMultiplayer.ts` `sendState` 콜백 + `TetrisGame.tsx` `state.isStarted` 조건
- 상세: `TetrisGame.tsx`에서 `state.isStarted` 조건으로 브로드캐스트를 막지만, `sendState` 자체는 페이즈 제한이 없어 이론적으로 lobby/result 페이즈에서도 호출 가능. 현재는 `autoStart + isStarted` 조건 덕분에 안전하나 다른 경로에서 `sendState`를 직접 호출할 경우 불필요한 서버 트래픽 발생
- 제안: `sendState` 내부에서 `phase === "playing"` 가드 추가

---

**[INFO]** Dense ranking이 competition ranking(1,2,2,4) 방식 적용
- 위치: `broadcast.ts` `calculateRankings()` + `server.mjs` `checkRoundEnd()`
- 상세: 동점 시 다음 순위는 건너뜀(1,2,2,4). 이는 테스트(`handles tied scores with mixed ranks`)로 의도가 명시되어 있음. 기존 코드(1,2,2,3 = dense ranking 아님)에서 변경된 것으로, 양측(클라이언트/서버)에 동일 로직이 적용되어 일관성 있음
- 제안: 해당 없음 (의도된 동작, 테스트로 검증됨)

---

**[INFO]** `OpponentBoard.tsx` DPR 변경 감지 미지원
- 위치: `OpponentBoard.tsx` 마운트 useEffect
- 상세: `dprRef.current`는 마운트 시 1회만 읽음. 사용자가 창을 다른 DPI 모니터로 이동하면 캔버스가 흐릿하게 렌더링될 수 있음. LAN 멀티플레이 테트리스 특성상 실용적 영향은 미미
- 제안: 현재 구현으로 충분. 향후 필요시 `window` resize/matchMedia 이벤트로 DPR 변경 감지 추가 가능

---

### 요약

이번 변경사항은 코드 리뷰에서 제기된 보안·기능·성능·유지보수성 이슈를 전반적으로 충실히 반영하였으며, 특히 WebSocket 보안(Origin 검증, 메시지 크기 제한, JSON 파싱 방어), 기능 버그(호스트 전환, 최소 인원 검증, 게임 중 이탈 후 라운드 종료), 성능 최적화(증분 상태 브로드캐스트, 캔버스 분리, 격자 배치 드로우), 아키텍처 개선(stale closure 방지, 중복 연결 방지, 세션 정리)이 모두 구현되어 있다. 다만 플레이어 1명이 게임 중 이탈했을 때 라운드가 자동 종료되지 않는 케이스가 미반영 상태이며, Guest URL 입력 오류에 대한 사용자 피드백이 없는 점은 UX 측면에서 보완이 필요하다.

### 위험도

**LOW** — 핵심 기능은 정상 동작하며, 식별된 이슈는 엣지 케이스(플레이어 이탈 중 라운드 처리) 및 UX 개선 사항 수준