## 의존성 코드 리뷰

### 발견사항

---

**[INFO] `ws` 패키지 분류 적절**
- 위치: `package.json` - dependencies
- 상세: `ws@^8.19.0`이 `dependencies`(런타임)에 추가된 것은 올바릅니다. `server.mjs`가 Node.js 런타임에서 직접 사용하므로 `devDependencies`가 아닌 `dependencies`에 위치해야 합니다.
- 제안: 현재 구조 유지

---

**[INFO] `@types/ws` 분류 적절**
- 위치: `package.json` - devDependencies
- 상세: TypeScript 타입 패키지는 `devDependencies`에 위치하는 것이 맞습니다. 런타임에는 필요 없습니다.
- 제안: 현재 구조 유지

---

**[WARNING] `ws` 버전 범위가 caret(`^`) 방식**
- 위치: `package.json:22` - `"ws": "^8.19.0"`
- 상세: `^8.19.0`은 `8.x.x` 범위의 업데이트를 허용합니다. lock 파일이 `8.19.0`으로 고정하고 있으나, `package-lock.json`을 무시하거나 `npm install --no-package-lock` 시 예상치 못한 버전이 설치될 수 있습니다. `ws` 라이브러리는 과거 DoS 취약점(CVE-2024-37890, `<8.17.1` 영향)이 있었으며 `8.19.0`은 패치되어 있습니다.
- 제안: 보안이 민감한 경우 정확한 버전(`"ws": "8.19.0"`)으로 고정 고려

---

**[WARNING] `useMultiplayer` 훅의 `connect` 콜백 의존성 불안정**
- 위치: `app/hooks/useMultiplayer.ts:138` - `connect` 콜백
- 상세: `connect`의 의존성 배열에 `options` 객체가 포함되어 있습니다. `options`는 `MultiplayerGame` 렌더링마다 새 객체 참조가 생성되어, `connect`도 매 렌더마다 재생성됩니다. 현재는 `useEffect(() => { mp.connect(); }, [])` 패턴으로 마운트 시에만 호출하므로 실제 버그가 발생하지 않지만, 잠재적으로 `handleBack`의 `mp.disconnect`를 통한 의존성 체인 불안정이 우려됩니다.
- 제안: `options`를 `useRef`로 감싸거나 개별 프로퍼티를 의존성 배열에 명시

```typescript
// 현재
}, [options, handleMessage]);

// 개선안
}, [options.role, options.playerName, options.endpoint, options.password, handleMessage]);
```

---

**[WARNING] 서버 세션 메모리 누수 가능성**
- 위치: `server.mjs:88-103` - `checkRoundEnd` 함수
- 상세: 라운드 종료(`round_end`) 후 `session.gameStarted = false`로 초기화되지만, `sessions` Map에서 세션이 제거되지 않습니다. 이후 모든 플레이어가 연결을 끊을 때에만 세션이 삭제됩니다. 라운드가 종료되었지만 플레이어들이 결과 화면에서 오랫동안 머물거나 연결이 비정상 종료된 경우 세션이 메모리에 잔류합니다.
- 제안: `round_end` 이후 일정 시간 타임아웃으로 세션 정리 로직 추가

---

**[INFO] `ws`의 선택적 peer 의존성 (`bufferutil`, `utf-8-validate`)**
- 위치: `package-lock.json` - ws 패키지 섹션
- 상세: `ws@8.19.0`은 `bufferutil`과 `utf-8-validate`를 선택적 peer 의존성으로 가집니다. 이 패키지들은 설치되지 않아도 동작하며(순수 JS fallback 사용), 현재 설치되어 있지 않습니다. 이는 정상적인 상태이나, 고성능이 필요하다면 추가 설치로 성능을 향상시킬 수 있습니다.
- 제안: 현재 유지 가능. 성능 최적화 시 `npm install bufferutil utf-8-validate` 고려

---

**[INFO] 내부 모듈 의존성 구조 적절**
- 위치: 전체 파일
- 상세: `lib/multiplayer/` → `lib/tetris/` 방향의 의존성은 단방향으로 순환 참조 없음. `app/components/` → `app/hooks/` → `lib/` 계층 구조도 올바름. `server.mjs`는 `lib/` 모듈을 직접 사용하지 않고 독립적으로 동작하여 분리가 잘 되어 있습니다.
- 제안: 현재 구조 유지

---

**[INFO] 클라이언트 번들에 `ws` 미포함**
- 위치: `server.mjs`, `app/hooks/useMultiplayer.ts`
- 상세: 클라이언트는 브라우저 내장 `WebSocket` API를 사용하고(`useMultiplayer.ts`), `ws` 패키지는 `server.mjs`(Node.js)에서만 사용됩니다. 따라서 클라이언트 번들 크기에 영향이 없습니다.
- 제안: 현재 구조 유지

---

### 요약

이번 변경에서 추가된 외부 의존성은 `ws@^8.19.0`과 `@types/ws@^8.18.1` 두 가지로, 멀티플레이어 WebSocket 서버 구현을 위한 적절한 선택입니다. `ws`는 MIT 라이선스로 호환성 문제가 없고, 8.19.0은 알려진 DoS 취약점이 패치된 버전이며, 클라이언트 번들에 포함되지 않아 크기 영향도 없습니다. 내부 의존성 구조도 계층적 단방향 참조를 유지하고 있습니다. 다만 `connect` 콜백의 `options` 객체 참조 불안정과 라운드 종료 후 세션 메모리 관리에 대한 경미한 개선 여지가 있으며, 버전 범위 고정 방식은 lock 파일로 보완되고 있으나 보안 민감도에 따라 exact 버전 고정을 검토할 수 있습니다.

### 위험도

**LOW**