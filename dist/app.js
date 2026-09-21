const phoneWidth = 338.46154785;
const phoneHeight = 720;
let restWidth = 0;
let restHeight = 0;
const visibleFrame = () => {
  const vv = window.visualViewport;
  if (!vv) return { width: window.innerWidth, height: window.innerHeight, top: 0, left: 0 };
  return { width: vv.width, height: vv.height, top: vv.offsetTop, left: vv.offsetLeft };
};
const resizePhone = () => {
  const mobile = window.matchMedia('(max-width: 600px)').matches;
  const frame = visibleFrame();
  const root = document.documentElement;
  root.dataset.mobileApp = String(mobile);
  if (!mobile) {
    restWidth = 0;
    restHeight = 0;
    root.dataset.keyboard = 'false';
    const scale = Math.max(0.1, Math.min(1.1375, (window.innerWidth - 32) / phoneWidth, (window.innerHeight - 48) / phoneHeight));
    root.style.setProperty('--phone-scale', String(scale));
    return;
  }
  const widthChanged = Math.abs(frame.width - restWidth) > 48;
  const keyboardOpen = restHeight > 0 && !widthChanged && restHeight - frame.height > 140;
  if (!keyboardOpen) {
    restWidth = frame.width;
    restHeight = frame.height;
  }
  const layoutWidth = restWidth || frame.width;
  const layoutHeight = restHeight || frame.height;
  const scale = Math.max(0.1, layoutWidth / phoneWidth);
  const top = keyboardOpen ? frame.top + frame.height - layoutHeight : frame.top;
  root.dataset.keyboard = String(keyboardOpen);
  root.style.setProperty('--phone-scale', String(scale));
  root.style.setProperty('--vv-top', `${top}px`);
  root.style.setProperty('--vv-left', `${frame.left}px`);
  root.style.setProperty('--vv-width', `${layoutWidth}px`);
  root.style.setProperty('--vv-height', `${layoutHeight}px`);
};
resizePhone();
window.addEventListener('resize', resizePhone);
window.addEventListener('orientationchange', () => {
  restWidth = 0;
  restHeight = 0;
  setTimeout(resizePhone, 120);
});
window.visualViewport?.addEventListener('resize', resizePhone);
window.visualViewport?.addEventListener('scroll', resizePhone);
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
const notice = document.querySelector('dialog');
const iosHomeScreen = document.querySelector('.ios-home-screen');
const iosLindenApp = document.querySelector('.ios-linden-app');
let appOpened = location.hash.length > 0;
const renderScreen = () => {
  const conversation = location.hash === '#conversation';
  const assistant = location.hash === '#assistant';
  const home = location.hash === '#home';
  const onboarding = location.hash === '#onboarding';
  iosHomeScreen.hidden = appOpened;
  document.querySelector('.login-screen').hidden = !appOpened || assistant || home || onboarding || conversation;
  document.querySelector('.conversation-screen').hidden = !conversation;
  document.querySelector('.assistant-screen').hidden = !assistant;
  document.querySelector('.feed-screen').hidden = !home;
  document.querySelector('.onboarding-screen').hidden = !onboarding;
  document.querySelector('.phone').setAttribute('aria-label', !appOpened ? 'Phone home screen' : conversation ? 'Talk to Linden' : onboarding ? 'Linden setup' : home ? 'Linden home' : assistant ? 'Linden assistant' : 'Welcome to Linden');
};
window.addEventListener('hashchange', renderScreen);
renderScreen();
const loginScreen = document.querySelector('.login-screen');
const launchSequence = document.querySelector('.launch-sequence');
const launchButtons = Array.from(loginScreen.querySelectorAll('.login'));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let launchTimers = [];
let loginSoundContext;
const playLoginConfirmation = () => {
  try {
    loginSoundContext ??= new (window.AudioContext || window.webkitAudioContext)();
    const now = loginSoundContext.currentTime;
    const master = loginSoundContext.createGain();
    const filter = loginSoundContext.createBiquadFilter();
    master.gain.setValueAtTime(.0001, now);
    master.gain.exponentialRampToValueAtTime(.026, now + .018);
    master.gain.exponentialRampToValueAtTime(.0001, now + .3);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1380, now);
    master.connect(filter).connect(loginSoundContext.destination);
    [392, 523.25].forEach((frequency, index) => {
      const oscillator = loginSoundContext.createOscillator();
      const gain = loginSoundContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(index ? .22 : .42, now);
      oscillator.connect(gain).connect(master);
      oscillator.start(now + index * .035);
      oscillator.stop(now + .32);
    });
  } catch {}
};
launchButtons.forEach(button => {
  button.addEventListener('click', () => {
    if (button.classList.contains('is-activating')) return;
    playLoginConfirmation();
    if (reducedMotion) { location.hash = 'home'; return; }
    button.classList.add('is-activating');
    button.disabled = true;
    setTimeout(() => {
      location.hash = 'home';
      button.classList.remove('is-activating');
      button.disabled = false;
    }, 720);
  });
});
const loginDrift = {x:0,y:0,vx:0,vy:0};
const animateLoginBackground = time => {
  const seconds = time / 1000;
  const targetX = reducedMotion ? 0 : Math.sin(seconds*.29)*13 + Math.sin(seconds*.12+1.7)*6 + Math.cos(seconds*.47)*2;
  const targetY = reducedMotion ? 0 : Math.cos(seconds*.23+.4)*10 + Math.sin(seconds*.1)*5 + Math.sin(seconds*.41+2.1)*2;
  loginDrift.vx = (loginDrift.vx + (targetX-loginDrift.x)*.018)*.91;
  loginDrift.vy = (loginDrift.vy + (targetY-loginDrift.y)*.018)*.91;
  loginDrift.x += loginDrift.vx;
  loginDrift.y += loginDrift.vy;
  loginScreen.style.setProperty('--login-x', loginDrift.x.toFixed(3));
  loginScreen.style.setProperty('--login-y', loginDrift.y.toFixed(3));
  requestAnimationFrame(animateLoginBackground);
};
requestAnimationFrame(animateLoginBackground);
const finishLaunch = () => {
  loginScreen.classList.remove('is-launching');
  loginScreen.classList.add('is-revealed');
  launchButtons.forEach(button => { button.disabled = false; });
};
const startLoginLaunch = () => {
  launchTimers.forEach(clearTimeout);
  launchTimers = [];
  launchSequence.hidden = false;
  launchSequence.style.animation = 'none';
  loginScreen.classList.remove('is-launching', 'is-revealed');
  void loginScreen.offsetWidth;
  launchSequence.style.animation = '';
  loginScreen.classList.add('is-launching');
  if (reducedMotion) {
    launchSequence.hidden = true;
    finishLaunch();
    return;
  }
  launchButtons.forEach(button => { button.disabled = true; });
  launchTimers.push(setTimeout(finishLaunch, 3050));
  launchTimers.push(setTimeout(() => { launchSequence.hidden = true; }, 3100));
};
const openLindenFromHome = () => {
  if (appOpened || iosHomeScreen.classList.contains('is-opening')) return;
  appOpened = true;
  history.replaceState(null, '', '#welcome');
  loginScreen.hidden = false;
  startLoginLaunch();
  if (reducedMotion) { renderScreen(); return; }
  iosHomeScreen.classList.add('is-opening');
  loginScreen.classList.add('is-entering-app');
  let completed = false;
  const finishOpening = () => {
    if (completed) return;
    completed = true;
    renderScreen();
    iosHomeScreen.classList.remove('is-opening');
    loginScreen.classList.remove('is-entering-app');
    iosHomeScreen.removeEventListener('animationend', onOpeningEnd);
  };
  const onOpeningEnd = event => {
    if (event.target === iosHomeScreen && event.animationName === 'ios-home-exit') finishOpening();
  };
  iosHomeScreen.addEventListener('animationend', onOpeningEnd);
  setTimeout(finishOpening, 400);
};
iosLindenApp.addEventListener('click', openLindenFromHome);
if (!appOpened) {
  launchSequence.hidden = false;
  launchButtons.forEach(button => { button.disabled = true; });
} else if (reducedMotion || location.hash && location.hash !== '#welcome') {
  launchSequence.hidden = true;
  finishLaunch();
} else {
  startLoginLaunch();
}
document.querySelector('.back-control').addEventListener('click', () => {location.hash = 'welcome';});
document.querySelector('.type-button').addEventListener('click', () => document.querySelector('.composer').showModal());
document.querySelectorAll('.utility-controls button').forEach(button => button.addEventListener('click', () => notice.showModal()));

