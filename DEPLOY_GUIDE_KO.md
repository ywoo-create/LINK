# SoundAlert GitHub Pages 배포 가이드

## 목표

최종 사용자가 Python, Anaconda, Node.js를 설치하지 않고 아래 주소로 접속하도록 만드는 것입니다.

```text
https://내깃허브아이디.github.io/저장소이름/
```

개발자가 GitHub에 처음 올릴 때만 파일 업로드 작업이 필요합니다.

---

## 1. GitHub 계정 로그인

GitHub에 로그인합니다.

---

## 2. 새 Repository 만들기

GitHub 오른쪽 위 `+` → `New repository`를 누릅니다.

예시:

```text
Repository name: soundalert
```

권장 설정:

```text
Public
```

GitHub Free에서 Pages를 가장 간단하게 사용하려면 public repository가 편합니다.

`Create repository`를 누릅니다.

---

## 3. 프로젝트 파일 올리기

이 ZIP의 압축을 푼 뒤 **폴더 자체가 아니라 폴더 안의 파일 전체**를 repository에 올립니다.

Repository 첫 화면의:

```text
uploading an existing file
```

을 선택하거나:

```text
Add file → Upload files
```

를 사용합니다.

중요하게 아래 파일/폴더가 GitHub에 보여야 합니다.

```text
.github/
  workflows/
    deploy.yml
src/
scripts/
public/
package.json
vite.config.js
index.html
README.md
```

업로드 후:

```text
Commit changes
```

를 누릅니다.

---

## 4. GitHub Pages 켜기

Repository 상단:

```text
Settings
```

왼쪽 메뉴:

```text
Pages
```

`Build and deployment`에서:

```text
Source
→ GitHub Actions
```

를 선택합니다.

별도의 branch나 `/docs` 폴더를 선택하지 않습니다.

---

## 5. 자동 배포 확인

Repository 상단의:

```text
Actions
```

를 누릅니다.

아래와 비슷한 workflow가 실행됩니다.

```text
Deploy SoundAlert to GitHub Pages
```

내부 단계:

```text
Checkout repository
↓
Set up Node.js
↓
Install dependencies
↓
Download YAMNet TensorFlow.js model
↓
Build React/Vite site
↓
Upload Pages artifact
↓
Deploy to GitHub Pages
```

모두 초록색 체크가 되면 성공입니다.

---

## 6. 웹 주소 확인

다시:

```text
Settings → Pages
```

로 이동합니다.

배포가 성공하면 GitHub가 사이트 주소를 보여줍니다.

예:

```text
https://minsu123.github.io/soundalert/
```

이 링크를 대회 심사위원이나 사용자에게 공유하면 됩니다.

---

## 7. 사용자가 하는 것

사용자는 다음만 하면 됩니다.

```text
1. GitHub Pages 링크 접속
2. AI 모델 로딩 완료 확인
3. 실시간 소리 감지 시작
4. 마이크 권한 → 허용
5. 주변 소리 테스트
```

Python, Anaconda, VS Code, Node.js 설치가 필요 없습니다.

---

## 8. 왜 서버가 없어도 되는가?

원래 버전:

```text
브라우저
→ WebSocket
→ FastAPI
→ Python TensorFlow
→ YAMNet
→ 결과
```

GitHub Pages 버전:

```text
브라우저
→ Web Audio API
→ TensorFlow.js
→ YAMNet
→ 위험도 계산
→ 화면
```

YAMNet AI 자체가 웹브라우저 안에서 실행됩니다.

---

## 9. 첫 접속 때 모델 로딩이 있는 이유

YAMNet TensorFlow.js 모델 파일은 약 수십 MB 미만 규모의 모델 자산을 포함할 수 있습니다.

GitHub Actions가 배포할 때 YAMNet model 파일을 사이트에 같이 넣습니다.

사용자가 처음 접속하면 브라우저가 model 파일을 내려받은 뒤 메모리에 올립니다.

그 이후 브라우저 캐시가 적용되면 더 빨라질 수 있습니다.

---

## 10. GitHub에 코드를 수정한 뒤

`main` branch에 Commit/Push가 발생하면:

```text
.github/workflows/deploy.yml
```

이 자동으로 다시 실행됩니다.

따라서 수정 후 별도의 서버 재시작은 없습니다.

```text
코드 수정
→ GitHub main 반영
→ Actions build
→ Pages 자동 갱신
```

---

## 11. Actions에서 YAMNet 다운로드 실패할 때

Actions 로그의:

```text
Download YAMNet TensorFlow.js model
```

단계를 확인합니다.

모델 다운로드 주소는:

```text
scripts/download-yamnet.mjs
```

에 있습니다.

YAMNet 모델 호스팅 주소가 변경되는 경우 해당 상수를 수정해야 합니다.

---

## 12. 페이지가 하얗게 나올 때

먼저:

```text
Actions
```

에서 build가 성공했는지 확인합니다.

그 다음 브라우저에서:

```text
F12
→ Console
```

을 열어 오류를 확인합니다.

이 프로젝트의 Vite `base`는 `./`로 설정되어 있어서
repository 이름이 무엇이든 상대 경로로 asset을 불러오도록 구성되어 있습니다.

---

## 13. 마이크 버튼이 안 될 때

GitHub Pages 주소는 HTTPS이므로 정상적으로는 마이크 권한 요청이 가능합니다.

브라우저 주소창 왼쪽의 사이트 권한 메뉴에서:

```text
Microphone / 마이크
→ Allow / 허용
```

인지 확인합니다.

Chrome 또는 Edge 최신 버전 사용을 권장합니다.

---

## 14. 대회 시연 전 체크

- GitHub Pages 주소를 휴대폰에서도 열어보기
- Chrome/Edge에서 마이크 권한 확인
- Wi-Fi 환경에서 첫 모델 로딩 확인
- 자동차 경적 테스트 음원
- 사이렌 테스트 음원
- 아기 울음 테스트 음원
- 초인종 테스트 음원
- 일반 대화/음악에서 오탐 여부 확인
- 새로고침 후 다시 정상 작동하는지 확인

---

## 최종 구조

```text
GitHub repository
        ↓
GitHub Actions
        ↓
React build + YAMNet model 포함
        ↓
GitHub Pages HTTPS
        ↓
사용자 링크 접속
        ↓
마이크 권한
        ↓
브라우저 TensorFlow.js YAMNet
        ↓
실시간 소리 알림
```
