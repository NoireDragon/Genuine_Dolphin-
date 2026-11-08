(function(){
  'use strict';
  const body=document.body;
  const assetVersion=Date.now().toString(36);
  const assetUrl=path=>`${path}?v=${assetVersion}`;
  let glitchTimer=null, anomalyTimer=null, backdropRequest=0, backdropKey=null;
  const backdrops={
    menu:'assets/img/bg-menu.png',
    iniziale:'assets/img/bg-start.png',
    disturbante:'assets/img/bg-disturbing.gif',
    'scelta-politica':'assets/img/bg-politics.png',
    'scelta-servizio':'assets/img/bg-service.png',
    'scelta-fede':'assets/img/bg-faith.png',
    gameplay:'assets/img/bg-games.png',
    fine:'assets/img/bg-end.png',
    riavvolgi:'assets/img/bg-rewind.png'
  };
  function setMode(mode){
    body.classList.remove('horror-max','credits-mode','final-mode','peaceful-ending-mode','game-mode');
    if(mode)body.classList.add(mode);
  }
  function setBackdrop(name){
    const backdrop=document.getElementById('screenBackdrop');
    if(!backdrop)return;
    if(name===backdropKey)return;
    backdropKey=name||null;
    const request=++backdropRequest;
    if(!name||!backdrops[name]){
      backdrop.style.backgroundImage='';
      backdrop.removeAttribute('data-custom-backdrop');
      return;
    }
    const path=backdrops[name];
    const image=new Image();
    image.onload=()=>{
      if(request!==backdropRequest)return;
      // I file hanno tutti il rapporto dello schermo: vengono mostrati senza tagli.
      backdrop.style.backgroundImage=`url("${assetUrl(path)}")`;
      backdrop.style.backgroundSize='100% 100%';
      backdrop.style.backgroundPosition='center';
      backdrop.style.backgroundRepeat='no-repeat';
      backdrop.style.backgroundColor='#050606';
      backdrop.dataset.customBackdrop=name;
    };
    image.onerror=()=>{
      if(request!==backdropRequest)return;
      backdrop.style.backgroundImage='';
      backdrop.style.backgroundColor='#080808';
      backdrop.dataset.assetMissing=name;
      backdrop.removeAttribute('data-custom-backdrop');
      console.warn('Sfondo non trovato:', path);
    };
    image.src=assetUrl(path);
  }
  function glitch(level){
    body.classList.remove('glitch-burst','signal-lost');void body.offsetWidth;body.classList.add('glitch-burst');
    if(level==='strong')body.classList.add('signal-lost');
    clearTimeout(glitchTimer);glitchTimer=setTimeout(()=>body.classList.remove('glitch-burst','signal-lost'),level==='strong'?650:240);
  }
  function rareAnomaly(show){
    if(!show||Math.random()>.32)return;
    const toast=document.getElementById('anomalyToast');if(!toast)return;
    toast.textContent=['SEGNALE NON IDENTIFICATO','FRAME MANCANTE','NON RIAVVOLGERE','TRACCIA SCONOSCIUTA'][Math.floor(Math.random()*4)];
    toast.classList.add('visible');clearTimeout(anomalyTimer);anomalyTimer=setTimeout(()=>toast.classList.remove('visible'),1050);
  }
  window.Effects={setMode,setBackdrop,glitch,rareAnomaly,assetUrl};
})();
