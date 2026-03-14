# 테트리스 바이브 코딩
`claude-code`의 스킬을 테스트하기 위한 플레이그라운드

## AI 활용 없이 작업된 부분
- next.js 초기화
- CLAUDE.md 작성

## 실행 방법

### 싱글플레이 전용
```bash
npm run dev:solo   # 개발 모드
npm run start:solo # 프로덕션 모드
```

### 멀티플레이 (WebSocket 서버 포함)
```bash
npm run dev        # 개발 모드 (LAN 멀티플레이 포함)
npm run start      # 프로덕션 모드
```

### 환경 변수
- `PORT`: 서버 포트 (기본값: 3000)

### 멀티플레이 접속 흐름
1. **호스트**: `Multiplayer - Host`를 선택하고 세션을 생성합니다
2. 호스트 화면에 표시된 **Endpoint**와 **Password**를 게스트에게 공유합니다
3. **게스트**: `Multiplayer - Guest`를 선택하고 Endpoint/Password를 입력하여 접속합니다
4. 호스트가 `Start Game` 버튼을 눌러 게임을 시작합니다

> **참고**: 멀티플레이는 같은 LAN 환경에서 동작합니다. 방화벽 설정에 따라 PORT 개방이 필요할 수 있습니다.

## 주요 경로
```text
├── .claude             claude-code 프로젝트 설정
├── prompts             바이브 코딩에 사용된 프롬프트
├── server.mjs          WebSocket 멀티플레이 서버
└── review              AI Agent's가 작성한 코드 리뷰 및 처리 결과
    ├── **/review.md    전문가 에이전트의 코드 리뷰
    ├── SUMMARY.md      모든 전문가들의 리뷰 결과 정리
    └── refinement.md   코드 리뷰 처리 결과
```

## 참고사항
```text
`code-review-agents` plugin은 `PostToolUse`으로도 설정이 가능하지만,
1 turn마다의 리뷰보다 커밋, 수동 트리거 기반의 작업 범위별 리뷰가 토큰 효율 및 리뷰 결과에서 더 나은 모습을 보임
```
