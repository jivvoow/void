import type { FadeDelay } from '../types';

export const ko = {
  brand: { en: 'VOID', ko: '훌훌' },
  slogan: '마음껏 쓰고, 훌훌 털어버려.',
  sloganEn: 'Type it out. Let it go.',

  home: {
    prompt: '마음속 답답함,\n여기에 털어놓아요.',
    placeholder: '하고 싶은 말을 아무렇게나 써요...',
    pillVent: (delay: string) => `감정 방출중 · ${delay}`,
    timerChip: (s: FadeDelay) => (s == null ? '자동 소멸 꺼짐' : s === 'instant' ? '쓰는 즉시 훌훌' : `${s}초 뒤 훌훌`),
    timerShort: (s: FadeDelay) => (s == null ? '꺼짐' : s === 'instant' ? '즉시' : `${s}초`),
    timerPickerTitle: '멈추면 사라지기까지',
    a11yTimer: (s: FadeDelay) =>
      s == null
        ? '자동 소멸 꺼짐. 눌러서 바꾸기'
        : s === 'instant'
          ? '먼저 쓴 글자부터 차례로 사라짐. 눌러서 바꾸기'
          : `입력을 멈추고 ${s}초 뒤 사라짐. 눌러서 바꾸기`,
    restHint: '와다다 쏟아낼수록 구름이 꿀꺽 삼켜요',
    gulps: ['꿀꺽', '냠', '꿀꺽꿀꺽', '냠냠', '꿀꺽!'],
    releaseBubble: '구름을 꾹 누르면 후~ 날려 보내요',
    a11yCloud: '감정을 머금은 구름. 길게 누르면 적은 글을 날려 보내요.',
    a11yKeyboardDown: '키보드 내리기',
    pillGrace: '곧 훌훌 날아가요 · 탭하면 멈춰요',
    pillFade: '지금, 천천히 사라지고 있어요…',
    pillPaused: '자동 소멸 꺼짐 · 꾹 눌러 날려요',
    clear: '훌훌, 이제 보내줬어요.',
    release: '훌훌 날리기',
    a11ySettings: '설정 열기',
    a11yInput: '감정을 적는 입력창. 내용은 저장되지 않아요.',
    a11yRelease: '훌훌 날리기. 길게 누르면 적은 글이 사라져요.',
    a11yGrace: '자동 소멸 취소',
    privacyCover: '훌훌',
  },

  onboarding: {
    skip: '건너뛰기',
    tapNext: '카드를 눌러 넘겨요',
    tapStart: '카드를 눌러 시작해요',
    steps: [
      {
        title: '와다다 쏟아내요',
        body: '빠르게 쏟아낼수록 구름이 감정을\n꿀꺽꿀꺽 삼키며 빵빵해져요.',
      },
      {
        title: '구름을 꾹 눌러요',
        body: '다 쏟아냈으면 구름을 꾹.\n후우~ 하고 한 번에 날려 보내요.',
      },
      {
        title: '멈추면 저절로 사라져요',
        body: '위쪽 ⏱에서 시간을 골라요.\n‘즉시’면 먼저 쓴 글자부터 스르륵 사라져요.',
      },
    ],
  },

  settings: {
    title: '설정',
    replayGuide: '사용법 다시 보기',
    done: '완료',
    sectionFade: '자동 소멸',
    fadeCaption: '마지막으로 입력한 뒤 이 시간이 지나면 글이 사라져요. ‘즉시’는 쓰는 동안 먼저 쓴 글자부터 차례로 스르륵 사라져요.',
    fadeOption: (s: FadeDelay) => (s == null ? '끄기' : s === 'instant' ? '즉시' : `${s}초`),
    sectionFeel: '감각',
    haptics: '진동',
    hapticsCaption: '감정이 차오를 때와 글이 사라질 때 살짝 울려요.',
    sound: '효과음',
    soundCaption: '다음 업데이트에서 추가될 예정이에요.',
    animation: '애니메이션 강도',
    animationSoft: '은은하게',
    animationFull: '풍성하게',
    animationCaption: '기기의 ‘동작 줄이기’ 설정이 켜져 있으면 자동으로 은은하게 표시돼요.',
    sectionLanguage: '언어',
    languageKo: '한국어',
    languageEnSoon: 'English (준비 중)',
    sectionPrivacy: '개인정보 보호',
    privacyItems: [
      '적은 글은 이 기기의 앱 메모리에만 잠깐 머물러요. 서버로 보내지 않고, 파일로 저장하지 않아요.',
      '로그인이 없고, 기록 목록이나 자동 저장이 없어요. 앱을 다시 열면 항상 빈 화면이에요.',
      '글이 사라지면 앱이 들고 있던 내용도 함께 지워져요.',
      '앱 전환 화면에서는 글이 보이지 않도록 가려요. (Android에서는 글을 쓰는 동안 화면 캡처도 막혀요.)',
      '앱이 클립보드에 자동으로 복사하지 않고, 로그나 오류 기록에 글을 남기지 않아요.',
    ],
    privacyLimits:
      '다만 키보드 앱의 학습·예측 기능, 사용자가 직접 찍은 화면 캡처, 운영체제의 백업 등 앱 바깥에서 생기는 흔적까지 지워진다고 약속할 수는 없어요.',
    version: (v: string) => `VOID · 훌훌 ${v}`,
  },
};

export type Strings = typeof ko;
