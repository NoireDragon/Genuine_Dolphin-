(function(){
'use strict';
const DATA=window.PARTENZA_DATA;

const $=id=>document.getElementById(id);
const boot=$('bootScreen'),app=$('app'),scene=$('scene');
scene.addEventListener('click',event=>{const control=event.target.closest('button');if(control&&scene.contains(control)){AudioEngine.unlock();AudioEngine.click();}},true);
const state={phase:'boot',mem:0,gateChoice:null,scare:0,cerchio:0,gameIndex:0,creditsKey:'',creditsPaused:false,creditsScrollFrame:null,creditsScrollLastFrame:0,creditsScrollElapsed:0,creditsScrollDuration:0,creditsScrollDistance:0,creditsScrollOffset:0,creditsScrollSpeed:0,confirmTimer:null,typeTimer:null,gameIntroTimer:null,jumpscareTimer:null,jumpDelayTimer:null,screenImmersionTimer:null,game3CutTimer:null,game3VerseTimer:null,gameTimerInterval:null,gameStartedAt:0,gameElapsedSeconds:0};
const creditMap={...DATA.choices,saluti:DATA.saluti};
const games=DATA.games;
function displayText(value){return String(value??'').replace(/\*\*/g,'').replace(/&#x20;/g,' ').replace(/\r\n?/g,'\n').replace(/\n{2,}/g,'\n');}
function esc(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function textNode(value,extra=''){return `<p class="story-copy ${extra}">${esc(displayText(value))}</p>`;}
function typewriterSpan(value,extra=''){const clean=displayText(value);return `<span class="typewriter-target ${extra}" data-typewriter-content="${encodeURIComponent(clean)}" aria-label="${esc(clean)}"></span>`;}
function typewriterNode(value,extra=''){return `<p class="story-copy ${extra}">${typewriterSpan(value)}</p>`;}
function titleNode(value){const clean=displayText(value).trim();return `<h2>${esc(clean)}</h2>`;}
function actions(items,extraClass=''){return `<div class="archive-actions ${extraClass}">${items.join('')}</div>`;}
function button(label,cmd,extra=''){return `<button class="action-button ${extra}" type="button" data-action="${cmd}">${label}</button>`;}
function card(kicker,title,bodyHtml,buttonsHtml='',extraClass=''){
  return `<section class="archive-card ${extraClass}">${title?titleNode(title):''}${bodyHtml}${buttonsHtml}</section>`;
}
function setMode(mode){Effects.setMode(mode);}
function start(){AudioEngine.unlock();AudioEngine.click();boot.hidden=true;app.hidden=false;state.phase='opening';AudioEngine.startTape();render();}
function updateBackdrop(){
  let key=null;
  if(state.phase==='boot')key='menu';
  else if(['opening','memories','clanGate'].includes(state.phase))key='iniziale';
  else if(state.phase==='cerchio')key='disturbante';
  else if(['gameIntro','briefing','gamePlay'].includes(state.phase))key='gameplay';
  else if(state.phase==='game3Lore')key=null;
  else if(state.phase==='goodbye')key=null;
  else if(state.phase==='credits'&&['politica','servizio','fede'].includes(state.creditsKey))key=`scelta-${state.creditsKey}`;
  else if(state.phase==='credits'&&state.creditsKey==='saluti')key=null; // bg-end è all'interno della schermata finale.
  else if(state.phase==='done')key='riavvolgi';
  Effects.setBackdrop(key);
}
function stopCreditsRoll(){
  if(state.creditsScrollFrame!==null){cancelAnimationFrame(state.creditsScrollFrame);state.creditsScrollFrame=null;}
  state.creditsScrollLastFrame=0;
  state.creditsScrollElapsed=0;
  state.creditsScrollDuration=0;
  state.creditsScrollDistance=0;
  state.creditsScrollOffset=0;
  state.creditsScrollSpeed=0;
}
function creditsRollFrame(timestamp){
  if(state.phase!=='credits'||state.creditsPaused){state.creditsScrollFrame=null;state.creditsScrollLastFrame=0;return;}
  const viewport=$('creditsWindow');
  const roll=$('creditsRoll');
  const endMarker=$('creditsRollEnd');
  if(!viewport||!roll||!endMarker||!viewport.isConnected||!roll.isConnected){state.creditsScrollFrame=null;return;}
  if(!state.creditsScrollLastFrame)state.creditsScrollLastFrame=timestamp;
  const delta=Math.min(50,Math.max(0,timestamp-state.creditsScrollLastFrame));
  state.creditsScrollLastFrame=timestamp;
  state.creditsScrollElapsed+=delta;
  state.creditsScrollOffset+=state.creditsScrollSpeed*(delta/1000);
  roll.style.setProperty('transform',`translate3d(0,${-state.creditsScrollOffset}px,0)`,'important');

  // La fine viene verificata sulla posizione reale del marcatore posto DOPO
  // l'ultimo paragrafo, non sullo scrollHeight del contenitore.
  const viewportTop=viewport.getBoundingClientRect().top;
  const markerBottom=endMarker.getBoundingClientRect().bottom;
  if(markerBottom<=viewportTop+0.5){
    const extra=markerBottom-viewportTop;
    if(extra>0){state.creditsScrollOffset+=extra;roll.style.setProperty('transform',`translate3d(0,${-state.creditsScrollOffset}px,0)`,'important');}
    state.creditsScrollFrame=null;
    state.creditsScrollLastFrame=0;
    return;
  }
  state.creditsScrollFrame=requestAnimationFrame(creditsRollFrame);
}
function startCreditsRoll(textLength){
  stopCreditsRoll();
  const viewport=$('creditsWindow');
  const roll=$('creditsRoll');
  const endMarker=$('creditsRollEnd');
  if(!viewport||!roll||!endMarker)return;
  const prepare=()=>{
    if(state.phase!=='credits'||!viewport.isConnected||!roll.isConnected||!endMarker.isConnected)return;
    const viewportHeight=viewport.clientHeight;
    // Il titolo entra da completamente sotto il bordo inferiore.
    roll.style.setProperty('padding-top',`${Math.ceil(viewportHeight+24)}px`,'important');
    roll.style.setProperty('padding-bottom',`${Math.ceil(viewportHeight)}px`,'important');
    roll.style.setProperty('transform','translate3d(0,0,0)','important');
    state.creditsScrollOffset=0;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(state.phase!=='credits'||!viewport.isConnected||!roll.isConnected||!endMarker.isConnected)return;
      const distance=Math.max(1,endMarker.getBoundingClientRect().bottom-viewport.getBoundingClientRect().top);
      state.creditsScrollDistance=distance;
      // Ritmo tarato per una lettura normale in tempo reale: circa 240 parole/minuto
      // sui testi effettivi delle tre scelte. Il limite in px/s evita accelerazioni
      // eccessive su schermi o contenuti con proporzioni differenti.
      state.creditsScrollDuration=Math.max(30000,textLength*40,(distance/30)*1000);
      state.creditsScrollSpeed=distance/(state.creditsScrollDuration/1000);
      state.creditsScrollElapsed=0;
      state.creditsScrollLastFrame=0;
      if(!state.creditsPaused)state.creditsScrollFrame=requestAnimationFrame(creditsRollFrame);
    }));
  };
  if(document.fonts&&document.fonts.ready){document.fonts.ready.then(prepare).catch(prepare);}else requestAnimationFrame(prepare);
}
function render(){if(state.phase!=='credits')stopCreditsRoll();if(state.typeTimer){clearTimeout(state.typeTimer);state.typeTimer=null;}updateBackdrop();scene.className='scene';if(['opening','memories','clanGate'].includes(state.phase))scene.classList.add('tape-playback');
  if(state.phase==='opening')renderOpening();
  else if(state.phase==='memories')renderMemory();
  else if(state.phase==='clanGate')renderClanGate();
  else if(state.phase==='scare')renderScare();
  else if(state.phase==='cerchio')renderCerchio();
  else if(state.phase==='gameIntro')renderGameIntro();
  else if(state.phase==='briefing')renderBriefing();
  else if(state.phase==='gamePlay')renderGamePlay();
  else if(state.phase==='game3Lore')renderGame3Lore();
  else if(state.phase==='credits')renderCredits();
  else if(state.phase==='goodbye')renderGoodbye();
  else if(state.phase==='done')renderDone();
  bindOptionalAssets(document);
  bindActions();
  startTypewriter();
}
function startTypewriter(){
  const target=scene.querySelector('.typewriter-target');
  if(!target)return;
  let fullText='';try{fullText=decodeURIComponent(target.dataset.typewriterContent||'');}catch(_){fullText=target.dataset.typewriterContent||'';}
  const chars=Array.from(fullText);
  const typingEnabled=['opening','memories','clanGate','scare','cerchio'].includes(state.phase)||(state.phase==='credits'&&state.creditsKey==='saluti');
  const complete=()=>{
    target.classList.remove('typing-active');target.classList.add('typing-complete');
    const glitchLine=target.closest('.cerchio-line.glitch-title');if(glitchLine)glitchLine.dataset.text=fullText;
    scene.classList.remove('typewriting');state.typeTimer=null;
    const continueButton=scene.querySelector('#continueAfterSaluti');if(continueButton)continueButton.hidden=false;
  };
  target.textContent='';
  target.classList.add('typing-active');
  scene.classList.add('typewriting');
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    target.textContent=fullText;complete();return;
  }
  const output=document.createTextNode('');target.appendChild(output);
  let index=0;
  const step=()=>{
    if(index>=chars.length){complete();return;}
    const ch=chars[index++];output.appendData(ch);
    if(typingEnabled&&ch.trim())AudioEngine.typeTick();
    const scrollBox=target.closest('.archive-card')||target.closest('.saluti-typewriter-window')||target.closest('.game3-lore-copy');
    if(scrollBox&&scrollBox.scrollHeight>scrollBox.clientHeight)scrollBox.scrollTop=scrollBox.scrollHeight;
    const delay=ch==='\n'?420:/[.!?…:;,]/.test(ch)?300:(ch===' '?50:65);
    state.typeTimer=setTimeout(step,delay);
  };
  step();
}
function renderOpening(){
  scene.classList.add('scene-opening');
  setMode(null);
  if(state.gateChoice==='confirmed'){
    scene.innerHTML=`<div class="reading-gif-stage" role="img" aria-label="Schermata di lettura"><img class="reading-gif" src="${Effects.assetUrl('assets/img/reading.gif')}" alt="Animazione di lettura personalizzabile"></div>`;
    return;
  }
  const body=typewriterNode(DATA.opening);
  scene.innerHTML=card('', '', body, actions([button('Certo!','opening-confirm','action-primary')], 'centered-actions'), 'opening-card narrative-card');
}
function renderMemory(){
  setMode(null);
  const paragraph=DATA.memories[state.mem];const buttons=[];
  if(state.mem>0)buttons.push(button('Precedente','mem-prev','secondary'));
  buttons.push(button(state.mem===DATA.memories.length-1?'Prosegui':'Continua','mem-next','action-primary'));
  scene.innerHTML=card('', '', typewriterNode(paragraph), actions(buttons,'memory-navigation'), 'narrative-card');
}
function renderClanGate(){
  setMode(null);
  scene.innerHTML=card('', '', typewriterNode(DATA.clanGate), actions([button('Certo','clan-confirm','action-primary')], 'centered-actions'), 'narrative-card');
}
function renderScare(){
  setMode(null);
  const lines=DATA.preHorror;const line=lines[state.scare]||lines[lines.length-1];
  const bloodClass=state.scare>=3?'blood-red-line':'';const laughClass=state.scare===4?'long-laugh':'';
  scene.innerHTML=`<div class="cerchio-line ${state.scare===4?'final-cerchio':''} ${bloodClass} ${laughClass}">${typewriterSpan(line)}</div><div class="archive-actions" style="justify-content:center;z-index:4;margin-top:32px">${button(state.scare===4?'Non è finita':'Continua','scare-next',state.scare===4?'danger':'secondary')}</div>`;
}
function renderCerchio(){
  setMode(state.cerchio>=7?'horror-max':null);
  const line=DATA.horror[state.cerchio];const final=state.cerchio===DATA.horror.length-1;
  scene.innerHTML=`<div class="cerchio-line villain-monologue final-cerchio glitch-title blood-red-line" data-text="">${typewriterSpan(line)}</div><div class="archive-actions" style="justify-content:center;z-index:4;margin-top:26px">${button(final?'Apri il primo dossier':'Avanti','cerchio-next',final?'danger':'secondary')}</div>`;
  if(state.cerchio===0||state.cerchio===4||state.cerchio===8||final)Effects.glitch(final?'strong':'light');
}
function enterGameIntro(index){
  if(state.gameIntroTimer){clearTimeout(state.gameIntroTimer);state.gameIntroTimer=null;}
  if(state.gameTimerInterval){clearInterval(state.gameTimerInterval);state.gameTimerInterval=null;}
  AudioEngine.stopBeds();
  state.gameIndex=index;state.gameIndexOpen=false;state.creditsPaused=false;state.phase='gameIntro';
  AudioEngine.gameStart();render();
}
function renderGameIntro(){
  setMode('game-mode');
  const game=games[state.gameIndex];
  scene.innerHTML=`<div class="game-intro-screen" role="status" aria-live="polite"><img class="game-intro-sprite optional-asset" data-optional-asset="game-sprite" src="${Effects.assetUrl(game.sprite)}" alt="" aria-hidden="true" hidden><p class="game-intro-label"><span class="game-intro-prefix">Gioco ${game.number}</span><span class="game-intro-name">${esc(game.title)}</span></p></div>`;
  if(state.gameIntroTimer)clearTimeout(state.gameIntroTimer);
  // La schermata resta visibile per tutta la durata del clip di circa 4 secondi.
  state.gameIntroTimer=setTimeout(()=>{
    state.gameIntroTimer=null;
    if(state.gameIndex===2){beginGame3Lore();return;}
    state.phase='briefing';render();
  },4350);
}
function bindOptionalAssets(root){
  (root||document).querySelectorAll('img[data-optional-asset]').forEach(img=>{
    if(img.dataset.assetBound==='true')return;
    img.dataset.assetBound='true';
    const ready=()=>{
      if(!img.naturalWidth){failed();return;}
      img.hidden=false;img.classList.add('asset-ready');
      img.parentElement.classList.remove('asset-missing');
      const note=img.parentElement.querySelector('.asset-missing-note');if(note)note.remove();
      const role=img.dataset.optionalAsset;
      if(role==='game-sprite')img.parentElement.classList.add('has-game-sprite');
    };
    const failed=()=>{
      img.hidden=true;img.classList.remove('asset-ready');
      img.parentElement.classList.add('asset-missing');
      if(!img.parentElement.querySelector('.asset-missing-note')){
        const note=document.createElement('span');note.className='asset-missing-note';
        note.textContent='SPRITE NON TROVATO — CONTROLLA assets/img/';
        img.parentElement.appendChild(note);
      }
    };
    img.addEventListener('load',ready,{once:true});img.addEventListener('error',failed,{once:true});
    if(img.complete){if(img.naturalWidth)ready();else failed();}
  });
}
function formatBriefingText(text){
  return String(text||'').replace(/\r\n?/g,'\n').split(/\n\s*\n/).map(block=>{
    const value=block.trim();
    if(!value)return '';
    if(value.startsWith('## '))return `<h3 class="briefing-section-title">${esc(value.slice(3))}</h3>`;
    if(value.startsWith('### '))return `<h4 class="briefing-subsection-title">${esc(value.slice(4))}</h4>`;
    return `<p>${esc(value).replace(/\*([^*]+)\*/g,'<em>$1</em>').replace(/\n/g,'<br>')}</p>`;
  }).join('');
}
function renderBriefing(){
  setMode('game-mode');
  const game=games[state.gameIndex];
  const formattedText=formatBriefingText(game.text);
  scene.innerHTML=`<section class="briefing-station" role="region" aria-label="Regole del gioco">
    <header class="briefing-heading"><div class="briefing-title-wrap"><p class="briefing-kicker">REGOLAMENTO</p><h2>${esc(game.title)}</h2></div></header>
    <article class="briefing-document" tabindex="0" aria-label="Testo completo del regolamento">${formattedText}</article>
    <footer class="briefing-controls"><button class="action-button action-primary" type="button" data-action="brief-next">Capito</button></footer>
  </section>`;
}

const game3LoreVerses=[
  "Si narra che in questo mondo esistono soglie che non dovrebbero mai essere violate.",
  "Zone rimosse dalla memoria, dove antichi alchimisti cercavano la formula per sconfiggere la morte...",
  "Ma la vita non risorge dal nulla...",
  "richiede un sacrificio...",
  "Chi è sceso qui sotto prima di voi non ha trovato l'oro,",
  "ha scoperto qualcos'altro.",
  "Le cronache dell'epoca parlano di \"entità\",",
  "esperimenti falliti in cui l'anima è rimasta avvelenata e intrappolata tra la carne e l'ombra.",
  "Creature che vi osservano dal buio, attratte dal calore delle vostre vene.",
  "Siete stati mandati qui sotto in tre,",
  "equipaggiati solo con una radio antiquata che gracchia nel silenzio e una torcia...",
  "Se sentite un sussurro alle vostre spalle...",
  "beh, sappiate che è inutile accendere la torcia perché",
  "È troppo tardi."
];
function beginGame3Lore(){
  if(state.game3CutTimer){clearTimeout(state.game3CutTimer);state.game3CutTimer=null;}
  if(state.game3VerseTimer){clearTimeout(state.game3VerseTimer);state.game3VerseTimer=null;}
  if(state.typeTimer){clearTimeout(state.typeTimer);state.typeTimer=null;}
  state.phase='game3Lore';
  AudioEngine.stopBeds();
  AudioEngine.startGame3LoreMusic();
  render();
}
function revealGame3Background(index,finalSuspense=false){
  const bg=scene.querySelector('.game3-lore-background');
  const shade=scene.querySelector('.game3-lore-shade');
  if(!bg)return;
  const progress=finalSuspense?1:Math.min(1,(index+1)/game3LoreVerses.length);
  const opacity=finalSuspense?1:.055+(progress*.88);
  const gray=finalSuspense?0:Math.max(0,1-progress*.78);
  const saturation=finalSuspense?1.55:.08+progress*.88;
  const brightness=finalSuspense?1.02:.10+progress*.70;
  const contrast=finalSuspense?1.30:.78+progress*.48;
  const blur=finalSuspense?0:(1-progress)*19;
  bg.style.setProperty('opacity',String(opacity),'important');
  bg.style.setProperty('filter',`grayscale(${gray}) saturate(${saturation}) contrast(${contrast}) brightness(${brightness}) blur(${blur}px)`,'important');
  // Il movimento del fondale è gestito dal CSS mentre la lore procede.
  // Si arresta quando il fondale raggiunge la saturazione finale.
  if(finalSuspense){bg.style.removeProperty('transform');}
  if(shade)shade.style.opacity=String(finalSuspense ? 0.12 : Math.max(.18,.96-progress*.72));
}
function startGame3LoreSequence(){
  const screen=scene.querySelector('.game3-lore-screen');
  const verse=scene.querySelector('#game3LoreVerse');
  if(!screen||!verse)return;
  let index=0;
  const showVerse=()=>{
    if(index>=game3LoreVerses.length){
      verse.textContent='';
      verse.classList.remove('verse-visible');
      AudioEngine.stopGame3LoreMusic();
      screen.classList.remove('lore-manifesting');
      screen.classList.add('lore-suspense');
      revealGame3Background(game3LoreVerses.length-1,true);
      // Silenzio intenzionale: il fondale ormai manifesto suggerisce un jumpscare, ma non ne parte uno.
      state.game3CutTimer=setTimeout(()=>{
        screen.classList.add('lore-cut');
        state.game3CutTimer=setTimeout(()=>{
          state.game3CutTimer=null;
          state.phase='briefing';
          document.body.classList.remove('game3-lore-active');
          render();
        },520);
      },5600);
      return;
    }
    const line=game3LoreVerses[index];
    revealGame3Background(index,false);
    verse.classList.remove('verse-visible','verse-final');
    const isLastVerse=index===game3LoreVerses.length-1;
    if(isLastVerse)verse.classList.add('verse-final');
    verse.textContent=line;
    verse.style.transition='none';
    verse.style.opacity='0';
    verse.style.filter='blur(14px)';
    verse.style.transform='translateY(18px) scale(.985)';
    void verse.offsetWidth;
    requestAnimationFrame(()=>{
      const appearDuration=isLastVerse?2.65:1.65;
      verse.style.transition=`opacity ${appearDuration}s ease, filter ${appearDuration}s ease, transform ${appearDuration}s ease`;
      verse.style.opacity='1';
      verse.style.filter='blur(0)';
      verse.style.transform='translateY(0) scale(1)';
      verse.classList.add('verse-visible');
    });
    // Le righe più lunghe restano più a lungo, ma non vengono mai battute lettera per lettera.
    const hold=isLastVerse?4700:Math.max(2200,Math.min(3900,line.length*24));
    state.game3VerseTimer=setTimeout(()=>{
      const disappearDuration=isLastVerse?2.45:1.45;
      verse.style.transition=`opacity ${disappearDuration}s ease, filter ${disappearDuration}s ease, transform ${disappearDuration}s ease`;
      verse.style.opacity='0';
      verse.style.filter='blur(11px)';
      verse.style.transform='translateY(-13px) scale(1.012)';
      state.game3VerseTimer=setTimeout(()=>{
        verse.textContent='';
        verse.classList.remove('verse-visible');
        index++;
        state.game3VerseTimer=setTimeout(showVerse,420);
      },disappearDuration*1000);
    },(isLastVerse?2650:1650)+hold);
  };
  showVerse();
}
function renderGame3Lore(){
  setMode('game-mode');
  document.body.classList.add('game3-lore-active');
  scene.innerHTML=`<section class="game3-lore-screen lore-manifesting" aria-label="La Zona Ombra"><img class="game3-lore-background" src="${Effects.assetUrl('assets/img/bg-zone-shadow.png')}" alt="" aria-hidden="true"><div class="game3-lore-shade" aria-hidden="true"></div><div class="game3-lore-copy"><p class="game3-lore-verse" id="game3LoreVerse" aria-live="polite"></p></div></section>`;
  startGame3LoreSequence();
}
function renderGoodbye(){
  document.body.classList.remove('game3-lore-active','horror-awakened','horror-max','signal-lost','glitch-burst');
  setMode('peaceful-ending-mode');
  AudioEngine.stopAfterJumpAmbience();
  AudioEngine.startEndingMusic();
  // La schermata BUONA STRADA, CLAN resta volutamente nera: il fondale è riservato ai saluti.
  scene.innerHTML=`<section class="goodbye-fullscreen goodbye-black" aria-label="Buona strada, Clan"><h1>BUONA STRADA, CLAN</h1><button class="action-button action-primary goodbye-continue" type="button" data-action="goodbye-next">Continua</button></section>`;
}
function beginGameTimer(){
  if(state.gameTimerInterval)clearInterval(state.gameTimerInterval);
  AudioEngine.stopGame3LoreMusic();
  document.body.classList.remove('game3-lore-active');
  state.gameElapsedSeconds=0;state.gameStartedAt=Date.now();state.phase='gamePlay';
  AudioEngine.startAlwaysAmbience(.30);
  render();
  state.gameTimerInterval=setInterval(()=>{
    state.gameElapsedSeconds=Math.floor((Date.now()-state.gameStartedAt)/1000);
    const clock=document.getElementById('gameTimer');
    if(clock)clock.textContent=formatClock(state.gameElapsedSeconds);
    const elapsed=document.getElementById('gameTimerMeta');
    if(elapsed)elapsed.textContent=state.gameElapsedSeconds===1?'SECONDO TRASCORSO':'TEMPO TRASCORSO';
  },250);
}
function formatClock(seconds){
  const mm=String(Math.floor(Math.max(0,seconds)/60)).padStart(2,'0');
  const ss=String(Math.max(0,seconds)%60).padStart(2,'0');
  return `${mm}:${ss}`;
}
function renderGamePlay(){
  setMode('game-mode');
  const game=games[state.gameIndex];
  scene.innerHTML=`<section class="game-runtime" aria-live="polite"><p class="game-runtime-label">GIOCO ${game.number}: ${esc(game.title)}</p><h2 id="gameTimer" class="game-runtime-clock">${formatClock(state.gameElapsedSeconds)}</h2><p id="gameTimerMeta" class="game-runtime-caption">TEMPO TRASCORSO</p><div class="archive-actions centered-actions game-finish-actions">${button('Concludi','game-finish','action-primary')}</div><div class="game-runtime-signal" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></section>`;
}
function renderCredits(){
  const c=creditMap[state.creditsKey];
  const isSaluti=state.creditsKey==='saluti';
  if(isSaluti){document.body.classList.remove('horror-awakened','horror-max','signal-lost','glitch-burst');setMode('peaceful-ending-mode');AudioEngine.stopEndingMusic();}
  else setMode('credits-mode');
  const allText=c.body.join(' ');
  if(isSaluti){
    const salutiText=c.body.map(p=>displayText(p).trimEnd()).join('\n\n');
    scene.innerHTML=`<section class="saluti-typewriter-screen ending-saluti-screen fullscreen-finale" aria-label="Saluti finali"><img class="ending-background" src="${Effects.assetUrl('assets/img/bg-end.png')}" alt="" aria-hidden="true"><div class="finale-shade" aria-hidden="true"></div><div class="saluti-typewriter-window" id="salutiWindow"><p class="saluti-typewriter-copy">${typewriterSpan(salutiText)}</p></div><div class="credits-controls saluti-actions"><button class="action-button action-primary" id="continueAfterSaluti" type="button" data-action="credits-next" hidden>Continua</button></div></section>`;
  }else{
    const body=c.body.map((p,i)=>textNode(p,CreditsTools.quoteSourceLikeParagraph(displayText(p))?'source-quote':'credits-copy')).join('');
    scene.innerHTML=`<div class="credits-screen"><div class="credits-window" id="creditsWindow"><div class="credits-roll" id="creditsRoll"><h2>${esc(displayText(c.title).trim())}</h2><div class="credits-copy-block">${body}</div><span class="credits-roll-end" id="creditsRollEnd" aria-hidden="true"></span></div></div><div class="credits-controls"><button class="action-button secondary" type="button" data-action="credits-pause">Pausa</button><button class="action-button action-primary" type="button" data-action="credits-next">Continua</button></div></div>`;
    startCreditsRoll(allText.length);
  }
}
function renderDone(){
  document.body.classList.remove('final-ending');
  document.body.classList.remove('horror-awakened','horror-max','signal-lost','glitch-burst');
  setMode('peaceful-ending-mode');
  scene.innerHTML=`<div class="final-end done-end">${button('Riavvolgi','restart','action-primary')}</div>`;
}
function bindActions(){scene.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',()=>handle(el.dataset.action,el)));}
function handle(action,el){
  if(action==='opening-confirm'){if(state.gateChoice==='confirmed')return;state.gateChoice='confirmed';render();if(state.confirmTimer)clearTimeout(state.confirmTimer);state.confirmTimer=setTimeout(()=>{state.phase='memories';state.mem=0;state.gateChoice=null;state.confirmTimer=null;render();},2050);return;}
  if(action==='start-memory'){if(state.confirmTimer)clearTimeout(state.confirmTimer);state.phase='memories';state.mem=0;state.gateChoice=null;render();return;}
  if(action==='mem-prev'){state.mem=Math.max(0,state.mem-1);render();return;}
  if(action==='mem-next'){if(state.mem<DATA.memories.length-1){state.mem++;Effects.rareAnomaly(true);}else{state.phase='clanGate';}render();return;}
  if(action==='clan-confirm'){
    if(state.gateChoice==='confirmed')return;
    state.gateChoice='confirmed';
    if(state.typeTimer){clearTimeout(state.typeTimer);state.typeTimer=null;}
    if(state.jumpDelayTimer)clearTimeout(state.jumpDelayTimer);
    AudioEngine.prepareJump();
    // Breve vuoto sonoro: il taglio rende il colpo più netto senza alzare eccessivamente il volume.
    state.jumpDelayTimer=setTimeout(()=>{
      state.jumpDelayTimer=null;state.phase='scare';state.scare=0;
      document.body.classList.remove('innocent-mode','horror-awakened');setMode(null);
      // Mantieni visibile lo sfondo iniziale durante l'impatto: verrà rimosso al termine del jumpscare.
      Effects.setBackdrop('iniziale');
      const jumpImage=$('jumpscareSprite');
      const jumpBackground=$('jumpscareBackground');
      const jumpSpriteUrl=Effects.assetUrl('assets/img/Jumpscare.gif');
      if(jumpImage){jumpImage.src=jumpSpriteUrl;}
      if(jumpBackground){jumpBackground.src=Effects.assetUrl('assets/img/Jumpscare_bg.gif');}
      document.querySelectorAll('.jumpscare-echo').forEach(echo=>{echo.src=jumpSpriteUrl;});
      document.body.classList.add('jumpscare-active');
      AudioEngine.jump();
      if(state.screenImmersionTimer)clearTimeout(state.screenImmersionTimer);
      // Il televisore si espande fino a occupare tutto il viewport: è un passaggio essenziale della scena.
      state.screenImmersionTimer=setTimeout(()=>{document.body.classList.add('screen-immersed');state.screenImmersionTimer=null;},620);
      state.jumpscareTimer=setTimeout(()=>{document.body.classList.remove('jumpscare-active');state.jumpscareTimer=null;render();},4140);
    },500);
    return;
  }
  if(action==='scare-next'){if(state.scare<4){state.scare++;if(state.scare===4)Effects.glitch('strong');else AudioEngine.glitch();}else{state.phase='cerchio';state.cerchio=0;document.body.classList.add('horror-awakened');AudioEngine.startAfterJumpAmbience();}render();return;}
  if(action==='cerchio-next'){if(state.cerchio<12){state.cerchio++;AudioEngine.glitch();}else{setMode(null);enterGameIntro(0);return;}render();return;}
  if(action==='brief-next'){beginGameTimer();return;}
  if(action==='game-finish'){if(state.gameTimerInterval){clearInterval(state.gameTimerInterval);state.gameTimerInterval=null;}if(state.gameIndex===0)startCredits('politica');else if(state.gameIndex===1)startCredits('servizio');else startCredits('fede');return;}
  if(action==='credits-pause'){state.creditsPaused=!state.creditsPaused;if(state.creditsPaused){if(state.creditsScrollFrame!==null){cancelAnimationFrame(state.creditsScrollFrame);state.creditsScrollFrame=null;}state.creditsScrollLastFrame=0;}else if(state.phase==='credits'&&state.creditsScrollDistance>0){state.creditsScrollLastFrame=0;state.creditsScrollFrame=requestAnimationFrame(creditsRollFrame);}if(el)el.textContent=state.creditsPaused?'Riprendi scorrimento':'Pausa scorrimento';return;}
  if(action==='credits-next'){if(state.creditsKey==='politica'){enterGameIntro(1);return;}else if(state.creditsKey==='servizio'){enterGameIntro(2);return;}else if(state.creditsKey==='fede'){startCredits('saluti');return;}else if(state.creditsKey==='saluti'){AudioEngine.stopAfterJumpAmbience();AudioEngine.stopEndingMusic();state.phase='goodbye';render();return;}state.creditsPaused=false;render();return;}
  if(action==='goodbye-next'){AudioEngine.stopEndingMusic();state.phase='done';render();return;}
  if(action==='power-off'){if(state.jumpDelayTimer){clearTimeout(state.jumpDelayTimer);state.jumpDelayTimer=null;}if(state.gameTimerInterval)clearInterval(state.gameTimerInterval);state.gameTimerInterval=null;document.body.classList.add('powering-off');AudioEngine.stopAll();if(state.jumpscareTimer)clearTimeout(state.jumpscareTimer);state.jumpscareTimer=null;document.body.classList.remove('jumpscare-active');setTimeout(()=>{document.body.classList.remove('powering-off','powered-off');state.phase='done';render();},890);return;}
  if(action==='restart'){if(state.jumpDelayTimer){clearTimeout(state.jumpDelayTimer);state.jumpDelayTimer=null;}if(state.screenImmersionTimer){clearTimeout(state.screenImmersionTimer);state.screenImmersionTimer=null;}if(state.game3CutTimer){clearTimeout(state.game3CutTimer);state.game3CutTimer=null;}if(state.game3VerseTimer){clearTimeout(state.game3VerseTimer);state.game3VerseTimer=null;}if(state.gameTimerInterval)clearInterval(state.gameTimerInterval);state.gameTimerInterval=null;AudioEngine.stopAll();if(state.confirmTimer)clearTimeout(state.confirmTimer);if(state.gameIntroTimer)clearTimeout(state.gameIntroTimer);if(state.jumpscareTimer)clearTimeout(state.jumpscareTimer);state.jumpscareTimer=null;document.body.classList.remove('jumpscare-active','screen-immersed','game3-lore-active');state.gameIntroTimer=null;state.confirmTimer=null;state.mem=0;state.gateChoice=null;state.scare=0;state.cerchio=0;state.gameIndex=0;state.gameIndexOpen=false;state.creditsKey='';state.creditsPaused=false;state.phase='opening';document.body.classList.remove('powered-off','powering-off','final-mode','final-ending','credits-mode','horror-max','horror-awakened');document.body.classList.add('innocent-mode');AudioEngine.startTape();render();return;}
}
function startCredits(key){stopCreditsRoll();state.phase='credits';state.creditsKey=key;state.creditsPaused=false;AudioEngine.stopAlwaysAmbience();if(key==='saluti'){AudioEngine.stopChoiceMusic();AudioEngine.stopAfterJumpAmbience();AudioEngine.stopEndingMusic();}else {AudioEngine.startChoiceMusic(key,.94);Effects.glitch('light');}render();}
Effects.setBackdrop('menu');
// Il soggetto del jumpscare è il GIF dell'utente; il fondale è un PNG separato.
$('playTape').addEventListener('click',start);

// Start in a quiet archive: audio and animation only begin after the user chooses to play.
})();
