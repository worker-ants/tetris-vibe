# 테트리스 바이브 코딩
`claude-code`의 스킬을 테스트하기 위한 플레이그라운드

## AI 활용 없이 작업된 부분
- next.js 초기화
- CLAUDE.md 작성

## 주요 경로
```text
├── .claude             claude-code 프로젝트 설정
├── prompts             바이브 코딩에 사용된 프롬프트
└── review              AI Agent`s가 작성한 코드 리뷰 및 처리 결과
    ├── **/review.md    전문가 에이전트의 코드 리뷰
    ├── SUMMARY.md      모든 전문가들의 리뷰 결과 정리
    └── refinement.md   코드 리뷰 처리 결과
```

## 참고사항
```text
`code-review-agents` plugin은 `PostToolUse`으로도 설정이 가능하지만,
1 turn마다의 리뷰보다 커밋, 수동 트리거 기반의 작업 범위별 리뷰가 토큰 효율 및 리뷰 결과에서 더 나은 모습을 보임
```
