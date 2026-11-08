<p align="center">
  <img src="assets/icon.png" width="112" alt="훌훌 앱 아이콘" />
</p>

<h1 align="center">VOID | 훌훌</h1>

<p align="center">
  <b>마음껏 쓰고, 훌훌 털어버려.</b> · <i>Type it out. Let it go.</i><br /><br />
  <a href="https://github.com/jivvoow/void/releases/latest"><b>⬇ Android APK</b></a>
</p>

## About

짜증, 분노, 답답함을 아무에게도 보여 주지 않고 **와다다 쏟아낼 수 있는 감정 배출 앱**이에요.
쓰는 동안 구름 캐릭터가 감정을 받아먹고, 다 쓰면 구름이 "후우~" 불어서 글을 **홀씨처럼 날려 보내요.**

- 서버, 로그인, 광고, 분석 도구가 없어요. 오프라인에서 동작해요.
- 쓴 글은 저장하지 않아요. 앱을 다시 열면 항상 빈 화면이에요.
- 글의 내용이나 뜻은 분석하지 않아요. 구름은 **타이핑 속도**에만 반응해요.

## Screenshots

> **TODO:** 실제 기기 스크린샷 추가 예정 (첫 화면 · 쏟아내는 중 · 홀씨 · 찢기 · 설정)

## How It Works

**쓰기 → 구름이 받아먹기 → 날려 보내기 → 빈 화면**

## Features

### Type It Out
- 쓰는 동안 구름이 입을 벌려 받아먹고, 많이 쓸수록 빵빵해져요.
- 구름은 **타이핑 속도**에만 반응해요. 2초 동안 초당 입력 횟수를 세서, 4.5회 이상이면 분홍빛으로 부풀고 7.5회 이상이면 `> <` 찡그려요.
- 글의 내용은 분석하지 않아요.

### Let It Go
"훌훌 날리기" 버튼을 누르거나 구름을 0.8초 꾹 누르면 구름이 "후우~" 불어요. 날리는 방식은 두 가지예요.
- **기본 홀씨:** 글자 하나하나가 홀씨처럼 흩어져 날아가요.
- **찢어서 홀씨:** 글이 구름 종이가 되고, 손가락으로 그은 모양 그대로 찢어져요(최대 16조각). 찢는 소리와 진동이 따라와요.

### Auto Fade
| 선택 | 동작 |
|---|---|
| 즉시 | 먼저 쓴 글자부터 차례로 녹아 사라져요. |
| 3초 / 15초 (기본) | 입력을 멈추면 알림 후 날아가요. 알림이 뜬 사이에 다시 쓰면 취소돼요. |
| 끄기 | 직접 날릴 때까지 그대로 둬요. |

### Additional Features
효과음(iOS 무음 모드에서는 꺼짐), 진동, 애니메이션 강도 조절, 첫 실행 안내를 지원해요.

## Privacy
- 서버가 없어서 쓴 글을 네트워크로 보내지 않아요. 분석·광고 도구도 없어요.
- 글은 저장하지 않아요. 기기에 남는 건 설정값뿐이에요.
- 글이 날아가면 앱이 들고 있던 내용을 비워요.
- 로그 기록과 클립보드 자동 복사는 하지 않아요.
- 앱 전환 화면에서 글을 가려요. Android에서는 글이 있는 동안 스크린샷도 막아요.
- 마이크는 쓰지 않아요.

> 키보드 앱의 학습 기능, OS 백업, iOS 스크린샷, 다른 기기로 촬영하는 것처럼 앱 바깥에서 남는 흔적은 앱이 막을 수 없어요.

