## 성능 코드 리뷰

### 발견사항

---

**[WARNING] GameBoard: 매 프레임마다 Canvas 크기 재설정**
- 위치: `GameBoard.tsx:27-31`
- 상세: `useEffect`가 `gameState` 전체를 의존성으로 가지므로, 매 틱(게임 상태 변경)마다 `canvas.width/height` 설정이 실행됩니다. Canvas 크기를 변경하면 컨텍스트가 초기화되며 불필요한 레이아웃 재계산이 발생합니다.
- 제안: Canvas 크기/DPR 초기화는 별도 `useEffect([], [])`로 분리하고, 드로잉 로직만 `useEffect([gameState])`에 남기세요. `OpponentBoard.tsx`는 이미 이 패턴을 올바르게 구현하고 있습니다.

---

**[WARNING] GameBoard: 매 틱마다 그리드 선 전체 재렌더링**
- 위치: `GameBoard.tsx:37-50`
- 상세: 그리드 선은 정적 요소임에도 매 게임 틱마다 `VISIBLE_ROWS + BOARD_COLS + 2`개의 path 연산을 반복 실행합니다. Tetris는 최소 50ms(레벨 최대속도)마다 상태가 변경되므로 초당 최대 20회 발생합니다.
- 제안: 그리드를 별도 offscreen canvas에 한 번 렌더링한 뒤 `drawImage()`로 복사하거나, `OpponentBoard.tsx`처럼 `ctx.beginPath()`로 단일 패스에 묶으세요(이미 부분 구현됨).

---

**[WARNING] TetrisGame: 매 상태 변경마다 `onStateChangeRef` 업데이트 useEffect**
- 위치: `TetrisGame.tsx:40-42`
- 상세: `useEffect(() => { onStateChangeRef.current = onStateChange; })` — 의존성 배열이 없어 매 렌더마다 실행됩니다. 게임 틱마다 렌더가 발생하므로, 이 effect는 초당 수십 번 불필요하게 호출됩니다.
- 제안: `useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);`로 변경하거나, effect 없이 렌더 중 직접 `onStateChangeRef.current = onStateChange` 할당(ref 업데이트는 렌더 중 안전)하세요.

---

**[INFO] board.ts: placePiece에서 전체 보드 깊은 복사**
- 위치: `board.ts:16`
- 상세: `board.map(row => row.map(cell => ({ ...cell })))` — 22×10 = 220개 객체를 매 조각 고정(lock)마다 생성합니다. 조각 고정은 상대적으로 드물어 크리티컬하지 않으나, Cell을 `{ filled, color }` 객체 대신 단일 문자열(색상, `""` = 빈칸)로 표현하면 GC 압력을 줄일 수 있습니다.
- 제안: `BroadcastState`의 `(string | null)[][]` 패턴을 내부 Board 타입에도 적용하면 복사 비용과 메모리를 절감할 수 있습니다.

---

**[INFO] useMultiplayer: isHost 계산이 매 렌더마다 재실행**
- 위치: `useMultiplayer.ts:~180`
- 상세: `const isHost = playerId ? players.some(...) : options.role === "host"` — `players` 배열이 크지 않아 실제 비용은 낮지만, `useMemo`로 메모이제이션하면 명시적으로 의존성을 선언할 수 있습니다.
- 제안: 선택적 개선이며 현재 MAX_PLAYERS=5 환경에서 실질적 영향은 없습니다.

---

**[INFO] server.mjs: `broadcastAll`에서 매번 JSON.stringify 호출**
- 위치: `server.mjs: broadcastAll, broadcast`
- 상세: 이미 함수 내부에서 `JSON.stringify(message)`를 한 번 호출 후 모든 클라이언트에 동일한 문자열을 전송하는 올바른 패턴을 사용하고 있습니다. `send()` 헬퍼와 이중 stringify가 발생하지 않도록 확인 — `handleCreateSession` 등에서 `send(ws, {...})`를 사용하는 단건 전송은 문제없습니다.

---

**[INFO] ModeSelection: 렌더 중 `isValidWsUrl` 중복 호출**
- 위치: `ModeSelection.tsx:~95, ~108`
- 상세: `endpoint.trim()` 후 `isValidWsUrl`이 렌더마다 2회 호출됩니다(인라인 검증용 + 버튼 disabled 조건). `URL` 파싱 비용은 경미하지만 `useMemo`나 단일 변수로 통합할 수 있습니다.
- 제안: `const isEndpointValid = useMemo(() => isValidWsUrl(endpoint.trim()), [endpoint])` 로 통합하세요.

---

### 요약

전반적으로 성능 설계는 양호합니다. WebSocket 상태 전송 10fps 스로틀, 단일 패스 그리드 렌더링(OpponentBoard), 비밀번호-세션 O(1) 역방향 맵, 세션 idle 타이머 디바운스 등 핵심 최적화가 이미 적용되어 있습니다. 가장 주목할 이슈는 `GameBoard.tsx`에서 매 게임 틱마다 Canvas 크기를 재설정하고 그리드를 전부 다시 그리는 패턴으로, `OpponentBoard.tsx`가 이미 올바른 해결책(크기 초기화와 드로잉 분리)을 보여주고 있어 동일 패턴을 `GameBoard`와 `NextPiece`에도 적용하면 됩니다.

### 위험도

**LOW**