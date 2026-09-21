(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const screen = $('.conversation-screen');
  const editor = $('.conversation-editor');
  const feedback = $('.conversation-feedback');
  const messages = $('.conversation-messages');
  const copy = $('.conversation-copy');
  const jump = $('.conversation-jump');
  const livePanel = $('.live-voice');
  const liveStatus = $('.live-status');
  const liveAvatarTurn = $('.live-avatar-turn');
  const voicePicker = $('.voice-picker');
  const draft = new DictationDraft();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const voiceModels = [
    {name:'Breeze', description:'Clear and reassuring', rate:.98, pitch:1.04},
    {name:'Calm', description:'Slower and grounded', rate:.9, pitch:.96},
    {name:'Warm', description:'Bright and encouraging', rate:1.02, pitch:1.12}
  ];
  let voiceModel = 0;
  let pendingVoiceModel = 0;
  window.lindenVoiceModel = voiceModels[voiceModel];
  let phase = 'idle';
  let mode = 'compose';
  let liveMuted = false;
  let finishTimer;
  let lastSound = 0;
  let lastText = 0;
  let responseTimer;
  let wordTimer;
  let responseUtterance;
  let previewUtterance;
  let voicePickerReturnFocus;
  let liveTurnTimer;
  let responseGeneration = 0;
  let lastHaptic = 0;
  let followLatest = true;
  const particleCanvas = $('.live-particles');
  const particleContext = particleCanvas.getContext('2d');
  const particles = [];
  const particleColors = ['#397e69','#70aeb7','#d99d95','#d8bd72','#9ac9b7'];
  let particleTarget = 0;
  let particleLevel = 0;
  let particleClock = performance.now();
  let particleCarry = 0;

  const busy = () => ['sending','thinking','speaking'].includes(phase);
  const isLive = () => screen.dataset.live === 'true';
  const clearFinish = () => { clearTimeout(finishTimer); finishTimer = 0; };

  function stopVoicePreview(message = '') {
    if (previewUtterance) window.speechSynthesis?.cancel();
    previewUtterance = null;
    $('.voice-preview-button').classList.remove('is-playing');
    $('.voice-preview-button span').textContent = 'Preview';
    if (message) $('.voice-preview-status').textContent = message;
  }

  function renderVoicePickerSelection(message = '') {
    const selected = voiceModels[pendingVoiceModel];
    document.querySelectorAll('.voice-option').forEach((option, index) => {
      const active = index === pendingVoiceModel;
      option.classList.toggle('is-selected', active);
      option.setAttribute('aria-checked', String(active));
    });
    $('.voice-use-button').textContent = `Use ${selected.name}`;
    $('.voice-preview-status').textContent = message || `${selected.name} is selected.`;
  }

  function openVoicePicker() {
    if (busy()) return;
    pendingVoiceModel = voiceModel;
    voicePickerReturnFocus = document.activeElement;
    stopVoicePreview();
    renderVoicePickerSelection();
    voicePicker.hidden = false;
    navigator.vibrate?.(5);
    requestAnimationFrame(() => document.querySelector('.voice-option.is-selected')?.focus());
  }

  function closeVoicePicker({restoreFocus = true} = {}) {
    if (voicePicker.hidden) return;
    stopVoicePreview();
    voicePicker.hidden = true;
    if (restoreFocus) voicePickerReturnFocus?.focus?.();
  }

  function previewSelectedVoice() {
    const selected = voiceModels[pendingVoiceModel];
    if (previewUtterance) {
      stopVoicePreview(`${selected.name} preview stopped.`);
      return;
    }
    if (!('speechSynthesis' in window)) {
      $('.voice-preview-status').textContent = 'Voice preview is not available in this browser.';
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance('Hi, I’m Linden. I’m here whenever you’re ready.');
    utterance.lang = 'en-US';
    utterance.rate = selected.rate;
    utterance.pitch = selected.pitch;
    utterance.voice = window.getLindenVoice?.() || null;
    if (utterance.voice) utterance.lang = utterance.voice.lang;
    previewUtterance = utterance;
    utterance.onstart = () => {
      if (previewUtterance !== utterance) return;
      $('.voice-preview-button').classList.add('is-playing');
      $('.voice-preview-button span').textContent = 'Stop';
      $('.voice-preview-status').textContent = `Playing ${selected.name}…`;
    };
    const finish = () => {
      if (previewUtterance !== utterance) return;
      previewUtterance = null;
      $('.voice-preview-button').classList.remove('is-playing');
      $('.voice-preview-button span').textContent = 'Preview';
      $('.voice-preview-status').textContent = `${selected.name} preview complete.`;
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
  }

  function clearLiveTurn() {
    clearTimeout(liveTurnTimer);
    liveTurnTimer = 0;
    liveAvatarTurn?.classList.remove('is-turning');
  }

  function scheduleLiveTurn() {
    clearTimeout(liveTurnTimer);
    if (!isLive() || reduced.matches) return;
    liveTurnTimer = setTimeout(() => {
      if (isLive() && !screen.hidden && !liveMuted) {
        liveAvatarTurn.classList.remove('is-turning');
        requestAnimationFrame(() => liveAvatarTurn.classList.add('is-turning'));
      }
      scheduleLiveTurn();
    }, 7000 + Math.random() * 5000);
  }

  liveAvatarTurn?.addEventListener('animationend', event => {
    if (event.animationName === 'live-logo-turn') liveAvatarTurn.classList.remove('is-turning');
  });

  function sizeParticleCanvas() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    particleCanvas.width = Math.round(338.461548 * ratio);
    particleCanvas.height = Math.round(720 * ratio);
    particleContext.setTransform(ratio,0,0,ratio,0,0);
  }

  function emitParticle(currentPhase) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 112 + Math.random() * 38;
    const orbitSpeed = 2.8 + Math.random() * (3.8 + particleLevel * 4.5);
    const outwardSpeed = currentPhase === 'speaking' ? 5 + Math.random() * 7 : (Math.random() - .5) * 1.5;
    particles.push({
      x:169.23 + Math.cos(angle) * radius,
      y:292 + Math.sin(angle) * radius * .72,
      vx:-Math.sin(angle) * orbitSpeed + Math.cos(angle) * outwardSpeed,
      vy:Math.cos(angle) * orbitSpeed * .72 + Math.sin(angle) * outwardSpeed * .72,
      size:.55 + Math.random() * (.85 + particleLevel * .6),
      age:0,
      life:3.2 + Math.random() * 2.8,
      color:particleColors[Math.floor(Math.random() * particleColors.length)],
      turn:(Math.random() > .5 ? 1 : -1) * (.08 + Math.random() * .13)
    });
    if (particles.length > 56) particles.splice(0,particles.length - 56);
  }

  function drawLiveParticles(now) {
    const dt = Math.min(34,(now - particleClock) || 16) / 1000;
    particleClock = now;
    particleLevel += (particleTarget - particleLevel) * Math.min(1,dt * 8);
    particleContext.clearRect(0,0,338.461548,720);
    const active = isLive() && !screen.hidden && !liveMuted;
    if (active && !reduced.matches) {
      const rates = {idle:2,ready:3,requesting:3,listening:5 + particleLevel * 16,thinking:9,sending:6,speaking:8 + particleLevel * 7};
      particleCarry += dt * (rates[phase] || 2);
      while (particleCarry >= 1) { emitParticle(phase); particleCarry -= 1; }
    }
    particleContext.save();
    particleContext.globalCompositeOperation = 'multiply';
    for (let index = particles.length - 1; index >= 0; index--) {
      const particle = particles[index];
      particle.age += dt;
      if (!active || particle.age >= particle.life) {
        particles.splice(index,1);
        continue;
      }
      const dx = particle.x - 169.23;
      const dy = particle.y - 292;
      const ellipseRadius = Math.sqrt(dx * dx + (dy / .72) * (dy / .72));
      if (phase === 'thinking') {
        particle.vx += -dy * particle.turn * dt;
        particle.vy += dx * particle.turn * dt;
      } else if (phase === 'listening') {
        particle.vx += -dy * (.012 + particleLevel * .018) * dt;
        particle.vy += dx * (.012 + particleLevel * .018) * dt;
      }
      if (ellipseRadius < 106) {
        const push = (106 - ellipseRadius) * 2.4;
        particle.vx += (dx / Math.max(1,ellipseRadius)) * push;
        particle.vy += (dy / Math.max(1,ellipseRadius)) * push;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      const progress = particle.age / particle.life;
      const alpha = Math.sin(progress * Math.PI) * (.07 + particleLevel * .2);
      particleContext.globalAlpha = Math.max(.015,alpha);
      particleContext.fillStyle = particle.color;
      particleContext.shadowColor = particle.color;
      particleContext.shadowBlur = 3 + particleLevel * 4;
      particleContext.beginPath();
      particleContext.arc(particle.x,particle.y,particle.size * (1 + progress * .25),0,Math.PI * 2);
      particleContext.fill();
    }
    particleContext.restore();
    requestAnimationFrame(drawLiveParticles);
  }
  sizeParticleCanvas();
  window.addEventListener('resize',sizeParticleCanvas);
  requestAnimationFrame(drawLiveParticles);

  function autoSizeEditor() {
    editor.style.height = '40px';
    const editorHeight = Math.min(104, Math.max(40, editor.scrollHeight));
    editor.style.height = `${editorHeight}px`;
    screen.style.setProperty('--composer-height', `${editorHeight + 18}px`);
    screen.dataset.composerExpanded = String(editorHeight > 42);
  }

  function syncInput() {
    if (editor.value !== draft.text) editor.value = draft.text;
    const hasText = Boolean(draft.text.trim());
    screen.dataset.hasText = String(hasText);
    $('.conversation-send').disabled = !hasText || phase === 'requesting' || busy();
    $('.conversation-empty').hidden = hasText || messages.children.length > 0;
    autoSizeEditor();
  }

  function setPhase(next, message = '') {
    phase = next;
    if (next !== 'listening') particleTarget = 0;
    screen.dataset.phase = next;
    screen.dataset.mode = mode;
    feedback.textContent = isLive() ? '' : message;
    const labels = {
      idle:'Ready when you are', requesting:'Turning on the microphone…',
      listening:liveMuted ? 'Microphone muted' : 'I’m listening',
      paused:'Voice paused', ready:'Ready to continue', error:'Microphone unavailable',
      sending:'Sending…', thinking:'Thinking with you…', speaking:'Linden is responding'
    };
    liveStatus.textContent = labels[next] || 'Ready when you are';
    $('.conversation-mic').setAttribute('aria-pressed', String(mode === 'dictation' && next === 'listening'));
    $('.live-mute').setAttribute('aria-pressed', String(liveMuted));
    $('.live-mute').setAttribute('aria-label', liveMuted ? 'Turn on microphone' : 'Mute microphone');
    syncInput();
  }

  function stopCapture(next = 'idle', message = '') {
    clearFinish();
    voice.stop();
    draft.seal();
    setPhase(next, message);
  }

  function cancelReply() {
    responseGeneration++;
    clearTimeout(responseTimer);
    clearInterval(wordTimer);
    responseTimer = 0;
    wordTimer = 0;
    if (responseUtterance) {
      window.speechSynthesis?.cancel();
      responseUtterance = null;
    }
    messages.querySelector('.is-typing')?.closest('.message-row')?.remove();
  }

  function scrollConversation({force = false} = {}) {
    if (force) followLatest = true;
    if (!followLatest) { jump.hidden = false; return; }
    requestAnimationFrame(() => {
      copy.scrollTop = copy.scrollHeight;
      jump.hidden = true;
    });
  }

  function animateMessageArrival(row, bubble, origin, role) {
    if (reduced.matches || !origin) return;
    row.classList.add('has-shared-motion', `from-${role === 'user' ? 'composer' : 'avatar'}`);
    requestAnimationFrame(() => {
      const target = bubble.getBoundingClientRect();
      const phoneBox = $('.phone').getBoundingClientRect();
      const scaleX = Math.max(.1, phoneBox.width / 338.46154785);
      const scaleY = Math.max(.1, phoneBox.height / 720);
      const sourceX = origin.left + origin.width * (role === 'user' ? .72 : .5);
      const sourceY = origin.top + origin.height * .5;
      const targetX = target.left + target.width * (role === 'user' ? .72 : .22);
      const targetY = target.top + target.height * .5;
      const dx = (sourceX - targetX) / scaleX;
      const dy = (sourceY - targetY) / scaleY;
      const animation = bubble.animate([
        {opacity:.16, transform:`translate3d(${dx}px,${dy}px,0) scale(${role === 'user' ? '.68,.52' : '.16'})`, filter:'blur(5px)', borderRadius:'29px'},
        {opacity:.78, offset:.58, transform:`translate3d(${dx * .16}px,${dy * .12}px,0) scale(.94)`, filter:'blur(.8px)'},
        {opacity:1, transform:'translate3d(0,0,0) scale(1)', filter:'blur(0)', borderRadius:role === 'user' ? '19px 19px 6px 19px' : '19px 19px 19px 6px'}
      ], {duration:role === 'user' ? 620 : 940, easing:'cubic-bezier(.16,1,.3,1)'});
      animation.finished.catch(() => {}).finally(() => row.classList.remove('has-shared-motion', 'from-composer', 'from-avatar'));
    });
  }

  function releaseComposer() {
    if (reduced.matches) return;
    screen.dataset.releasing = 'true';
    setTimeout(() => { delete screen.dataset.releasing; }, 430);
    $('.conversation-bar').animate([
      {transform:'scale(1)'},
      {transform:'scale(.982,.94)', offset:.34},
      {transform:'scale(1.006,1.012)', offset:.7},
      {transform:'scale(1)'}
    ], {duration:470, easing:'cubic-bezier(.22,.8,.24,1)'});
    $('.conversation-send').animate([
      {transform:'scale(1) rotate(0)'},
      {transform:'scale(.78) rotate(-18deg)', offset:.3},
      {transform:'scale(1.08) rotate(5deg)', offset:.72},
      {transform:'scale(1) rotate(0)'}
    ], {duration:520, easing:'cubic-bezier(.16,1,.3,1)'});
  }

  function addMessage(role, text, {typing = false, origin = null, forceScroll = false} = {}) {
    screen.dataset.chat = 'active';
    const row = document.createElement('div');
    row.className = `message-row ${role}`;
    const bubble = document.createElement('div');
    bubble.className = `message-bubble${typing ? ' is-typing' : ''}`;
    if (typing) {
      bubble.setAttribute('aria-label', 'Linden is thinking');
      bubble.innerHTML = '<span class="thought-orb" aria-hidden="true"><i></i></span>';
    } else bubble.textContent = text;
    row.append(bubble);
    messages.append(row);
    scrollConversation({force:forceScroll});
    animateMessageArrival(row, bubble, origin, role);
    return {bubble};
  }

  function replyFor(text) {
    if (/anxious|anxiety|nervous|stress|overwhelm|ansiedad|ansioso|ansiosa|nervios|estr[eé]s|abrum/i.test(text)) return 'I’m here with you. Let’s make a little room around this feeling: soften your shoulders and take one slow breath. What feels heaviest right now?';
    if (/sleep|tired|insomnia|exhaust|dormir|sueño|insomnio|cansad/i.test(text)) return 'It sounds like rest has been harder to find. We can notice what has been shaping your evenings and look for one gentle change. What tends to stay with you when you try to sleep?';
    if (/energy|energía|energia|fatigue|fatiga/i.test(text)) return 'Let’s look at your energy without judging it. When did you feel most like yourself today, and when did things begin to feel heavier?';
    if (/hello|hi|good morning|hey|hola|buen d[ií]a|buenas/i.test(text)) return 'Hi. I’m here with you. We can check in on sleep, energy, stress, or whatever feels important today.';
    if (/thank|gracias/i.test(text)) return 'You’re welcome. This space is here whenever you need to pause, notice, or make sense of how you’ve been feeling.';
    return 'I’m listening. Would you like to explore how this feeling connects with the patterns you’ve been noticing lately?';
  }

  function resumeLiveAfterReply() {
    if (!isLive() || liveMuted || document.hidden) return;
    setTimeout(() => startCapture('live'), 380);
  }

  function speakReply(text, generation) {
    if (!('speechSynthesis' in window)) { setPhase('ready'); resumeLiveAfterReply(); return; }
    const model = voiceModels[voiceModel];
    responseUtterance = new SpeechSynthesisUtterance(text);
    responseUtterance.lang = 'en-US';
    responseUtterance.rate = model.rate;
    responseUtterance.pitch = model.pitch;
    responseUtterance.voice = window.getLindenVoice();
    if (responseUtterance.voice) responseUtterance.lang = responseUtterance.voice.lang;
    responseUtterance.onstart = () => { if (generation === responseGeneration) setPhase('speaking'); };
    responseUtterance.onend = () => {
      if (generation !== responseGeneration) return;
      responseUtterance = null;
      setPhase('ready');
      resumeLiveAfterReply();
    };
    responseUtterance.onerror = responseUtterance.onend;
    window.speechSynthesis.speak(responseUtterance);
  }

  function revealReply(bubble, text, generation) {
    if (generation !== responseGeneration) return;
    bubble.classList.remove('is-typing');
    bubble.classList.add('is-forming');
    bubble.removeAttribute('aria-label');
    bubble.textContent = '';
    if (!reduced.matches) bubble.animate([
      {opacity:.42, transform:'scale(.87)', filter:'blur(1.8px)'},
      {opacity:.9, transform:'scale(.985)', filter:'blur(.35px)', offset:.68},
      {opacity:1, transform:'scale(1)', filter:'blur(0)'}
    ], {duration:880, easing:'cubic-bezier(.16,1,.3,1)'}).finished.catch(() => {}).finally(() => bubble.classList.remove('is-forming'));
    const words = text.split(' ');
    let index = 0;
    const addWords = () => {
      index = Math.min(words.length, index + 2);
      bubble.textContent = words.slice(0, index).join(' ');
      scrollConversation();
      if (index >= words.length) { clearInterval(wordTimer); wordTimer = 0; }
    };
    if (reduced.matches) bubble.textContent = text;
    else { addWords(); wordTimer = setInterval(addWords, 46); }
    speakReply(text, generation);
  }

  function sendMessage({fromLive = false} = {}) {
    draft.seal();
    const outgoing = draft.text.trim();
    if (!outgoing || busy()) return;
    clearFinish();
    const composerOrigin = editor.getBoundingClientRect();
    voice.stop();
    editor.blur();
    releaseComposer();
    addMessage('user', outgoing, {origin:composerOrigin, forceScroll:true});
    draft.edit('');
    syncInput();
    setPhase('sending');
    if (!reduced.matches) navigator.vibrate?.(10);
    const generation = ++responseGeneration;
    responseTimer = setTimeout(() => {
      if (generation !== responseGeneration) return;
      setPhase('thinking');
      const avatarOrigin = $('.conversation-avatar').getBoundingClientRect();
      const {bubble} = addMessage('assistant', '', {typing:true, origin:avatarOrigin});
      responseTimer = setTimeout(() => revealReply(bubble, replyFor(outgoing), generation), 1180);
    }, 420);
  }

  function checkSilence() {
    if (phase !== 'listening' || !draft.text.trim()) return;
    const now = performance.now();
    if (DictationDraft.shouldAutoFinish({hasText:true, sinceText:now-lastText, sinceSound:now-lastSound})) {
      if (mode === 'live') sendMessage({fromLive:true});
      else stopCapture('ready', 'Ready to send. You can edit it or tap the arrow.');
      return;
    }
    finishTimer = setTimeout(checkSilence, 250);
  }

  const voice = new LindenVoice({
    onState(next, message) {
      if (next === 'requesting') setPhase('requesting', 'Allow microphone access to begin.');
      else if (next === 'listening') { lastSound = performance.now(); setPhase('listening'); }
      else if (next === 'error') {
        clearFinish(); draft.seal(); setPhase('error', message);
        $('.conversation-open-tab').hidden = !/browser tab|embedded/.test(message);
      } else if (next === 'idle' && (phase === 'listening' || phase === 'requesting')) {
        clearFinish(); draft.seal();
        setPhase('paused', mode === 'live' ? 'Voice paused.' : 'Dictation paused. Your text is safe.');
      }
    },
    onLevel(level) {
      const amount = reduced.matches ? 0 : Math.max(0, Math.min(1, level));
      particleTarget = amount;
      screen.style.setProperty('--speech-level', amount.toFixed(3));
      screen.style.setProperty('--voice-shadow', `${(18 + amount * 30).toFixed(1)}px`);
      screen.style.setProperty('--glow-scale', (1 + amount * .2).toFixed(3));
      screen.style.setProperty('--bar-small', `${(3 + amount * 9).toFixed(1)}px`);
      screen.style.setProperty('--bar-medium', `${(5 + amount * 13).toFixed(1)}px`);
      screen.style.setProperty('--bar-large', `${(7 + amount * 15).toFixed(1)}px`);
      screen.style.setProperty('--light-opacity', (.58 + amount * .42).toFixed(3));
      screen.style.setProperty('--light-rise-a', `${(-210 * amount).toFixed(1)}px`);
      screen.style.setProperty('--light-rise-a-end', `${(-170 * amount).toFixed(1)}px`);
      screen.style.setProperty('--light-shift-a', `${(35 * amount).toFixed(1)}px`);
      screen.style.setProperty('--light-rise-b', `${(-150 * amount).toFixed(1)}px`);
      screen.style.setProperty('--light-rise-b-end', `${(-120 * amount).toFixed(1)}px`);
      screen.style.setProperty('--light-shift-b', `${(24 * amount).toFixed(1)}px`);
      screen.style.setProperty('--light-rise-c', `${(-170 * amount).toFixed(1)}px`);
      screen.style.setProperty('--light-rise-c-end', `${(-145 * amount).toFixed(1)}px`);
      screen.style.setProperty('--light-shift-c', `${(-25 * amount).toFixed(1)}px`);
      const now = performance.now();
      if (amount > .42 && now - lastHaptic > 700) { navigator.vibrate?.(6); lastHaptic = now; }
      if (level > .12) lastSound = now;
    },
    onText(text, final, meta) {
      if (!text.trim() || screen.hidden || liveMuted || mode === 'compose') return;
      draft.update(text, final, meta?.key || 'current');
      lastText = performance.now();
      syncInput();
      clearFinish();
      finishTimer = setTimeout(checkSilence, 250);
      if (draft.text.length >= 4000) stopCapture('ready', 'You reached the message limit. Review it before sending.');
    },
    onSpeechStatus(message) {
      if (phase !== 'listening' || !message) return;
      if (!isLive()) feedback.textContent = message;
    }
  });

  async function startCapture(nextMode) {
    if (busy()) return;
    mode = nextMode;
    liveMuted = false;
    screen.dataset.liveMuted = 'false';
    $('.conversation-open-tab').hidden = true;
    cancelReply();
    draft.seal();
    clearFinish();
    await voice.start();
  }

  function enterLive() {
    closeVoicePicker({restoreFocus:false});
    location.hash = 'conversation';
    renderScreen();
    screen.dataset.live = 'true';
    livePanel.setAttribute('aria-hidden', 'false');
    scheduleLiveTurn();
    startCapture('live');
  }

  function exitLive({keepDraft = true} = {}) {
    clearLiveTurn();
    stopCapture('idle');
    mode = 'compose';
    liveMuted = false;
    screen.dataset.live = 'false';
    screen.dataset.liveMuted = 'false';
    livePanel.setAttribute('aria-hidden', 'true');
    if (!keepDraft) draft.edit('');
    syncInput();
    if (keepDraft && draft.text.trim()) editor.focus();
  }

  $('.voice-toggle').addEventListener('click', () => {
    location.hash = 'conversation'; renderScreen(); setPhase('idle');
    requestAnimationFrame(() => editor.focus());
  });
  $('.live-voice-button').addEventListener('click', enterLive);
  $('.conversation-live').addEventListener('click', enterLive);
  $('.conversation-mic').addEventListener('click', () => {
    if (mode === 'dictation' && (phase === 'listening' || phase === 'requesting')) {
      stopCapture('ready', 'Ready to send. You can edit it or tap the arrow.'); return;
    }
    startCapture('dictation');
  });
  $('.conversation-send').addEventListener('click', () => sendMessage());
  jump.addEventListener('click', () => scrollConversation({force:true}));
  $('.voice-model-button').addEventListener('click', openVoicePicker);
  document.querySelectorAll('.voice-option').forEach(option => option.addEventListener('click', () => {
    stopVoicePreview();
    pendingVoiceModel = Number(option.dataset.voice);
    renderVoicePickerSelection();
    navigator.vibrate?.(4);
  }));
  $('.voice-preview-button').addEventListener('click', previewSelectedVoice);
  $('.voice-use-button').addEventListener('click', () => {
    const selected = voiceModels[pendingVoiceModel];
    stopVoicePreview();
    voiceModel = pendingVoiceModel;
    window.lindenVoiceModel = selected;
    $('.voice-model-name').textContent = selected.name;
    navigator.vibrate?.(8);
    closeVoicePicker();
  });
  $('.voice-picker-close').addEventListener('click', () => closeVoicePicker());
  $('.voice-picker-backdrop').addEventListener('click', () => closeVoicePicker());
  $('.live-mute').addEventListener('click', () => {
    if (liveMuted) {
      liveMuted = false; screen.dataset.liveMuted = 'false'; startCapture('live');
    } else {
      liveMuted = true; screen.dataset.liveMuted = 'true'; stopCapture('paused');
      liveStatus.textContent = 'Microphone muted';
    }
  });
  $('.live-cancel').addEventListener('click', () => exitLive({keepDraft:false}));
  $('.live-end').addEventListener('click', () => exitLive({keepDraft:true}));
  $('.conversation-back').addEventListener('click', () => {
    cancelReply();
    if (isLive()) exitLive({keepDraft:true}); else stopCapture('idle');
    location.hash = 'home';
  });
  editor.addEventListener('input', () => { draft.edit(editor.value); mode = 'compose'; syncInput(); });
  editor.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }
  });
  copy.addEventListener('scroll', () => {
    const atBottom = copy.scrollHeight - copy.scrollTop - copy.clientHeight < 44;
    if (atBottom) { followLatest = true; jump.hidden = true; }
    else followLatest = false;
  }, {passive:true});
  window.addEventListener('hashchange', () => {
    if (location.hash !== '#conversation') {
      closeVoicePicker({restoreFocus:false});
      cancelReply();
      if (isLive()) exitLive({keepDraft:true}); else stopCapture('idle');
      editor.blur(); return;
    }
    if (!reduced.matches) screen.animate(
      [{opacity:0, transform:'translateY(36px)'}, {opacity:1, transform:'translateY(0)'}],
      {duration:520, easing:'cubic-bezier(.16,1,.3,1)'}
    );
    setPhase('idle');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && location.hash === '#conversation' && (phase === 'listening' || phase === 'requesting')) stopCapture('paused', 'The microphone paused while you were away.');
  });
  window.addEventListener('pagehide', () => { closeVoicePicker({restoreFocus:false}); clearLiveTurn(); cancelReply(); clearFinish(); voice.stop(); });
  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || location.hash !== '#conversation') return;
    if (!voicePicker.hidden) { closeVoicePicker(); return; }
    if (isLive()) exitLive({keepDraft:true});
    else { cancelReply(); stopCapture('idle'); location.hash = 'home'; }
  });
  screen.dataset.live = 'false';
  screen.dataset.liveMuted = 'false';
  syncInput();
  setPhase('idle');
})();
