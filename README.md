# SoundAlert — GitHub Pages / TensorFlow.js 버전

청각장애인을 위한 실시간 생활 소리 알림 시스템입니다.

이 버전은 **Python, Anaconda, FastAPI 서버가 필요 없습니다.**
YAMNet을 TensorFlow.js 형식으로 브라우저 안에서 직접 실행합니다.

## 사용자 입장에서

배포 후 사용자는 아래와 같은 GitHub Pages 주소만 열면 됩니다.

```text
https://GITHUB_ID.github.io/REPOSITORY_NAME/
```

사용자는 별도 프로그램을 설치하지 않습니다.

1. 링크 접속
2. YAMNet 모델 로딩
3. "실시간 소리 감지 시작" 클릭
4. 브라우저의 마이크 권한 허용
5. 실시간 결과 확인

## 구조

```text
마이크
  ↓
getUserMedia / Web Audio API
  ↓
브라우저 오디오 버퍼
  ↓
16 kHz mono 변환
  ↓
TensorFlow.js YAMNet
  ↓
대상 소리 score 후처리
  ↓
위험도 계산
  ↓
추천 행동
  ↓
React UI
```

## 정확도 안정화 코드

- 2초 분석 window
- 1초 단위 sliding
- YAMNet frame mean + max + presence 결합
- 최근 3개 결과 temporal smoothing
- 서비스 대상 클래스만 최종 후보로 사용
- 상황별 confidence threshold
- 동일 situation의 유사 label 중복 제거
- 무음 / 저레벨 구간 제거
- DC offset 제거 및 16 kHz 변환
- 반복 감지 persistence 보정

## GitHub Pages 배포

자세한 설명은 `DEPLOY_GUIDE_KO.md`를 읽으세요.

핵심 단계:

1. GitHub에 새 public repository 생성
2. 이 폴더의 모든 파일 업로드
3. Settings → Pages
4. Source → GitHub Actions
5. Actions 탭에서 배포 완료 확인
6. `https://아이디.github.io/저장소명/` 접속

`.github/workflows/deploy.yml`이 자동으로:

- Node.js 설치
- npm package 설치
- Google의 YAMNet TensorFlow.js 모델 다운로드
- React/Vite build
- GitHub Pages 배포

를 수행합니다.

## 로컬 개발

Python은 필요 없습니다.

```bash
npm install
npm run prepare:model
npm run dev
```

브라우저:

```text
http://localhost:5173
```

## 주의사항

YAMNet은 AudioSet 기반 범용 521-class 음향 분류 모델입니다.

전자레인지 완료음이나 특정 재난문자 알림음처럼 제품/휴대폰별로 달라지는
특정 음원을 전용 클래스로 구분하는 모델은 아닙니다.

현재 버전에서는 `Beep, bleep`, `Alarm clock` 등의 범용 YAMNet 클래스를
전자기기 알림으로 연결합니다.

특정 알림음을 높은 정확도로 분리하려면 실제 대상 음원을 수집하고
YAMNet embedding 기반 추가 분류기를 학습하는 방식이 적합합니다.

## 개인정보 측면

이 GitHub Pages 버전에서는 마이크 오디오를 별도의 FastAPI 서버로 전송하지 않습니다.
YAMNet 추론이 사용자의 브라우저에서 이루어집니다.

## 주요 파일

```text
.github/workflows/deploy.yml   GitHub Pages 자동 배포
scripts/download-yamnet.mjs   YAMNet 모델 다운로드
src/yamnet.js                 YAMNet 실행 및 score aggregation
src/audioEngine.js            마이크/시간적 smoothing/위험도 연결
src/rules.js                  소리별 위험 규칙
src/App.jsx                   React UI
```
