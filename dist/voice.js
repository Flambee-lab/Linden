/* Microphone lifetime is independent of the optional browser speech service. */
(function(root){
class LindenVoice {
  constructor({onState=()=>{},onLevel=()=>{},onText=()=>{},onSpeechStatus=()=>{},env=root}={}) {
    Object.assign(this,{onState,onLevel,onText,onSpeechStatus,env});
    this.generation=0;this.state='idle';this.stream=null;this.context=null;this.recognition=null;this.timers=new Set();
  }
  later(fn,ms){const id=this.env.setTimeout(()=>{this.timers.delete(id);fn();},ms);this.timers.add(id);return id;}
  setState(state,message){this.state=state;this.onState(state,message);}
  stop(message='Tap to speak'){
    ++this.generation;
    this.timers.forEach(id=>this.env.clearTimeout(id));this.timers.clear();
    this.env.cancelAnimationFrame(this.frame);
    this.detachRecognition();
    this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;
    const context=this.context;this.context=null;if(context)context.close().catch(()=>{});
    this.onLevel(0);this.setState('idle',message);
  }
  detachRecognition(){
    const r=this.recognition;this.recognition=null;
    if(r){r.onresult=r.onerror=r.onend=null;try{r.abort();}catch{}}
  }
  pauseTranscription(){this.transcriptionPaused=true;this.detachRecognition();}
  async start(){
    this.stop();this.transcriptionPaused=false;const token=this.generation;
    const E=this.env;
    this.onText('',false);this.onSpeechStatus('');
    this.setState('requesting','Allow microphone access');
    let resume;
    try{
      if(E.isSecureContext===false)throw Object.assign(new Error(),{name:'InsecureContext'});
      const policy=E.document?.permissionsPolicy||E.document?.featurePolicy;
      if(policy?.allowsFeature && !policy.allowsFeature('microphone'))throw Object.assign(new Error(),{name:'FramePolicy'});
      if(!E.navigator.mediaDevices?.getUserMedia)throw Object.assign(new Error(),{name:'Unsupported'});
      const Audio=E.AudioContext||E.webkitAudioContext;
      // Start/resume synchronously in the tap's activation, before awaiting permission.
      if(Audio){this.context=new Audio();resume=this.context.resume().catch(()=>{});}
      const incoming=await E.navigator.mediaDevices.getUserMedia({audio:true});
      if(token!==this.generation){incoming.getTracks().forEach(t=>t.stop());return;}
      this.stream=incoming;
      const tracks=incoming.getAudioTracks();
      if(!tracks.length||tracks[0].readyState==='ended')throw Object.assign(new Error(),{name:'NotReadableError'});
      tracks.forEach(track=>{
        track.addEventListener('ended',()=>{if(token===this.generation)this.fail('Microphone disconnected. Reconnect it and try again.');});
        track.addEventListener('mute',()=>{if(token===this.generation)this.onSpeechStatus('Microphone paused by your device. Check its mute switch.');});
        track.addEventListener('unmute',()=>{if(token===this.generation)this.onSpeechStatus('');});
      });
      this.setState('listening','Microphone on');
      if(this.context){
        const context=this.context;
        // A blocked AudioContext must not block microphone capture or speech recognition.
        const source=context.createMediaStreamSource(incoming),analyser=context.createAnalyser();
        analyser.fftSize=1024;source.connect(analyser);
        const samples=new Uint8Array(analyser.fftSize);let level=0,lastVoice=E.performance.now(),hint=false;
        const tick=()=>{
          if(token!==this.generation)return;
          analyser.getByteTimeDomainData(samples);let sum=0;
          for(const value of samples)sum+=((value-128)/128)**2;
          const rms=Math.sqrt(sum/samples.length),target=Math.min(1,Math.max(0,(rms-.003)*11));
          level+=(target-level)*(target>level?.32:.07);this.onLevel(level);
          if(rms>.008){lastVoice=E.performance.now();if(hint){hint=false;this.onSpeechStatus('');}}
          if(!hint&&E.performance.now()-lastVoice>6500){hint=true;this.onSpeechStatus(context.state==='suspended'?'Tap “Resume audio” to enable the voice effect.':'No sound detected yet. Check your selected microphone or try the mic test.');}
          this.frame=E.requestAnimationFrame(tick);
        };tick();
        void resume;
      }else this.onSpeechStatus('Microphone is on. Live volume effects are unavailable in this browser.');
      this.startRecognition(token);
      this.later(()=>{if(token===this.generation)this.stop('Microphone off after 2 minutes · tap to continue');},120000);
    }catch(error){if(token===this.generation)this.fail(this.errorMessage(error));}
  }
  fail(message){this.stop();this.setState('error',message);}
  errorMessage(error){
    const messages={
      NotAllowedError:'Microphone permission is blocked. Allow it in this site’s browser settings, then tap Retry.',
      PermissionDeniedError:'Allow microphone access in your browser settings, then tap Retry.',
      NotFoundError:'No microphone found. Connect one, then tap Retry.',
      NotReadableError:'The microphone could not start. Check your device or close another app using it, then retry.',
      FramePolicy:'This embedded view blocks the microphone. Open Linden in a browser tab to speak.',
      InsecureContext:'Open the secure Linden link in a browser tab to use the microphone.',
      Unsupported:'This browser cannot access the microphone. Open Linden in a current browser or type a message.'
    };return messages[error.name]||'The microphone could not start. Check browser permissions and try again.';
  }
  startRecognition(token){
    const Recognition=this.env.SpeechRecognition||this.env.webkitSpeechRecognition;
    if(!Recognition){this.onSpeechStatus('Voice effects are live. This browser does not support transcription; you can type instead.');return;}
    let restarts=0;
    const launch=()=>{
      if(token!==this.generation||this.state!=='listening'||this.transcriptionPaused)return;
      const run=restarts;
      const r=new Recognition();this.recognition=r;r.lang='es-AR';r.interimResults=true;r.continuous=true;
      let fatal=false;
      r.onresult=event=>{
        if(token!==this.generation)return;
        for(let i=event.resultIndex||0;i<event.results.length;i++)this.onText(event.results[i][0].transcript,event.results[i].isFinal,{key:`${token}:${run}:${i}`});
      };
      r.onerror=event=>{
        if(token!==this.generation)return;
        // Keep the captured stream and volume analyser alive when speech service fails.
        if(event.error==='no-speech'||event.error==='aborted')return;
        fatal=true;
        this.onSpeechStatus(event.error==='not-allowed'||event.error==='service-not-allowed'?'Microphone is on. Browser transcription is blocked; you can still test your voice or type.':'Microphone is on. Transcription is unavailable; the voice effect still responds to you.');
      };
      r.onend=()=>{if(token===this.generation&&!fatal&&restarts++<3)this.later(launch,400);};
      try{r.start();}catch{fatal=true;this.onSpeechStatus('Microphone is on. Transcription could not start; you can type instead.');}
    };launch();
  }
}
if(typeof module!=='undefined'&&module.exports)module.exports=LindenVoice;else root.LindenVoice=LindenVoice;
})(globalThis);
