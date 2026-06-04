# Agent Instructions

## 기본 원칙

- 이 저장소에서 worktree 작업의 일반적인 마무리 지시는 "배포해" 또는 "배포해줘"이다.
- 이 지시는 현재 요청과 관련된 변경만 검증하여 최신 `origin/main`에 직접 push하고 자동 배포를 트리거하라는 뜻이다. PR은 만들지 않는다.
- 배포는 한 번에 하나의 worktree에서만 진행한다.
- 각 작업은 가능한 한 작업 단위별 로컬 커밋으로 정리한다.
- 다른 worktree의 `main` 갱신은 현재 worktree의 HEAD와 파일에 자동 반영되지 않는다고 가정한다.
- unrelated changes는 커밋하거나 되돌리지 않는다.

## 작업 시작

1. 파일 수정 전에 `git status`, 현재 브랜치, HEAD를 확인하고 `git fetch origin main`을 실행한다.
2. 새 작업은 최신 `origin/main`을 기준으로 시작한다.
3. detached HEAD이면 작업 브랜치를 만든다. 기존 변경이나 고유 커밋이 있으면 먼저 브랜치 또는 임시 커밋으로 보존한 뒤 최신 `origin/main` 위에 재적용한다.
4. unrelated changes 때문에 안전한 최신화가 불가능하면 해당 변경을 건드리지 않고, 현재 요청 변경만 분리할 수 있을 때만 진행한다.

## 배포

1. 현재 브랜치, HEAD, 변경사항을 확인하고 현재 요청과 관련된 변경만 작업 단위 커밋으로 보존한다.
2. `git fetch origin main` 후 최신 `origin/main` 기준 임시 배포 브랜치에 현재 요청의 커밋만 cherry-pick 또는 rebase한다.
3. 충돌이 발생하면 자동 해결하거나 push하지 않는다. `ours`, `theirs`, 파일 전체 교체도 사용하지 않고 충돌 내용을 보고한다.
4. `git status`, `git log --oneline origin/main..HEAD`, `git diff origin/main...HEAD`로 실제 배포 범위를 확인한다. unrelated 변경, 예상하지 않은 삭제, 기존 기능 제거가 있으면 중단한다.
5. 최신 `origin/main` 위의 최종 상태에서 필요한 테스트와 빌드를 실행한다. 실패하면 push하지 않는다.
6. push 직전에 `git fetch origin main`을 다시 실행한다. 원격이 변경되었다면 최신 상태에 재적용하고 검토와 검증을 반복한다.
7. `git merge-base --is-ancestor origin/main HEAD`를 확인한 뒤 `git push origin HEAD:main`으로 fast-forward push한다. force push는 사용하지 않는다.
8. push 결과와 자동 배포 트리거 여부를 보고한다.

## 기타 명령

- "PR 올려줘": 변경사항을 검증해 작업 브랜치에 push하고 GitHub PR을 생성한다.
- "커밋만 해줘": 검증 후 로컬 커밋까지만 수행한다.
- "푸시만 해줘": 현재 브랜치를 원격에 push한다. detached HEAD이거나 대상이 불명확하면 먼저 로컬 브랜치로 보존하고 push 대상을 확인한다.
