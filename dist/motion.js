(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const phone = $('.phone'), avatar = $('.avatar-open'), caption = $('.voice-status'), transcript = $('.voice-transcript');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let state = 'idle', session = 0, timer, utterance, audioPlaying = false;
  let recorder, recordingTimer, playbackURL, soundContext, soundEnabled=true;
  const soundNodes=new Set(), entranceAnimations=new Set();
  const animate = (el, frames, options = {}) => {
    if (!el || reduced.matches) return;
    return el.animate(frames, {duration:600, easing:'cubic-bezier(.22,.8,.24,1)', ...options});
  };
  const toast = message => {
    $('.toast')?.remove();
    const el = document.createElement('div'); el.className='toast'; el.role='status'; el.textContent=message; phone.append(el);
    setTimeout(() => el.remove(), 4600);
  };
  const setState = (next, label) => {
    state=next; phone.dataset.voice=next; caption.textContent=label;
    const active = ['listening','requesting','thinking','speaking'].includes(next);
    $('.stop-voice').hidden=!active;
    $('.stop-voice').textContent=next==='speaking'?'Interrupt':'Stop listening';
    $('.voice-toggle').textContent='Ask Linden';
    $('.voice-toggle').setAttribute('aria-pressed','false');
    avatar.setAttribute('aria-label',active?'Stop or interrupt Linden':'Talk to Linden');
    avatar.setAttribute('aria-pressed',String(active));
  };
  const panel=$('.voice-panel');
  const voice=new LindenVoice({
    onState(next,message){
      setState(next,message);
      $('.mic-status').textContent=next==='listening'?'Microphone on':next==='requesting'?'Waiting for permission':next==='error'?'Microphone unavailable':'Microphone off';
      if(next==='error'||next==='requesting'){$('.mic-message').textContent=message;panel.hidden=false;}
      $('.mic-retry').hidden=next==='listening'||next==='requesting';
      $('.mic-test').hidden=next!=='listening';
      $('.mic-open-tab').hidden=next!=='error';
      if(next==='idle')$('.mic-message').textContent=message;
      if(next==='listening')$('.mic-message').textContent='Speak naturally. The light follows your voice.';
    },
    onLevel(level){
      phone.style.setProperty('--voice-level',level.toFixed(3));
      
      $('.mic-meter').setAttribute('aria-valuenow',String(Math.round(level*100)));
      $('.mic-meter span').style.transform=`scaleX(${level})`;
      if(!reduced.matches){avatar.style.scale=String(1+level*.13);$('.avatar-shadow').style.scale=String(1-level*.1);}
    },
    onText(text,final){
      transcript.textContent=text;$('.mic-transcript').textContent=text;
      if(final&&text.trim())handleMessage(text,true);
    },
    onSpeechStatus(message){
      $('.mic-message').textContent=message||'Speak naturally. The light follows your voice.';
      $('.mic-resume').hidden=voice.context?.state!=='suspended';
    }
  });
  function clearRecording(){
    clearTimeout(recordingTimer);
    if(recorder&&recorder.state!=='inactive'){recorder.onstop=null;recorder.stop();}
    recorder=null;$('.mic-test').disabled=false;$('.mic-test').textContent='Test mic · 3s';
    $('.mic-playback').pause();
  }
  function stop(label='Ready when you are') {
    session++;clearTimeout(timer);clearRecording();voice.stop(label);
    window.speechSynthesis?.cancel();utterance=null;
    avatar.style.scale='';$('.avatar-shadow').style.scale='';
    audioPlaying=false;$('.waveform').classList.remove('playing');
    $('.audio-play').setAttribute('aria-label','Play audio');
    setState('idle',label);
  }
  function unlockSound(){
    if(!soundEnabled)return;
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)return;
    try{soundContext??=new Audio();void soundContext.resume().catch(()=>{});}catch{}
  }
  function cancelSounds(){soundNodes.forEach(n=>{try{n.stop();}catch{}});soundNodes.clear();}
  function cardSound(index,delay){
    if(!soundEnabled||!soundContext||soundContext.state!=='running'||state==='listening')return;
    const now=soundContext.currentTime+delay,osc=soundContext.createOscillator(),gain=soundContext.createGain();
    osc.type='sine';osc.frequency.setValueAtTime(540+index*90,now);osc.frequency.exponentialRampToValueAtTime(360+index*65,now+.09);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.025,now+.009);gain.gain.exponentialRampToValueAtTime(.0001,now+.13);
    osc.connect(gain);gain.connect(soundContext.destination);osc.start(now);osc.stop(now+.15);soundNodes.add(osc);
    osc.onended=()=>{soundNodes.delete(osc);osc.disconnect();gain.disconnect();};
  }
  function speak(text, label='Demo voice') {
    stop(); const token=session;
    transcript.textContent=text;
    if(!window.speechSynthesis){setState('idle','Voice unavailable · read below');return;}
    utterance=new SpeechSynthesisUtterance(text); utterance.lang='en-US'; utterance.rate=1.03; utterance.pitch=1.08;
    utterance.voice=window.getLindenVoice?.()||null;
    if(utterance.voice)utterance.lang=utterance.voice.lang;
    utterance.onstart=()=>{if(token===session)setState('speaking',label);};
    utterance.onboundary=()=>{if(token===session)animate(avatar,[{scale:1},{scale:1.055},{scale:1}],{duration:260});};
    utterance.onend=()=>{if(token===session){setState('idle','Your turn · tap to speak');$('.waveform').classList.remove('playing');audioPlaying=false;}};
    utterance.onerror=()=>{if(token===session){setState('idle','Voice unavailable · read below');$('.waveform').classList.remove('playing');audioPlaying=false;}};
    speechSynthesis.speak(utterance);
  }
  function handleMessage(text,fromMic=false) {
    if(!fromMic)stop(); transcript.textContent=text;
    // Voice commands are deliberately local; no generated AI reply is fabricated.
    if(/\b(home|inicio|tarjetas|cards)\b/i.test(text)){location.hash='home';toast('Home opened');return;}
    if(/\b(perfil|profile|preferencias|preferences)\b/i.test(text)){location.hash='onboarding';return;}
    if(/\b(demo|demostración)\b/i.test(text)){demo();return;}
    if(!fromMic)setState('idle','Message received');
    $('.mic-message').textContent='Message transcribed. Continue in the Linden conversation to explore it together.';
    if(!fromMic)toast('Your check-in is ready');
  }
  async function listen() {
    if(state==='requesting'||state==='listening'){stop();panel.hidden=true;return;}
    stop();cancelSounds();panel.hidden=false;
    $('.mic-playback').hidden=true;$('.mic-transcript').textContent='';
    animate(avatar,[{transform:'scale(1)'},{transform:'scale(1.06,.94)'},{transform:'scale(1)'}],{duration:480});
    await voice.start();
  }
  $('.mic-retry').addEventListener('click',listen);
  $('.voice-panel-close').addEventListener('click',()=>{stop();panel.hidden=true;});
  $('.mic-type').addEventListener('click',()=>{stop();panel.hidden=true;$('.composer').showModal();});
  $('.mic-resume').addEventListener('click',async()=>{try{await voice.context?.resume();$('.mic-resume').hidden=voice.context?.state!=='suspended';}catch{}});
  $('.mic-test').addEventListener('click',()=>{
    if(!voice.stream)return;
    if(!window.MediaRecorder){$('.mic-message').textContent='Recording is unavailable. Use the live volume meter to check your microphone.';return;}
    clearRecording();voice.pauseTranscription();const chunks=[];const token=session;
    try{
      recorder=new MediaRecorder(voice.stream);const current=recorder;
      current.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      current.onerror=()=>{clearRecording();$('.mic-message').textContent='The microphone test could not record. Try again.';};
      current.onstop=()=>{
        if(token!==session)return;
        const type=current.mimeType||chunks[0]?.type||'audio/webm';
        stop('Mic test ready');panel.hidden=false;
        if(playbackURL)URL.revokeObjectURL(playbackURL);
        playbackURL=URL.createObjectURL(new Blob(chunks,{type}));
        $('.mic-playback').src=playbackURL;$('.mic-playback').hidden=false;
        $('.mic-message').textContent='Play your 3-second mic test. It stays in this tab and is not uploaded.';
      };
      current.start();$('.mic-test').disabled=true;$('.mic-test').textContent='Recording…';
      $('.mic-message').textContent='Say a few words. Recording 3 seconds…';
      recordingTimer=setTimeout(()=>{if(current.state==='recording')current.stop();},3000);
    }catch{$('.mic-message').textContent='Recording could not start. Use the volume meter or retry.';}
  });
  $('.sound-toggle').addEventListener('click',()=>{
    soundEnabled=!soundEnabled;$('.sound-toggle').setAttribute('aria-pressed',String(soundEnabled));
    $('.sound-toggle').setAttribute('aria-label',soundEnabled?'Mute interface sounds':'Enable interface sounds');
    $('.sound-toggle').textContent=soundEnabled?'♪':'♪̸';
    if(soundEnabled)unlockSound();else cancelSounds();
  });
  document.addEventListener('pointerdown',unlockSound,{passive:true});
  document.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')unlockSound();});
  function demo(){
    stop(); setState('thinking','Preparing a quiet check-in'); transcript.textContent='A short moment to pause and notice how you feel.';
    const token=session;
    timer=setTimeout(()=>{if(token===session)speak('I’m here with you. Take one slow breath, and notice what feels most present today. You can begin wherever it feels natural.','Linden is with you');},850);
  }
  avatar.addEventListener('click',listen);
  // Home voice entry is owned by the full-screen conversation flow.
  $('.stop-voice').addEventListener('click',()=>{stop();panel.hidden=true;});
  $('.demo-button').addEventListener('click',demo);
  $('.home-button').addEventListener('click',()=>{location.hash='home';});
  $('.type-button').addEventListener('click',()=>{stop();panel.hidden=true;});
  $('.keyboard-button').addEventListener('click',()=>{stop();panel.hidden=true;});
  $('.composer form').addEventListener('submit',event=>{
    if(event.submitter?.value==='cancel')return;
    const input=$('.composer textarea'), text=input.value.trim();
    if(!text){event.preventDefault();input.focus();return;}
    input.value=''; handleMessage(text);
  });
  // Subtle pointer curiosity; idle motion lives on the inner original SVG.
  avatar.addEventListener('pointermove',event=>{
    if(reduced.matches||state!=='idle')return;
    const r=avatar.getBoundingClientRect(), x=(event.clientX-r.left)/r.width-.5,y=(event.clientY-r.top)/r.height-.5;
    avatar.style.transform=`translate(${x*9}px,${y*7}px) rotate(${x*7}deg)`;
  });
  avatar.addEventListener('pointerleave',()=>{avatar.style.transform='';});
  avatar.style.transition='transform .35s cubic-bezier(.22,.8,.24,1)';
  document.querySelectorAll('button').forEach(button=>button.addEventListener('pointerdown',event=>{
    if(reduced.matches)return;
    const r=phone.getBoundingClientRect(), scaleX=r.width/338.46154785, scaleY=r.height/720;
    const dot=document.createElement('i');dot.className='motion-ripple';dot.style.left=`${(event.clientX-r.left)/scaleX}px`;dot.style.top=`${(event.clientY-r.top)/scaleY}px`;
    phone.append(dot);dot.addEventListener('animationend',()=>dot.remove(),{once:true});
  }));
  const specs=[
    ['.first-card,.card-art,.see-arrow,.see-more,.card-more',[2,3,4,5],360],
    ['.audio-card,.audio-photo,.audio-play,.waveform,.captions-button',[6,7],510],
    ['.video-card,.video-photo,.video-play,.link-button',[8,9],650]
  ];
  const feedScreen=$('.feed-screen'),feedScroll=$('.feed-scroll'),feedContent=$('.feed-content'),feedTextLayer=$('.feed-text-layer');
  const cardGroups=specs.map(([selector,texts,y])=>{
    const group=document.createElement('div');group.className='card-motion-group';group.style.transformOrigin=`169px ${y}px`;
    document.querySelectorAll(selector).forEach(el=>group.append(el));
    texts.forEach(i=>{const text=$(`.feed-text-layer img[src^="assets/feed-text-${i}.svg"]`);if(text)group.append(text);});
    feedContent.insertBefore(group,feedTextLayer);return group;
  });
  const updateFeedHeader=()=>feedScreen.classList.toggle('is-scrolled',feedScroll.scrollTop>12);
  feedScroll.addEventListener('scroll',updateFeedHeader,{passive:true});
  let lastHash=location.hash;
  // Existing routing remains the single source of screen visibility.
  const animateRoute=()=>{
    stop();panel.hidden=true;transcript.textContent='';cancelSounds();entranceAnimations.forEach(a=>a.cancel());entranceAnimations.clear();
    const hash=location.hash;
    if(hash!=='#home'){$('.orb-flight')?.remove();$('.feed-avatar-button')?.classList.remove('is-arriving');}
    if(hash==='#onboarding')animate($('.onboarding-screen'),[{opacity:0,transform:'scale(.985)',filter:'blur(5px)'},{opacity:1,transform:'scale(1)',filter:'blur(0)'}],{duration:520,easing:'cubic-bezier(.16,1,.3,1)'});
    else if(hash==='#home'){
      feedScroll.scrollTop=0;updateFeedHeader();
      const fromLogin=lastHash==='#welcome'||lastHash==='';
      const orb=$('.feed-avatar-button');
      if(fromLogin&&!reduced.matches){
        const flight=$('.orb-flight');
        if(flight)orb.classList.add('is-arriving');
        const travel=[
          {offset:0,transform:'translate(122.8px, 238px) scale(1.42)'},
          {offset:.38,transform:'translate(64px, 72px) scale(1.2)'},
          {offset:.72,transform:'translate(8px, 6px) scale(1.06)'},
          {offset:.86,transform:'translate(0px, -4px) scale(1.04)'},
          {offset:1,transform:'translate(0, 0) scale(1)'}
        ];
        const mover=flight||orb;
        const flightAnimation=mover.animate(travel,{duration:680,easing:'linear',fill:'both'});
        const finishFlight=()=>{flight?.remove();orb.classList.remove('is-arriving');};
        flightAnimation.finished.then(finishFlight).catch(finishFlight);
      } else {
        $('.orb-flight')?.remove();
        orb.classList.remove('is-arriving');
      }
      const cardBase=fromLogin&&!reduced.matches?500:105;
      cardGroups.forEach((group,index)=>{
        const delay=cardBase+index*112;
        const animation=animate(group,[{opacity:0,transform:'translateY(28px) scale(.972)',filter:'blur(5px)'},{opacity:1,transform:'translateY(-1.2px) scale(1.005)',filter:'blur(0)'},{opacity:1,transform:'translateY(0) scale(1)',filter:'blur(0)'}],{duration:540,delay,fill:'backwards',easing:'cubic-bezier(.22,1,.36,1)'});
        if(animation){entranceAnimations.add(animation);animation.finished.then(()=>entranceAnimations.delete(animation)).catch(()=>{});}
        cardSound(index,(delay+28)/1000);
      });
      const barDelay=fromLogin&&!reduced.matches?560:220;
      animate($('.listening-bar'),[{opacity:0,transform:'translateY(40px) scale(.94)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:650,delay:barDelay,fill:'backwards',easing:'cubic-bezier(.16,1,.3,1)'});
    } else if(hash==='#assistant'){
      animate(avatar,[{transform:lastHash==='#home'?'translate(-110px,-170px) scale(.45)':'scale(.45) rotate(-25deg)',opacity:.3},{transform:'scale(1.07,.95) rotate(4deg)',opacity:1},{transform:'scale(1) rotate(0deg)',opacity:1}],{duration:850});
      animate($('.assistant-wordmark'),[{opacity:0,translate:'0 10px'},{opacity:1,translate:'0 0'}],{delay:250,fill:'backwards'});
    }
    lastHash=hash;
  };
  window.addEventListener('hashchange',animateRoute);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();cancelSounds();}});
  window.addEventListener('pagehide',()=>{stop();cancelSounds();if(playbackURL)URL.revokeObjectURL(playbackURL);});
  window.addEventListener('keydown',event=>{if(event.key==='Escape')stop();});
  $('.waveform').querySelectorAll('span').forEach((bar,i)=>bar.style.setProperty('--i',i));
  // Make the original audio control a real, clearly identified spoken preview.
  $('.audio-play').addEventListener('click',()=>{
    if(notice.open)notice.close();
    if(audioPlaying){stop();return;}
    speak('Take a slow breath. Let your shoulders soften. This is your quiet space to pause, notice, and return to yourself.','Guided pause');
    audioPlaying=true;$('.waveform').classList.add('playing');$('.audio-play').setAttribute('aria-label','Stop audio sample');
    toast('Guided pause · Linden voice');
  });
  setState('idle','Ready when you are');
  animateRoute();
})();
