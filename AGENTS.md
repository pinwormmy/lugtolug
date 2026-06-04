# Agent Instructions

- 이 저장소에서 worktree 작업의 일반적인 마무리 지시는 "배포해" 또는 "배포해줘"이다.
- "배포해" 또는 "배포해줘"는 현재 요청과 관련된 변경사항만 검증한 뒤 최신 `origin/main` 위에 재적용하고, `main`에 직접 push해서 자동 배포를 트리거하라는 뜻이다.
- 이 저장소는 `main` push 시 자동 배포되므로, 배포 지시를 받으면 PR을 만들지 않는다.
- 각 worktree의 작업은 가능한 한 작업 단위별 로컬 커밋으로 정리한다.
- Git worktree는 다른 worktree에서 `main`이 갱신되어도 현재 worktree의 HEAD와 작업 파일이 자동 갱신되지 않는다고 가정한다.
- 배포는 한 번에 하나의 worktree에서만 진행한다.
- detached HEAD 상태 자체는 오류가 아니지만, 해당 상태에서 만든 커밋은 브랜치로 보존하지 않으면 유실될 수 있다고 가정한다.

- 작업 시작 절차:
  1. 파일을 수정하기 전에 `git status`, 현재 브랜치, 현재 HEAD를 확인한다.
  2. `git fetch origin main`으로 최신 `origin/main`을 확인한다.
  3. 현재 HEAD가 detached 상태이면 파일을 수정하기 전에 작업 브랜치를 만든다.
     - 현재 요청의 변경사항이나 고유 커밋이 없다면 최신 `origin/main`을 기준으로 작업 브랜치를 만든다.
     - 변경사항이나 고유 커밋이 있다면 먼저 임시 브랜치 또는 커밋으로 보존하고, 최신 `origin/main` 위에 재적용한다.
  4. 현재 요청의 변경사항이 아직 없다면 최신 `origin/main`을 기준으로 작업 브랜치를 만들거나 현재 작업 브랜치를 최신 `origin/main`으로 갱신한 뒤 작업한다.
  5. 현재 요청의 변경사항이 이미 있다면 먼저 브랜치 또는 임시 커밋으로 보존한다. 오래된 HEAD 위에서 작업을 계속하지 말고 최신 `origin/main` 위에 재적용한 뒤 계속한다.
  6. unrelated changes가 있어 최신화가 안전하지 않으면 해당 변경을 건드리지 않고, 현재 요청 변경만 분리할 수 있을 때만 진행한다.

- 배포 지시 실행 순서:
  1. 현재 브랜치, HEAD, 변경사항, 현재 요청과 관련된 커밋 범위를 확인한다.
     - 배포 대상은 현재 worktree 전체나 현재 브랜치 전체가 아니라 현재 요청과 관련된 변경 및 커밋으로 제한한다.
     - 현재 요청과 관련된 변경이나 커밋이 없다면 unrelated 변경을 대신 배포하지 않고 보고 후 중단한다.
  2. 현재 HEAD가 detached 상태이면 현재 커밋과 변경사항을 임시 배포 브랜치로 보존한다.
  3. 현재 요청과 관련된 변경사항만 stage하고 작업 단위 커밋으로 보존한다.
  4. `git fetch origin main`으로 최신 원격 상태를 다시 확인한다.
  5. 최신 `origin/main`을 기준으로 임시 배포 브랜치를 만들고, 현재 요청과 관련된 커밋만 cherry-pick 또는 rebase로 재적용한다.
     - 기존 작업 브랜치 전체를 병합하거나 오래된 파일 스냅샷을 그대로 덮어쓰지 않는다.
     - 커밋되지 않은 변경은 임시 커밋으로 보존한 뒤 재적용한다.
  6. 재적용 중 충돌이 하나라도 발생하면 자동으로 해결하거나 push하지 않는다.
     - 특히 `ours`, `theirs`, 파일 전체 교체 방식으로 해결하지 않는다.
     - 충돌 파일, 충돌 원인, 최신 `origin/main`에서 보존해야 할 변경을 보고하고 배포를 중단한다.
  7. 재적용 후 최신 `origin/main` 대비 실제 배포 범위를 확인한다.
     - `git status`
     - `git log --oneline origin/main..HEAD`
     - `git diff --stat origin/main...HEAD`
     - `git diff --name-status origin/main...HEAD`
     - `git diff origin/main...HEAD`
  8. diff에 현재 요청과 관계없는 파일 변경, 예상하지 않은 삭제, 이전 `origin/main` 기능의 제거가 있으면 자동 push하지 않는다.
  9. 원본 작업 커밋과 재적용된 배포 커밋의 패치가 달라졌다면 `git range-diff` 등으로 차이를 확인한다. 설명할 수 없는 차이가 있으면 자동 push하지 않는다.
  10. 최신 `origin/main` 위에 재적용된 최종 상태에서 테스트와 빌드 검증을 실행한다.
  11. 테스트나 빌드 검증이 통과한 뒤, push 직전에 `git fetch origin main`을 다시 실행한다.
  12. `origin/main`이 검증 이후 변경되었다면 최신 상태에 다시 재적용하고 diff 검토와 검증을 반복한다.
  13. `git merge-base --is-ancestor origin/main HEAD`로 최신 `origin/main`이 배포 HEAD의 조상인지 확인한다.
  14. 검증된 배포 HEAD를 `git push origin HEAD:main`으로 push한다. 이 push는 최신 `origin/main`에서 이어진 fast-forward여야 하며 force push는 사용하지 않는다.
  15. push 결과와 배포 트리거 여부를 보고한다.

- 테스트나 빌드 검증이 실패하면 push하지 말고 실패 내용을 보고한다.
- unrelated changes는 커밋하거나 되돌리지 않는다.
- PR은 사용자가 명시적으로 요청한 경우에만 생성한다.
- "PR 올려줘"는 현재 worktree 변경사항을 검증 후 브랜치에 push하고 GitHub PR을 생성하라는 뜻이다.
- "커밋만 해줘"는 검증 후 로컬 커밋까지만 수행하라는 뜻이다.
- "푸시만 해줘"는 현재 브랜치를 원격에 push하라는 뜻이다.
  - detached HEAD 상태이거나 원격 push 대상이 명확하지 않으면 임의의 원격 브랜치로 push하지 않고, 현재 커밋을 로컬 브랜치로 보존한 뒤 대상 확인을 요청한다.
