# VOID | 훌훌

> 마음껏 쓰고, 훌훌 털어버려. — *Type it out. Let it go.*

짜증·분노·답답함을 마음껏 타이핑하면, 구름이 "후우" 하고 숨을 내쉬며 글이 반짝임으로 흩어지는 감정 배출 앱.
React Native + Expo (SDK 58) + TypeScript + Reanimated 4. 서버·로그인·저장 없음, 완전 오프라인.

## 다운로드

### 안드로이드
1. [**Releases**](https://github.com/jivvoow/void/releases/latest) 에서 `hulhul-vX.Y.Z.apk` 를 휴대폰으로 다운로드
2. 파일을 열고 **"출처를 알 수 없는 앱 설치" 허용** (처음 한 번)
3. 설치하면 홈 화면에 구름 아이콘 **훌훌** 이 생겨요

> 스토어를 거치지 않은 앱이라 Play 프로텍트가 경고를 띄울 수 있어요. 이 앱은 서버가 없고, 쓴 글을 저장하거나 어디로도 보내지 않아요.

### 아이폰
애플은 앱스토어 밖에서 설치 파일을 나눠 주는 걸 허용하지 않아서, GitHub로는 배포할 수 없어요.
대신 PC에서 아래 [실행](#실행) 방법으로 띄운 뒤 **Expo Go** 앱으로 QR을 찍으면 열 수 있어요.

## 새 버전 배포 (개발자용)

GitHub Actions가 태그를 받으면 EAS 클라우드에서 APK를 빌드해 Releases에 올려요 ([`release-apk.yml`](.github/workflows/release-apk.yml)).

**처음 한 번만**
```bash
npx eas-cli@latest login     # Expo 계정 (무료)
npx eas-cli@latest init      # app.json 에 projectId 가 추가됨 → 커밋
```
그리고 [expo.dev → Access tokens](https://expo.dev/settings/access-tokens)에서 토큰을 만들어
GitHub 저장소 **Settings → Secrets and variables → Actions** 에 `EXPO_TOKEN` 으로 저장.

**배포할 때마다**
```bash
# app.json 의 "version" 을 올리고 커밋한 뒤 (예: 0.1.0 → 0.2.0)
git tag v0.2.0
git push origin v0.2.0       # → 약 10~30분 뒤 Releases 에 APK 가 올라와요
```
직접 빌드만 해 보고 싶으면: `npx eas-cli@latest build -p android --profile preview` (APK 다운로드 링크가 나옴).
아이콘·스플래시는 `python scripts/gen_icons.py` 로 다시 만들 수 있어요.

## 실행

```bash
npm install
npx expo start          # QR 코드를 Expo Go 앱으로 스캔
npm run typecheck       # TypeScript 검사
```

- 휴대폰과 PC가 같은 Wi‑Fi에 있어야 합니다. 안 되면 `npx expo start --tunnel`.
- Expo Go는 **SDK 58**을 지원하는 최신 버전이어야 합니다.

### Expo Go vs 개발 빌드

| 기능 | Expo Go | 개발 빌드 필요 |
|---|---|---|
| 메인 화면, 구름, 그라데이션, 입력, 자동/직접 소멸 | ✅ | |
| Reanimated 애니메이션, SVG, 햅틱 | ✅ | |
| 앱 전환 화면 보호 (iOS 블러, Android FLAG_SECURE) | ✅ (Expo Go 자체 설정과 섞일 수 있음) | 정확한 확인은 개발 빌드 권장 |
| 앱 이름 "훌훌"·아이콘·스플래시 | ❌ (Expo Go 아이콘으로 표시) | ✅ Releases 의 APK, 또는 `eas build -p android --profile preview` |
| 효과음 (`expo-audio`, 앱 안에 내장된 자체 합성음) | ✅ | 무음 모드에서는 울리지 않음. 소리 파일은 `scripts/gen_sounds.py`로 다시 만들 수 있음 |

## 구조

```
App.tsx                      폰트 로딩, 설정 모달, 앱 전환 보호 커버
src/
  screens/HomeScreen.tsx     REST → VENT → GRACE → FADE → CLEAR 상태 머신 (한 화면)
  screens/SettingsScreen.tsx 자동 소멸 시간, 진동, 효과음, 애니메이션 강도, 언어, 개인정보
  components/                CloudCharacter, EmotionTextInput, FadeOverlay, StatusPill,
                             ReleaseButton, SkyBackground, IntensityIndicator, PrivacyCover
  hooks/useAutoFade.ts       마지막 입력 기준 타이머 + 취소 가능 구간 + 백그라운드 복귀 처리
  hooks/useTypingIntensity.ts  (Phase 2) 타이핑 속도 → calm / building / burst
  animations/                구름 호흡·숨 내쉬기, 소멸 진행도·입자 경로
  utils/typingMetrics.ts     입력 이벤트 기반 속도 측정 (내용은 절대 보지 않음)
  constants/                 theme(색·폰트), config(시간 값)
  i18n/                      ko (기본), en (스텁)
  state/SettingsContext.tsx  설정 (메모리)
```

## 설계 메모

- **한글 IME**: 입력창은 비제어(uncontrolled) `TextInput`. `value`를 매 입력마다 다시 넣지 않아 iOS 조합이 깨지지 않음. 비울 때는 `key`를 바꿔 다시 마운트.
- **개인정보**: 원문은 `useRef` 하나와 네이티브 입력창에만 존재. state/저장소/로그 없음. 소멸 시 ref 비우고 입력창 재마운트.
- **소멸 연출**: 하나의 `fadeProgress`(0→1, 2.6초)가 글자·구름 숨·입자를 모두 구동. Phase 3에서 글자별 입자로 바꿀 때 같은 드라이버를 그대로 사용.

## 수동 테스트 체크리스트

**한글 입력**
- [ ] "안녕하세요 진짜 짜증나" 를 빠르게/천천히 입력 → 자모가 중복되거나 커서가 튀지 않음
- [ ] 중간 커서 이동 후 수정, 전체 선택 삭제 정상
- [ ] 긴 글 입력 시 자동 스크롤, 키보드 위로 현재 줄이 보임 (iPhone SE 크기 포함)

**자동 소멸** (설정 → 15초로 바꾸면 빠름)
- [ ] 입력 멈춤 → (지연-5초) 시점에 "곧 훌훌 날아가요" 알약 + 줄어드는 바
- [ ] 그 구간에 다시 타이핑 → 소멸 취소, 타이머 처음부터
- [ ] 알약 탭 → 취소
- [ ] 시간이 다 되면 키보드 내려감 → 구름 숨 내쉬기 + 글 흐려짐 + 반짝임 → "훌훌, 이제 보내줬어요." → 빈 화면
- [ ] 소멸 중에는 입력·버튼 동작 안 함
- [ ] 설정 "끄기" → 자동 소멸 없음, 알약에 "자동 소멸 꺼짐"

**타이머 / 키보드 / 안내**
- [ ] 첫 실행 시 3장 안내가 나오고, 다시 실행하면 안 나옴 (설정 → 사용법 다시 보기로 재생)
- [ ] 상단 ⏱ 알약 탭 → 즉시·3초·15초·끄기 선택, 선택값이 알약에 표시되고 재실행 후에도 유지
- [ ] 3초 선택 시 입력을 멈추면 거의 바로 사라짐
- [ ] 글 쓰는 중 구름/빈 곳 탭 또는 오른쪽 위 ⌄ 버튼 → 키보드 내려감 (글은 그대로)

**와다다 배출 (타이핑 속도 반응)**
- [ ] 쓰는 동안 구름이 입을 "아~" 벌렸다 앙 다물고 한 번 냠 오물거리며 삼킴 (글자·구슬은 튀어나오지 않음)
- [ ] 빠르게 → 구름이 분홍으로 부풀고 주변에 파동, 하늘이 따뜻해짐, 가벼운 진동
- [ ] "아아아아아" 연타 → 구름 `> <` 찡그림 + 코랄 파동 + 화난 선, 글자가 흔들림
- [ ] 많이 쓸수록 구름이 점점 빵빵해지고, 지우면 다시 작아짐

**직접 소멸 — 기본 홀씨**
- [ ] "훌훌 날리기" 한 번 탭 (또는 구름 0.8초 꾹) → 구름이 부풀었다 "O" 입으로 후우~ → 글자가 홀씨처럼 흩어져 위로 날아감
- [ ] 후우~ / 반짝 소리, 끝나면 차임 + "훌훌, 이제 보내줬어요."

**직접 소멸 — 찢어서 홀씨 (설정 → 날리는 방식)**
- [ ] "훌훌 날리기" 탭 → 글이 반투명한 구름 종이로 바뀌고 "손가락으로 쭉 그어서 찢어요"
- [ ] 손가락으로 그린 모양 그대로(곡선·지그재그·대각선) 찢어짐. 긋는 동안 흰 점선이 따라오고, 종이 밖으로 나가면 바로 찢어진 뒤 계속 그을 수 있음. 중간에 멈춘 선은 그 방향으로 가장자리까지 이어서 찢어짐. 최대 16조각. 긋는 동안 손가락 속도에 맞춰 찢는 소리가 계속 나고(빠를수록 크고 높게, 멈추면 멈춤) 잘게 톡톡 진동, 한 번 찢어질 때마다 '쫙!' 소리 + 진동
- [ ] 찢은 조각의 들쭉날쭉한 가장자리가 서로 맞물리고, 조각이 살짝 벌어짐. 조각 위 글씨가 잘린 모양대로 보임
- [ ] 찢다가 손을 떼고 약 1.5초 또는 종이를 톡 → 구름이 후우~ → 조각이 팔랑이며 날아가다 홀씨로 부서짐
- [ ] 하나도 안 찢고 톡 → 알아서 두 번 찢고 날아감 / 7초 동안 아무것도 안 하면 알아서 찢음
- [ ] 자동 소멸 타이머로 끝날 때는 종이가 알아서 찢어져 날아감

**백그라운드 / 개인정보**
- [ ] 글 쓰는 중 홈으로 → 앱 전환 화면에 글이 보이지 않음 (iOS: 구름 커버/블러, Android: 빈 화면)
- [ ] 지연 시간보다 오래 백그라운드에 있다가 복귀 → 바로 소멸 연출
- [ ] 앱 완전 종료 후 재실행 → 빈 화면, 이전 글 없음

**접근성**
- [ ] 기기 글꼴 크게 → 버튼·알약이 잘리지 않음
- [ ] "동작 줄이기" 켜기 → 구름 흔들림·입자 최소화
- [ ] VoiceOver/TalkBack: "훌훌 날리기"는 이중 탭으로 실행

## 로드맵

- **Phase 1 ✅** MVP — 입력, 자동 소멸, 길게 눌러 날리기, 초기 상태 복귀
- **Phase 2 ✅** 타이핑 속도 → CALM/BUILDING/BURST, 반짝이가 구름으로 흡수, 구름 충전(부풀기), 파동, 햅틱
- **Phase 3 ✅(1차)** 글자별 흩어짐 + 반짝임, 구름 숨 내쉬기 — 실기기 피드백으로 튜닝 예정
- **Phase 4** 아이콘·스플래시, 접근성·성능 다듬기, 실기기 테스트
