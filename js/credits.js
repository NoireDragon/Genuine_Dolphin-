(function(){
  function durationFor(text){return Math.min(220,Math.max(72,Math.round(text.length*.052)));}
  function quoteSourceLikeParagraph(raw){return raw.startsWith('"')||raw.startsWith('“')||raw.startsWith("'");}
  window.CreditsTools={durationFor,quoteSourceLikeParagraph};
})();

