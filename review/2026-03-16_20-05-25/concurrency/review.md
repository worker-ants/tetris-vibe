## 동시성 코드 리뷰

### 발견사항

---

**[WARNING]** `checkRoundEnd`의 `singleSurvivor` 조건이 게임 중 플레이어 이탈 시 즉시 트리거됨
- 위치: `server.mjs` — `checkRoundEnd` 함수
- 상세: `session.players.delete()` 후 바로 `checkRoundEnd`를 호출하는데, `singleSurvivor = players.length === 1` 조건은 나머지 플레이어가 아직 살아있어도 라운드를 종료시킴. 플레이어가 연결 끊길 때 해당 플레이어의 점수가 rankings에서 제외되어 불완전한 순위 결과가 전송됨.
- 제안: 이탈한 플레이어도 최종 점수를 포함해 rankings를 계산하거나, `handleClose`에서 이탈 플레이어의 최종 상태를 먼저 기록 후 `checkRoundEnd` 호출.

---

**[WARNING]** 레이트 리미팅의 슬라이딩 윈도우 경계에서 버스트 허용
- 위치: `server.mjs` — `ws.on("message", ...)` 핸들러
- 상세: 현재 구현은 고정 윈도우 카운터(`msgWindowStart` 기반 리셋)를 사용. 윈도우 교체 직전에 30개, 교체 직후에 30개 = 짧은 기간 내 60개 메시지 처리 가능.
- 제안: 토큰 버킷 또는 진정한 슬라이딩 윈도우 알고리즘으로 교체. 단, 게임 트래픽(10fps)에서는 실질적 위험은 낮음.

---

**[WARNING]** `useMultiplayer`의 `isHost` 계산 시 stale `options` 직접 참조
- 위치: `app/hooks/useMultiplayer.ts` — `isHost` 파생 로직
- 상세: `const isHost = playerId ? players.some(...) : options.role === "host";` — `playerId`가 null인 초기 상태에서 `options.role`을 직접 참조(ref 아님). `options`가 렌더 간 변경되어도 이 값은 최신 `optionsRef.current`가 아닌 클로저 내 이전 `options`를 볼 수 있음.
- 제안: `optionsRef.current.role` 사용. 실제 `role`은 컴포넌트 생명주기 동안 변하지 않으므로 실질적 버그 위험은 낮음.

---

**[INFO]** `onStateChangeRef` 업데이트와 사용이 분리된 두 `useEffect` 패턴
- 위치: `app/components/TetrisGame.tsx` — state change 브로드캐스팅
- 상세: React에서 같은 렌더의 effects는 선언 순서대로 실행되므로, ref 업데이트 effect가 항상 상태 변경 effect보다 먼저 실행됨. 패턴 자체는 올바름. 다만 React Strict Mode(개발 환경)에서 effects가 두 번 실행될 때 콜백이 두 번 호출될 수 있음.
- 제안: 현재 구현 유지. Strict Mode 이슈가 문제라면 `useRef`를 활용한 실행 가드 추가 가능.

---

**[INFO]** `touchSession` 디바운스 10초 동안 idle 타이머가 연장되지 않음
- 위치: `server.mjs` — `touchSession` 함수
- 상세: `TOUCH_DEBOUNCE_MS = 10_000`, `SESSION_IDLE_TTL = 5 * 60_000`. 10fps로 state_update가 오는 경우 10초마다만 타이머가 갱신됨. 기능상 문제없음(5분 idle = 10초 debounce × 30회 이상 기회).
- 제안: 현재 구현 유지.

---

**[INFO]** `disconnect()` 호출 시 `wsRef.current = null` 중복 설정
- 위치: `app/hooks/useMultiplayer.ts` — `disconnect` callback
- 상세: `disconnect()`가 `wsRef.current = null`을 설정하고, `ws.onclose` 핸들러도 `wsRef.current = null`을 설정. 이중 설정이지만 JS 단일 스레드 환경에서 무해함.
- 제안: 현재 구현 유지.

---

### 요약

이 코드는 Node.js의 단일 스레드 이벤트 루프와 브라우저의 단일 스레드 JS 실행 모델을 올바르게 이해하고 활용하고 있습니다. 서버 측(`server.mjs`)에서 공유 상태(`sessions`, `sessionsByPassword` Map)에 대한 접근은 이벤트 루프의 run-to-completion 보장으로 안전하며, `gameStarted` 플래그를 idempotency guard로 사용하는 패턴도 적절합니다. 클라이언트 측에서는 `useRef`를 활용해 stale closure 문제를 방지하고, React의 `useReducer`로 상태 변이를 직렬화하는 구조가 견고합니다. 주요 위험은 게임 중 플레이어 이탈 시 불완전한 rankings 데이터와 레이트 리미터의 버스트 허용이며, 나머지는 설계 수준에서 수용 가능한 트레이드오프입니다.

### 위험도
**LOW**