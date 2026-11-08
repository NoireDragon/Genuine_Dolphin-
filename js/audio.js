(function(){
  'use strict';

  /*
   * Motore audio semplificato e compatibile con apertura locale (file://).
   * Le musiche vengono riprodotte direttamente con HTMLAudioElement: non sono
   * collegate a MediaElementAudioSourceNode, che su origini locali/opaque può
   * produrre silenzio. Web Audio resta riservato ai suoni sintetici generati dal JS.
   */
  const ROOT='assets/audio/';
  const GAME_TITLE_REMOTE='https://www.myinstants.com/media/sounds/sonic-exe-nb-laugh.mp3';
  const VERSION='pl-audio-direct-20261108';
  const assetUrl=path=>/^https?:/i.test(path)?path:`${path}?v=${VERSION}`;
  const CHOICE_THEMES={
    politica:ROOT+'politics.mp3',
    servizio:ROOT+'service.mp3',
    fede:ROOT+'faith.mp3'
  };

  let ctx=null,master=null,noiseSource=null,noiseGain=null,humOsc=null,humGain=null;
  let contextResumePromise=null,muted=false,bedLevel=.012;
  let persistentTrack=null,initialTrack=null,afterJumpTrack=null,choiceTrack=null,endingTrack=null,game3LoreTrack=null;
  let endingFadeTimer=null;
  const activeAudio=new Set();
  const pendingGestureAudio=new Set();
  let clickIndex=0,typingIndex=0;

  function clamp(value,min=0,max=1){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):min;}
  function makePool(path,count,volume){
    if(typeof Audio==='undefined')return [];
    return Array.from({length:count},()=>{
      const a=new Audio(assetUrl(ROOT+path));a.preload='auto';a.volume=clamp(volume);a.muted=muted;return a;
    });
  }
  const clickPool=makePool('click.mp3',5,.42);
  const typingPool=makePool('typing.mp3',7,.24);

  function poolPlay(pool,kind){
    if(muted||!pool.length)return;
    const index=kind==='click'?clickIndex++%pool.length:typingIndex++%pool.length;
    const a=pool[index];
    try{a.pause();a.currentTime=0;a.muted=false;const result=a.play();if(result&&result.catch)result.catch(error=>console.warn('Suono UI non riprodotto:',a.currentSrc||a.src,error));}
    catch(error){console.warn('Suono UI non disponibile:',error);}
  }

  /* AudioContext esclusivamente per tone/noise/hum sintetizzati. */
  function init(){
    if(ctx&&master)return true;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return false;
      ctx=new AC();master=ctx.createGain();master.gain.value=muted?0:.68;master.connect(ctx.destination);return true;
    }catch(error){console.error('Audio sintetico non disponibile:',error);ctx=null;master=null;return false;}
  }
  function unlock(){
    if(!init())return Promise.resolve(false);
    if(ctx.state==='running')return Promise.resolve(true);
    if(contextResumePromise)return contextResumePromise;
    try{
      contextResumePromise=Promise.resolve(ctx.resume()).then(()=>ctx.state==='running').catch(error=>{
        console.warn('AudioContext sintetico sospeso; nuovo tentativo al prossimo gesto:',error);return false;
      }).finally(()=>{contextResumePromise=null;});
      return contextResumePromise;
    }catch(error){console.warn('Ripresa AudioContext non riuscita:',error);return Promise.resolve(false);}
  }
  function resume(){if(!init())return false;if(ctx.state!=='running'&&!contextResumePromise)unlock();return ctx.state==='running';}

  function tone(freq,dur,type,volume,endFreq){
    resume();if(!ctx||muted)return;
    const o=ctx.createOscillator(),g=ctx.createGain();o.type=type||'sine';
    o.frequency.setValueAtTime(Math.max(20,freq),ctx.currentTime);
    if(endFreq)o.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),ctx.currentTime+dur);
    g.gain.setValueAtTime(.0001,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(Math.max(.0002,volume||.012),ctx.currentTime+Math.min(.008,dur*.35));
    g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+dur);o.connect(g);g.connect(master);o.start();o.stop(ctx.currentTime+dur+.02);
  }
  function noiseBurst(dur,volume,filterFreq){
    resume();if(!ctx||muted)return;
    const n=Math.max(1,Math.floor(ctx.sampleRate*dur)),buffer=ctx.createBuffer(1,n,ctx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<n;i++)data[i]=(Math.random()*2-1)*(1-i/n);
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=buffer;filter.type='highpass';filter.frequency.value=filterFreq||1200;
    gain.gain.setValueAtTime(Math.max(.0001,volume||.015),ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+dur);
    source.connect(filter);filter.connect(gain);gain.connect(master);source.start();
  }
  function startBed(level){
    resume();if(!ctx||noiseSource)return;bedLevel=typeof level==='number'?level:.012;
    const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.36;
    noiseSource=ctx.createBufferSource();noiseSource.buffer=buffer;noiseSource.loop=true;
    const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=780;
    noiseGain=ctx.createGain();noiseGain.gain.value=0;noiseSource.connect(filter);filter.connect(noiseGain);noiseGain.connect(master);noiseSource.start();
    noiseGain.gain.setTargetAtTime(muted?0:bedLevel,ctx.currentTime,.3);
    humOsc=ctx.createOscillator();humOsc.type='sine';humOsc.frequency.value=51;
    humGain=ctx.createGain();humGain.gain.value=0;humOsc.connect(humGain);humGain.connect(master);humOsc.start();
    humGain.gain.setTargetAtTime(muted?0:bedLevel*.14,ctx.currentTime,.45);
  }
  function stopBed(){
    if(!ctx||!noiseSource)return;
    const source=noiseSource,oscillator=humOsc;
    if(noiseGain)noiseGain.gain.setTargetAtTime(0,ctx.currentTime,.04);
    if(humGain)humGain.gain.setTargetAtTime(0,ctx.currentTime,.04);
    setTimeout(()=>{try{source.stop();}catch(_){}try{if(oscillator)oscillator.stop();}catch(_){}},260);
    noiseSource=null;noiseGain=null;humOsc=null;humGain=null;
  }

  function getTrack(slot){return ({persistent:persistentTrack,initial:initialTrack,afterJump:afterJumpTrack,choice:choiceTrack,ending:endingTrack,game3Lore:game3LoreTrack})[slot]||null;}
  function setTrack(slot,value){
    if(slot==='persistent')persistentTrack=value;
    else if(slot==='initial')initialTrack=value;
    else if(slot==='afterJump')afterJumpTrack=value;
    else if(slot==='choice')choiceTrack=value;
    else if(slot==='ending')endingTrack=value;
    else if(slot==='game3Lore')game3LoreTrack=value;
  }
  function removeTrack(track){
    if(!track)return;
    activeAudio.delete(track);pendingGestureAudio.delete(track);
    try{track.pause();track.currentTime=0;}catch(_){}
  }
  function playNative(track,path,onMissing){
    let settled=false;
    const fail=(error)=>{
      if(settled)return;settled=true;
      const mediaError=track.error;
      console.error('Errore caricamento/riproduzione audio:',{
        path,errorName:error&&error.name||'',mediaCode:mediaError&&mediaError.code||0,
        networkState:track.networkState,readyState:track.readyState,source:track.currentSrc||track.src
      });
      pendingGestureAudio.delete(track);activeAudio.delete(track);
      if(onMissing)onMissing(error||mediaError||new Error('Audio non disponibile'));
    };
    track.addEventListener('error',()=>fail(track.error||new Error('Errore media')), {once:true});
    track.addEventListener('playing',()=>{pendingGestureAudio.delete(track);}, {once:true});
    const attempt=()=>{
      if(settled||!activeAudio.has(track))return;
      try{
        const promise=track.play();
        if(promise&&typeof promise.then==='function')promise.then(()=>pendingGestureAudio.delete(track)).catch(error=>{
          if(error&&error.name==='NotAllowedError'){
            // Non è un file rotto: il browser chiede un gesto utente. Il brano
            // resta associato allo slot e viene ritentato al prossimo input.
            pendingGestureAudio.add(track);console.warn('Riproduzione in attesa di un gesto utente:',path);return;
          }
          if(error&&error.name==='AbortError')return;
          fail(error);
        });
      }catch(error){
        if(error&&error.name==='NotAllowedError'){pendingGestureAudio.add(track);return;}
        if(error&&error.name==='AbortError')return;
        fail(error);
      }
    };
    attempt();
    return track;
  }
  function retryPendingPlayback(){
    if(muted||!pendingGestureAudio.size)return;
    [...pendingGestureAudio].forEach(track=>{
      if(!track.paused)return;
      try{const promise=track.play();if(promise&&promise.then)promise.then(()=>pendingGestureAudio.delete(track)).catch(error=>{
        if(error&&error.name!=='NotAllowedError'&&error.name!=='AbortError')console.warn('Nuovo tentativo audio non riuscito:',error);
      });}catch(error){if(error&&error.name!=='NotAllowedError'&&error.name!=='AbortError')console.warn(error);}
    });
  }
  // I listener non generano suoni: riprovano solo tracce già richieste e
  // respinte dal browser per una temporanea policy di autoplay.
  document.addEventListener('pointerdown',retryPendingPlayback,true);
  document.addEventListener('keydown',retryPendingPlayback,true);
  document.addEventListener('touchstart',retryPendingPlayback,{capture:true,passive:true});

  function startLoop(slot,path,volume,onMissing){
    const current=getTrack(slot);
    if(current&&current.dataset.assetPath===path&&!current.paused)return current;
    removeTrack(current);setTrack(slot,null);
    if(typeof Audio==='undefined'){if(onMissing)onMissing(new Error('HTMLAudio non supportato'));return null;}
    const track=new Audio(assetUrl(path));
    track.dataset.assetPath=path;track.preload='auto';track.loop=true;track.volume=clamp(volume,0,1);track.muted=muted;
    // Nessun crossOrigin e nessun nodo Web Audio: file:// e server statico
    // utilizzano lo stesso percorso audio nativo del browser.
    activeAudio.add(track);setTrack(slot,track);
    return playNative(track,path,onMissing);
  }
  function playOnce(path,volume,fallback){
    if(muted)return null;
    if(typeof Audio==='undefined'){if(fallback)fallback();return null;}
    const track=new Audio(assetUrl(path));track.preload='auto';track.loop=false;track.volume=clamp(volume);track.muted=muted;activeAudio.add(track);
    track.addEventListener('ended',()=>activeAudio.delete(track),{once:true});
    track.addEventListener('error',()=>{activeAudio.delete(track);if(fallback)fallback();},{once:true});
    try{
      const promise=track.play();if(promise&&promise.catch)promise.catch(error=>{
        if(error&&['NotAllowedError','AbortError'].includes(error.name)){pendingGestureAudio.add(track);return;}
        activeAudio.delete(track);if(fallback)fallback();
      });
    }catch(error){activeAudio.delete(track);if(fallback)fallback();}
    return track;
  }

  function startAlwaysAmbience(level){
    const target=typeof level==='number'?clamp(level,.08,.34):.12;
    if(persistentTrack&&!persistentTrack.paused){persistentTrack.volume=target;return persistentTrack;}
    return startLoop('persistent',ROOT+'ambience.mp3',target,()=>startBed(target*.09));
  }
  function stopAlwaysAmbience(){removeTrack(persistentTrack);persistentTrack=null;}
  function startInitialAmbience(){stopInitialAmbience();return startLoop('initial',ROOT+'start.mp3',1,null);}
  function stopInitialAmbience(){removeTrack(initialTrack);initialTrack=null;}
  function stopAfterJumpAmbience(){removeTrack(afterJumpTrack);afterJumpTrack=null;}
  function stopChoiceMusic(){removeTrack(choiceTrack);choiceTrack=null;}
  function stopGame3LoreMusic(){removeTrack(game3LoreTrack);game3LoreTrack=null;}
  function startGame3LoreMusic(){stopBeds();stopEndingMusic();return startLoop('game3Lore',ROOT+'zone-shadow.mp3',.22,null);}
  function stopBeds(){stopAlwaysAmbience();stopInitialAmbience();stopAfterJumpAmbience();stopChoiceMusic();stopGame3LoreMusic();stopBed();}
  function prepareJump(){
    stopInitialAmbience();stopAfterJumpAmbience();stopChoiceMusic();
    if(persistentTrack){
      const track=persistentTrack,began=performance.now(),from=track.volume,duration=210;
      const timer=setInterval(()=>{
        const progress=Math.min(1,(performance.now()-began)/duration);
        try{track.volume=from*(1-progress);}catch(_){}
        if(progress>=1){clearInterval(timer);if(persistentTrack===track){removeTrack(track);persistentTrack=null;}}
      },16);
    }
    stopBed();
  }
  function startAfterJumpAmbience(){stopInitialAmbience();stopAlwaysAmbience();stopChoiceMusic();return startLoop('afterJump',ROOT+'horror.mp3',.085,null);}
  function startChoiceMusic(key,level){
    unlock();stopInitialAmbience();stopAlwaysAmbience();stopAfterJumpAmbience();stopChoiceMusic();
    const path=CHOICE_THEMES[key];if(!path){console.error('Chiave musica scelta non riconosciuta:',key);return null;}
    // I file sono stati normalizzati offline: il volume nativo è pieno ma non
    // viene applicato alcun guadagno Web Audio aggiuntivo.
    const volume=typeof level==='number'?clamp(level,.98,1):.98;
    return startLoop('choice',path,volume,null);
  }
  function stopEndingMusic(){if(endingFadeTimer){clearInterval(endingFadeTimer);endingFadeTimer=null;}removeTrack(endingTrack);endingTrack=null;}
  function startEndingMusic(){
    stopBeds();stopEndingMusic();
    const track=startLoop('ending',ROOT+'ending.mp3',0,null);if(!track)return null;
    const began=performance.now(),duration=4800,target=.24;
    endingFadeTimer=setInterval(()=>{
      if(endingTrack!==track){clearInterval(endingFadeTimer);endingFadeTimer=null;return;}
      const progress=Math.min(1,(performance.now()-began)/duration);
      track.volume=target*(progress*progress*(3-2*progress));
      if(progress>=1){clearInterval(endingFadeTimer);endingFadeTimer=null;}
    },45);
    return track;
  }
  function startTape(){unlock();startAlwaysAmbience();startInitialAmbience();tone(100,.28,'sine',.014,48);noiseBurst(.16,.009,2300);}
  function click(){poolPlay(clickPool,'click');}
  function typeTick(){poolPlay(typingPool,'typing');}
  function glitch(){noiseBurst(.18,.075,850);tone(175,.2,'sawtooth',.024,48);}
  function jump(){playOnce(ROOT+'jumpscare.mp3',1,()=>{noiseBurst(.58,.17,420);tone(105,.62,'sawtooth',.12,28);tone(720,.2,'square',.045,220);});}
  function gameStart(){playOnce(ROOT+'game-title.mp3',.62,()=>playOnce(GAME_TITLE_REMOTE,.62,()=>{
    noiseBurst(.22,.035,900);tone(92,.5,'sine',.055,48);tone(142,.36,'triangle',.035,74);tone(640,.11,'square',.018,420);
  }));}
  function mute(value){
    muted=!!value;if(master&&ctx)master.gain.setTargetAtTime(muted?0:.68,ctx.currentTime,.035);
    activeAudio.forEach(track=>{track.muted=muted;});
    [...clickPool,...typingPool].forEach(track=>{track.muted=muted;});
    if(noiseGain&&ctx)noiseGain.gain.setTargetAtTime(muted?0:bedLevel,ctx.currentTime,.035);
    if(humGain&&ctx)humGain.gain.setTargetAtTime(muted?0:bedLevel*.14,ctx.currentTime,.035);
  }
  function stopAll(){
    if(endingFadeTimer){clearInterval(endingFadeTimer);endingFadeTimer=null;}
    [persistentTrack,initialTrack,afterJumpTrack,choiceTrack,endingTrack,game3LoreTrack].forEach(removeTrack);
    persistentTrack=initialTrack=afterJumpTrack=choiceTrack=endingTrack=game3LoreTrack=null;
    activeAudio.forEach(track=>{try{track.pause();}catch(_){}});activeAudio.clear();pendingGestureAudio.clear();stopBed();
  }

  window.AudioEngine={init,unlock,startTape,startAlwaysAmbience,stopAlwaysAmbience,startInitialAmbience,stopInitialAmbience,startAfterJumpAmbience,stopAfterJumpAmbience,startChoiceMusic,stopChoiceMusic,stopBeds,prepareJump,startEndingMusic,stopEndingMusic,startGame3LoreMusic,stopGame3LoreMusic,click,typeTick,glitch,jump,gameStart,mute,stopAll,get muted(){return muted;},get supported(){return typeof Audio!=='undefined';}};
})();
