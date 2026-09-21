const test=require('node:test');const assert=require('node:assert/strict');const Voice=require('../dist/voice.js');
function fixture({speech=true,denied=false,policy=true,suspended=false}={}){
  let resolve,reject,stops=0,closes=0,frames=0;const messages=[],states=[],texts=[],levels=[],timers=new Map(),trackEvents={};
  const track={readyState:'live',stop(){stops++},addEventListener(n,fn){trackEvents[n]=fn}};
  const stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
  class Recognition{start(){}abort(){}}
  const env={isSecureContext:true,top:null,document:{permissionsPolicy:{allowsFeature:()=>policy}},navigator:{mediaDevices:{getUserMedia:()=>denied?Promise.reject(Object.assign(new Error(),{name:'NotAllowedError'})):new Promise((a,b)=>{resolve=a;reject=b})}},
    AudioContext:class{state=suspended?'suspended':'running';resume(){return suspended?new Promise(()=>{}):Promise.resolve()}close(){closes++;return Promise.resolve()}createMediaStreamSource(){return{connect(){}}}createAnalyser(){return{fftSize:1024,getByteTimeDomainData(a){a.fill(140)}}}},
    performance:{now:()=>0},requestAnimationFrame(){return ++frames},cancelAnimationFrame(){},setTimeout(fn){const id=timers.size+1;timers.set(id,fn);return id},clearTimeout(id){timers.delete(id)}
  };if(speech)env.SpeechRecognition=Recognition;
  const voice=new Voice({env,onState:(s,m)=>states.push([s,m]),onSpeechStatus:m=>messages.push(m),onText:(t,f)=>texts.push([t,f]),onLevel:l=>levels.push(l)});
  return {voice,stream,resolve:()=>resolve(stream),reject,states,messages,texts,levels,timers,trackEvents,stats:()=>({stops,closes,frames})};
}
test('late microphone permission after cancel closes tracks',async()=>{const f=fixture();const p=f.voice.start();f.voice.stop();f.resolve();await p;assert.equal(f.stats().stops,1);assert.equal(f.voice.state,'idle')});
test('speech network failure does not stop microphone or analyser',async()=>{const f=fixture();const p=f.voice.start();f.resolve();await p;f.voice.recognition.onerror({error:'network'});f.voice.recognition.onend();assert.equal(f.voice.state,'listening');assert.equal(f.stats().stops,0);assert.ok(f.levels.some(l=>l>0));assert.match(f.messages.at(-1),/Transcription is unavailable/);f.voice.stop();assert.equal(f.stats().stops,1)});
test('no-speech keeps microphone live and restart timers cancel on stop',async()=>{const f=fixture();const p=f.voice.start();f.resolve();await p;f.voice.recognition.onerror({error:'no-speech'});f.voice.recognition.onend();assert.equal(f.voice.state,'listening');assert.ok(f.timers.size>0);f.voice.stop();assert.equal(f.timers.size,0)});
test('speech service permission failure retains granted microphone',async()=>{const f=fixture();const p=f.voice.start();f.resolve();await p;f.voice.recognition.onerror({error:'not-allowed'});assert.equal(f.voice.state,'listening');assert.match(f.messages.at(-1),/transcription is blocked/)});
test('denied microphone shows actionable error and releases AudioContext',async()=>{const f=fixture({denied:true});await f.voice.start();assert.equal(f.voice.state,'error');assert.match(f.states.at(-1)[1],/browser settings/);assert.equal(f.stats().closes,1)});
test('iframe policy is detected before microphone request',async()=>{const f=fixture({policy:false});f.voice.env.top={};await f.voice.start();assert.equal(f.voice.state,'error');assert.match(f.states.at(-1)[1],/browser tab/)});
test('top-level pages still request the microphone when policy reports false',async()=>{const f=fixture({policy:false});const p=f.voice.start();f.resolve();await p;assert.equal(f.voice.state,'listening')});
test('missing speech API still captures and visualizes microphone',async()=>{const f=fixture({speech:false});const p=f.voice.start();f.resolve();await p;assert.equal(f.voice.state,'listening');assert.match(f.messages.at(-1),/does not support transcription/);assert.ok(f.levels.some(l=>l>0))});
test('suspended audio context does not hang microphone or transcription',async()=>{const f=fixture({suspended:true});const p=f.voice.start();f.resolve();await p;assert.equal(f.voice.state,'listening');assert.ok(f.voice.recognition)});
test('disconnected track stops capture and reports error',async()=>{const f=fixture();const p=f.voice.start();f.resolve();await p;f.trackEvents.ended();assert.equal(f.voice.state,'error');assert.match(f.states.at(-1)[1],/disconnected/);assert.equal(f.stats().stops,1)});
test('final transcripts do not end microphone session',async()=>{const f=fixture();const p=f.voice.start();f.resolve();await p;const result=[{transcript:'hola Linden'}];result.isFinal=true;f.voice.recognition.onresult({resultIndex:0,results:[result]});assert.deepEqual(f.texts.at(-1),['hola Linden',true]);assert.equal(f.voice.state,'listening')});