document.querySelector('.feed-avatar-button').addEventListener('click', () => {
  location.hash = 'conversation';
  renderScreen();
  requestAnimationFrame(() => document.querySelector('.conversation-editor').focus());
});
document.querySelector('.keyboard-button').addEventListener('click', () => {
  location.hash = 'conversation';
  renderScreen();
  requestAnimationFrame(() => document.querySelector('.conversation-editor').focus());
});

const showDetail = (title, body) => {
  notice.querySelector('h1').textContent = title;
  notice.querySelector('p').textContent = body;
  notice.showModal();
};
const quote = 'Take a slow breath. Let your shoulders soften. This is your quiet space to pause, notice, and return to yourself.';
document.querySelector('.see-more').addEventListener('click', () => showDetail('Your weekly rhythm', 'Your recent check-ins show steadier sleep and energy. Think about what felt supportive this week—an earlier night, a calmer morning, or a little more space between things.'));
document.querySelector('.captions-button').addEventListener('click', () => showDetail('Guided pause', quote));

document.querySelector('.card-more').addEventListener('click', () => showDetail('Insight options', 'Save this reflection, revisit it later, or choose which signals Linden uses to shape future insights.'));
document.querySelectorAll('.video-play,.link-button').forEach(button => button.addEventListener('click', () => showDetail('A calmer evening', 'A gentle wind-down can help mark the transition from a busy day into rest. Start with two quiet minutes and notice what your body needs.')));
const onboarding = document.querySelector('.onboarding-screen');
const onboardingPages = Array.from(document.querySelectorAll('.onboarding-page'));
const onboardingProgress = document.querySelector('.onboarding-progress');
const onboardingNextLabel = document.querySelector('.onboarding-next span');
const welcomeWords = Array.from(document.querySelectorAll('.spoken-welcome span'));
let onboardingStep = 0;
let profileComplete = false;
let welcomeSpeech;
let welcomeTimers = [];
window.getLindenVoice = () => {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const naturalFemale = /samantha|ava|victoria|karen|moira|tessa|fiona|zira|jenny|aria|emma|olivia|female/i;
  return voices.find(item => item.lang.startsWith('en') && naturalFemale.test(item.name))
    || voices.find(item => item.lang === 'en-US')
    || voices.find(item => item.lang.startsWith('en'))
    || voices[0]
    || null;
};
const clearWelcome = () => {
  welcomeTimers.forEach(clearTimeout); welcomeTimers = [];
  if (welcomeSpeech) window.speechSynthesis?.cancel();
  welcomeSpeech = null;
};
const animateOnboardingPage = page => {
  if (reducedMotion || !page) return;
  page.animate([
    {opacity:0,transform:'translateX(18px) scale(.985)',filter:'blur(5px)'},
    {opacity:1,transform:'translateX(0) scale(1)',filter:'blur(0)'}
  ],{duration:620,easing:'cubic-bezier(.16,1,.3,1)'});
};
const speakWelcome = () => {
  clearWelcome();
  welcomeWords.forEach(word => word.classList.remove('is-spoken'));
  const reveal = index => welcomeWords[index]?.classList.add('is-spoken');
  if (!('speechSynthesis' in window)) {
    welcomeTimers.push(setTimeout(() => reveal(0), 220),setTimeout(() => reveal(1),640));
    return;
  }
  welcomeSpeech = new SpeechSynthesisUtterance('Welcome, Martin.');
  const model = window.lindenVoiceModel || {rate:.98,pitch:1.04};
  welcomeSpeech.lang = 'en-US'; welcomeSpeech.rate = model.rate; welcomeSpeech.pitch = model.pitch;
  welcomeSpeech.onstart = () => {
    welcomeTimers.push(setTimeout(() => reveal(0),80),setTimeout(() => reveal(1),500));
  };
  welcomeSpeech.onboundary = event => reveal(event.charIndex > 7 ? 1 : 0);
  welcomeSpeech.onend = () => welcomeWords.forEach(word => word.classList.add('is-spoken'));
  let started = false;
  const play = () => {
    if (started || !welcomeSpeech || location.hash !== '#onboarding') return;
    started = true;
    welcomeSpeech.voice = window.getLindenVoice?.() || null;
    if (welcomeSpeech.voice) welcomeSpeech.lang = welcomeSpeech.voice.lang;
    speechSynthesis.speak(welcomeSpeech);
  };
  if (speechSynthesis.getVoices().length) play();
  else {
    speechSynthesis.addEventListener('voiceschanged',play,{once:true});
    welcomeTimers.push(setTimeout(play,420));
  }
};
const onboardingSpokenTitles = [
  '',
  'A space made for you.',
  'What matters to you?',
  'Create a steady rhythm.',
  'Your profile is ready.'
];
const speakOnboardingTitle = step => {
  clearWelcome();
  const title = onboardingSpokenTitles[step];
  if (!title || !('speechSynthesis' in window) || location.hash !== '#onboarding') return;
  welcomeSpeech = new SpeechSynthesisUtterance(title);
  const model = window.lindenVoiceModel || {rate:.98,pitch:1.04};
  welcomeSpeech.lang = 'en-US';
  welcomeSpeech.rate = model.rate;
  welcomeSpeech.pitch = model.pitch;
  let started = false;
  const play = () => {
    if (started || !welcomeSpeech || location.hash !== '#onboarding' || onboardingStep !== step) return;
    started = true;
    welcomeSpeech.voice = window.getLindenVoice?.() || null;
    if (welcomeSpeech.voice) welcomeSpeech.lang = welcomeSpeech.voice.lang;
    speechSynthesis.speak(welcomeSpeech);
  };
  if (speechSynthesis.getVoices().length) play();
  else {
    speechSynthesis.addEventListener('voiceschanged',play,{once:true});
    welcomeTimers.push(setTimeout(play,420));
  }
};
const setOnboardingStep = (step, {animate = true} = {}) => {
  onboardingStep = Math.max(0, Math.min(4, step));
  onboarding.dataset.step = String(onboardingStep);
  onboardingPages.forEach((page,index) => page.hidden = index !== onboardingStep);
  onboardingProgress.setAttribute('aria-valuenow',String(Math.min(3,onboardingStep)));
  onboardingProgress.querySelector('span').style.width = `${Math.min(100,onboardingStep * (100 / 3))}%`;
  onboardingNextLabel.textContent = ['Get started','Continue','Continue','Confirm',''][onboardingStep];
  document.querySelector('.onboarding-cancel').disabled = onboardingStep === 0 || onboardingStep === 4;
  document.querySelector('.onboarding-next b').textContent = '→';
  if (animate) animateOnboardingPage(onboardingPages[onboardingStep]);
  if (onboardingStep === 0) {
    clearWelcome();
    welcomeTimers.push(setTimeout(speakWelcome,90));
  } else {
    clearWelcome();
    welcomeTimers.push(setTimeout(() => speakOnboardingTitle(onboardingStep),animate ? 260 : 90));
  }
};
document.querySelector('.profile-button').addEventListener('click', () => {
  location.hash = 'onboarding';
  if (profileComplete) requestAnimationFrame(() => setOnboardingStep(4,{animate:false}));
});
document.querySelector('.onboarding-close').addEventListener('click', () => {clearWelcome();location.hash = 'home';});
document.querySelector('.onboarding-cancel').addEventListener('click', () => {
  if (onboardingStep > 0) setOnboardingStep(onboardingStep - 1);
});
document.querySelector('.onboarding-next').addEventListener('click', () => {
  if (onboardingStep === 4) {location.hash = 'home'; return;}
  if (onboardingStep === 3) {
    profileComplete = true;
    const name = document.querySelector('.profile-field input[aria-label="Name"]').value.trim() || 'Martin';
    const focus = Array.from(document.querySelectorAll('.focus-chip[aria-pressed="true"]'),button => button.dataset.value);
    const checkInOn = document.querySelector('.routine-card').getAttribute('aria-pressed') === 'true';
    document.querySelector('.profile-summary-name').textContent = name;
    document.querySelector('.profile-summary-focus-count').textContent = `${focus.length} ${focus.length === 1 ? 'area' : 'areas'}`;
    document.querySelector('.profile-summary-focus-list').textContent = focus.length ? focus.join(' · ') : 'Nothing selected';
    document.querySelector('.profile-summary-checkin').textContent = checkInOn ? 'Tomorrow' : 'Paused';
    document.querySelector('.profile-summary-time').textContent = checkInOn ? '9:00 AM' : 'No reminder';
  }
  setOnboardingStep(onboardingStep + 1);
});
document.querySelectorAll('.focus-chip,.routine-card').forEach(button => button.addEventListener('click', () => {
  const selected = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed',String(selected));
  button.classList.toggle('is-selected',selected);
  const state = button.querySelector('b');
  if (state) state.textContent = selected ? 'On' : 'Off';
}));
window.addEventListener('hashchange', () => {
  if (location.hash === '#onboarding' && !profileComplete) setOnboardingStep(0,{animate:false});
  else if (location.hash !== '#onboarding') clearWelcome();
});
if (location.hash === '#onboarding') setOnboardingStep(0,{animate:false});
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && location.hash === '#onboarding' && !document.querySelector('dialog[open]')) location.hash = 'home';
});
const heights = [2,8,14,4,14,16,4,14,16,10,14,10,10,14,10,10,14,16,10,10,16,4,10,2,4];
for (const height of heights) {
  const bar = document.createElement('span');
  bar.style.height = `${height * 0.8791208863}px`;
  document.querySelector('.waveform').appendChild(bar);
}
