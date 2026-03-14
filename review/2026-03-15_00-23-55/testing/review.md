## 발견사항

### [CRITICAL] `isValidWsUrl` 함수에 대한 테스트 없음
- **위치**: `app/components/ModeSelection.tsx:14-20`
- **상세**: URL 검증 함수는 보안상 중요하지만 테스트가 전혀 없음. `http://`, `ftp://`, 빈 문자열, 공백, `ws://` 없이 IP만 입력하는 경우 등 다양한 엣지 케이스 미검증
- **제안**:
```typescript
// isValidWsUrl.test.ts
describe("isValidWsUrl", () => {
  it("accepts ws:// URLs", () => expect(isValidWsUrl("ws://192.168.0.1:3000/ws")).toBe(true));
  it("accepts wss:// URLs", () => expect(isValidWsUrl("wss://example.com/ws")).toBe(true));
  it("rejects http://", () => expect(isValidWsUrl("http://example.com")).toBe(false));
  it("rejects bare IP", () => expect(isValidWsUrl("192.168.0.1:3000")).toBe(false));
  it("rejects empty string", () => expect(isValidWsUrl("")).toBe(false));
});
```

---

### [CRITICAL] `checkRoundEnd` 순위 로직 중복, 서버 테스트 없음
- **위치**: `server.mjs:148-172`
- **상세**: `calculateRankings` (broadcast.ts)와 동일한 순위 계산 로직이 `server.mjs`에 복사됨. `broadcast.test.ts`에는 테스트가 있지만, 서버 측 동일 로직에는 테스트가 없어 둘 사이의 동작 불일치가 발생해도 감지 불가
- **제안**: 공통 유틸 함수로 추출 후 양측에서 임포트, 또는 서버용 단위 테스트 추가

---

### [WARNING] `calculateRankings` 문서-구현 불일치 (테스트가 이를 드러냄)
- **위치**: `lib/multiplayer/broadcast.ts:28`, `broadcast.test.ts:104-118`
- **상세**: 주석에는 "dense ranking"이라고 명시했으나 실제 구현은 standard competition ranking(1,2,2,4). 추가된 테스트 `handles tied scores with mixed ranks`에서 `rankings[3].rank`를 `4`로 기대하는데, dense ranking이라면 `3`이어야 함. **테스트가 의도(dense ranking)가 아닌 현재 구현(standard competition)을 검증함**
- **제안**: 주석을 "standard competition ranking"으로 수정하거나, 의도가 dense ranking이라면 `currentRank = index + 1` → `currentRank += 1`로 수정하고 테스트도 갱신

---

### [WARNING] `useMultiplayer.ts` 핵심 변경사항 무테스트
- **위치**: `app/hooks/useMultiplayer.ts`
- **상세**: 다음 변경사항들이 모두 테스트 없음:
  - `isHost` 상태 초기값 설정 및 `host_transferred` 수신 시 업데이트
  - 중복 연결 방지 가드 (`if (wsRef.current) return`)
  - JSON 파싱 실패 시 조기 반환
  - `msg.type` 문자열 검증
  - 증분 상태 병합 (`setOpponentStates` 함수형 업데이트)
- **제안**: vitest + `vi.fn()`으로 WebSocket 클래스를 모킹하는 환경 구성 후 단위 테스트 추가

---

### [WARNING] `sanitizeName` 함수 미테스트
- **위치**: `server.mjs:100-103`
- **상세**: 순수 함수로 테스트하기 매우 쉬움에도 테스트 없음. XSS 방어 목적으로 추가된 함수인데 검증 없이 신뢰
- **제안**:
```javascript
// sanitizeName.test.mjs
test("trims whitespace", () => expect(sanitizeName("  Alice  ", "Guest")).toBe("Alice"));
test("enforces MAX_NAME_LENGTH", () => expect(sanitizeName("A".repeat(20), "Guest")).toHaveLength(16));
test("uses fallback for empty", () => expect(sanitizeName("", "Guest")).toBe("Guest"));
test("uses fallback for non-string", () => expect(sanitizeName(null, "Guest")).toBe("Guest"));
```

---

### [WARNING] `toBroadcastState` paused 상태 테스트의 의미 부재
- **위치**: `lib/multiplayer/__tests__/broadcast.test.ts:46-52`
- **상세**: 추가된 `includes activePiece when paused` 테스트는 `isPaused`가 `activePiece` 포함 여부에 영향을 주지 않음을 검증하지만, `toBroadcastState` 구현에서 `isPaused`를 전혀 참조하지 않아 실제로는 자명한(tautological) 테스트. `isGameOver=false`이면 항상 activePiece가 포함됨
- **제안**: 테스트 의도를 명확히 하거나 제거

---

### [WARNING] `OpponentBoard` 캔버스 분리 useEffect 미테스트
- **위치**: `app/components/OpponentBoard.tsx:34-48`
- **상세**: 마운트 시 캔버스 크기 초기화와 상태 변경 시 드로우를 분리한 핵심 리팩토링이지만, `dprRef.current`가 드로우 시 사용되는지 검증하는 테스트 없음. DPR 변경 시나리오도 미검증
- **제안**: `@testing-library/react`와 canvas mock으로 초기화/드로우 분리 동작 검증

---

### [INFO] `broadcast.test.ts` 신규 테스트 품질 양호
- **위치**: `lib/multiplayer/__tests__/broadcast.test.ts`
- **상세**: `does not mutate input array`, `handles empty array`, `handles tied scores with mixed ranks`는 각각 명확한 의도를 가지며 독립적으로 실행 가능. `calculateRankings`의 핵심 보장사항(불변성, 빈 배열 처리)이 잘 커버됨

---

### [INFO] `TetrisGame.tsx` 브로드캐스트 가드 미테스트
- **위치**: `app/components/TetrisGame.tsx:47-51`
- **상세**: `state.isStarted`가 false일 때 `onStateChange`가 호출되지 않아야 하는 조건 미검증. 멀티플레이 초기 빈 상태 전송 방지가 목적인데, 컴포넌트 테스트에서 콜백 호출 여부를 확인해야 함

---

## 요약

전반적으로 이번 변경에서 `broadcast.ts`의 `calculateRankings`는 테스트가 잘 추가되었으나, 그 외 핵심 변경사항들(`isValidWsUrl`, `sanitizeName`, `useMultiplayer` 훅의 WebSocket 상태 관리, `checkRoundEnd` 서버 로직)은 테스트가 전무하다. 특히 `calculateRankings`의 "dense ranking" 주석과 실제 구현(standard competition ranking, 1-2-2-4) 사이의 불일치를 테스트가 정확히 드러내고 있어 **테스트가 버그를 발견하는 제 역할을 한 사례**이지만, 이것이 의도적인 것인지 명세 오류인지 확인이 필요하다. `server.mjs`에 추가된 `sanitizeName`, `deleteSession`, `touchSession` 같은 순수 함수들은 테스트 작성이 용이함에도 테스트가 없어 회귀 위험이 남아 있다.

## 위험도

**MEDIUM**