## Download
- **Android:** [Releases](https://github.com/jivvoow/void/releases/latest)에서 APK를 받아 설치해요. 처음 한 번은 "출처를 알 수 없는 앱 설치"를 허용해야 해요.
- **iOS:** 현재 설치 파일은 제공하지 않아요. **SDK 58을 지원하는 Expo Go**가 있으면 실행할 수 있어요 (아래 Getting Started, 또는 EAS Update로 올린 버전).

---

## Getting Started
```bash
npm install
npx expo start      # Expo Go(SDK 58)로 QR 스캔 (iPhone은 기본 카메라). 연결이 안 되면 --tunnel
npm run typecheck
```
앱 아이콘·이름·스플래시는 Expo Go에서 보이지 않아요. APK에서 확인할 수 있어요.

**PC 없이 Expo Go로 보기 (EAS Update)**
```bash
npm run update -- --message "변경 내용"   # = eas update --branch main
```
올린 버전은 [EAS 대시보드](https://expo.dev/accounts/jivvoow/projects/void-app/updates)의 업데이트 → **Preview** QR로 Expo Go에서 열 수 있어요. 런타임은 `exposdk:58.0.0`이에요. 설치된 APK는 업데이트를 자동으로 확인하지 않아요(`checkAutomatically: NEVER`).

## Tech Stack
React Native 0.88 · Expo SDK 58 · TypeScript · Reanimated 4 · react-native-svg · expo-audio · expo-haptics · expo-screen-capture · AsyncStorage(설정값만) · Gamja Flower 폰트(SIL OFL)

## Project Structure
```
App.tsx                    앱 진입점, 설정 모달, 첫 실행 안내, 앱 전환 가림막
src/screens/               HomeScreen(한 화면 상태 머신) · SettingsScreen
src/components/            CloudCharacter · GlyphEvaporation(홀씨) · TearPaper(찢기) · TrailingText(즉시 모드) …
src/hooks/                 useAutoFade · useTypingIntensity · useHoldToRelease
src/utils/                 tearGeometry · sound · haptics · typingMetrics
scripts/                   아이콘·효과음 생성 스크립트
.github/workflows/         release-apk.yml
```

## Release & Deployment
`v*` 태그를 푸시하면 GitHub Actions가 EAS로 APK를 빌드해서 GitHub Release에 첨부해요.
```bash
git tag v0.2.0 && git push origin v0.2.0
```
- 저장소 Secret에 `EXPO_TOKEN`을 등록해야 해요.
- 빌드 설정은 `eas.json`의 `preview` 프로필(APK)이에요.
- 빌드 시간은 EAS 대기열에 따라 달라요.

## Technical Notes
- **한글 입력:** 입력창은 비제어 `TextInput`이에요. 비울 때는 커밋이 끝난 뒤 `clear()`를 부르거나, 입력창을 새로 만들어요.
- **즉시 모드:** 실제 입력창의 글자는 투명하게 두고, 그 위에 겹쳐 그린 글자만 하나씩 흐려지게 해요.
- **날리기:** 진행값 하나(`fadeProgress`, 1.6초)가 구름, 바람, 글자, 홀씨를 모두 UI 스레드에서 움직여요.
- **찢기:** 손가락 경로로 다각형을 자르고, 각 조각은 SVG `ClipPath`로 같은 종이를 잘라 보여 줘요.
- **동작 줄이기:** `ReducedMotionConfig`로 기기 설정 때문에 애니메이션이 건너뛰지 않게 하고, 앱 설정의 애니메이션 강도로 조절해요.
- **에셋:** 아이콘과 효과음은 `scripts/`로 직접 생성했어요.

<details>
<summary><b>Manual Test Checklist</b></summary>

- [ ] 한글을 빠르게 입력하거나 "아아아"를 연타해도 자모 중복, 커서 튐, 글꼴 깨짐이 없음
- [ ] 빠르게 쓰면 구름이 부풀고 하늘이 따뜻해지며 진동, 연타하면 `> <`
- [ ] 기본 홀씨: 탭 → 후우~ → 글자가 홀씨로 날아감 → "훌훌, 이제 보내줬어요."
- [ ] 찢어서 홀씨: 그은 모양대로 찢어지고, 속도에 맞춰 찢는 소리가 남 → 조각이 날아감
- [ ] 즉시 / 3초 / 15초 / 끄기 동작, 알림이 뜬 사이에 입력하면 취소
- [ ] 앱 전환 화면에서 글이 가려지고, 앱을 다시 실행하면 빈 화면
- [ ] 큰 글꼴에서 UI가 잘리지 않고, 스크린리더로 "훌훌 날리기" 실행 가능

</details>
