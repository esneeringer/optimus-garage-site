/* Customer tracking page: checks Jobber (through our server) every 10 seconds and moves the progress bar. */
(function(){
  var $=function(s){return document.querySelector(s)}, $$=function(s){return [].slice.call(document.querySelectorAll(s))};
  var token=decodeURIComponent(location.pathname.split("/t/")[1]||"");
  var PHONE="+15555550123", cur=-1, info={};
  var STEPS=[
    {t:"Request received", sub:"We’ll text you to confirm. Tap the confirm link we send."},
    {t:"Time confirmed",   sub:"You’re all set. We’ll text you when we’re on the way."},
    {t:"We’re on the way", sub:"Tap call if you need us."},
    {t:"All done",         sub:"Thanks for choosing us. Tap call if you need anything."}
  ];
  function show(i){
    var s=STEPS[i]; cur=i;
    $("#tk-title").textContent=s.t;
    $("#tk-big").textContent=info.when||"";
    $("#tk-sub").textContent=s.sub;
    $$("#tk-seg i").forEach(function(el,k){el.className=k<i?"done":(k===i?"now":"")});
    $$("#tk-names span").forEach(function(el,k){el.className=k<=i?"on":""});
    $("#tk-addr").textContent=info.address||"";
    $("#tk-svc").textContent=(info.service||"")+(info.when?" · "+info.when:"");
    $("#tk-call").href="tel:"+PHONE;
    $("#tk-via").textContent="This page updates by itself. Keep it open or come back to this link anytime.";
    document.title=s.t+" | Optimus Garage Company";
  }
  function when(d,slot){
    if(!d) return slot||"";
    var p=d.split("-"), dt=new Date(+p[0],+p[1]-1,+p[2]);
    return dt.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})+(slot?" · "+slot:"");
  }
  function check(){
    fetch("/api/track/"+encodeURIComponent(token)).then(function(r){return r.json()}).then(function(s){
      if(!s||!s.known){ if(cur<0){ $("#tk-title").textContent="We can’t find that appointment"; $("#tk-sub").textContent="Call us and we’ll help right away."; $("#tk-call").href="tel:"+PHONE; } return; }
      info={address:s.address,service:s.service,when:when(s.date,s.slot)};
      if(s.step!==cur) show(s.step);
    }).catch(function(){});
  }
  check(); setInterval(check,10000);
  document.addEventListener("visibilitychange",function(){ if(!document.hidden) check(); });
})();
