## 발견사항

### [WARNING] MultiplayerGame.tsx — 의도치 않은 들여쓰기 불일치
- **위치**: `app/components/MultiplayerGame.tsx`, `{mp.sessionInfo && mp.isHost && (` 블록
- **상세**: `config.role === "host"` → `mp.isHost` 변경은 올바르나, 해당 블록에 16칸 들여쓰기(4레벨)가 적용됨. 주변 코드는 8칸 기준이므로 불일치.
  ```tsx
  //  현재 (잘못됨)
                  {mp.sessionInfo && mp.isHost && (
                    <div className="bg-gray-700 rounded p-4 mb-4">
  //  기대값
          {mp.sessionInfo && mp.isHost && (
            <div className="bg-gray-700 rounded p-4 mb-4">
  ```
- **제안**: 들여쓰기를 주변 코드와 통일

---

### [INFO] server.mjs — `getLocalIP()` 연결마다 재호출
- **위치**: `wss.on("connection", ...)` 내부 `allowedOrigins` 배열 생성부
- **상세**: OS 네트워크 인터페이스 열거가 WebSocket 연결마다 발생. 보안 요구사항 구현은 refinement.md 범위 내이나, 결과값은 런타임 중 변경되지 않으므로 불필요한 반복 호출.
- **제안**: `getLocalIP()` 호출을 `app.prepare().then(...)` 진입 시점에 1회만 수행하고 캐시

---

### [INFO] dense ranking 로직 중복
- **위치**: `lib/multiplayer/broadcast.ts::calculateRankings` / `server.mjs::checkRoundEnd`
- **상세**: 동점 처리 로직이 두 곳에 분리 구현됨. refinement.md에 `server.mjs checkRoundEnd에도 동일 로직 적용`으로 명시되어 있으므로 의도된 결정이나, 향후 로직 변경 시 두 곳을 동시에 수정해야 함.
- **제안**: 미반영 과제 항목에 "서버 레이어 분리 시 `calculateRankings` 재사용 검토" 추가

---

## 요약

변경 사항 전체는 `refinement.md`에 명시된 항목들과 정확히 대응한다. 보안(CSWSH 방어, 메시지 검증, 비밀번호 강화), 기능 버그(호스트 이탈, 라운드 종료), 성능(캔버스 분리, 격자 배치, 증분 상태 병합), 유지보수성(매직 넘버, 상수 추출, JSX 주석 형식) 모두 계획된 범위 내 변경이다. 단, `MultiplayerGame.tsx`에서 기능 변경 과정에 부수적으로 들여쓰기 불일치가 발생하였으며, 이는 의도된 변경이 아닌 편집 실수로 판단된다.

## 위험도

**LOW**