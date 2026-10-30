/* Customer tracking page: checks Jobber (through our server) every 10 seconds and moves the progress bar. */
(function(){
  var $=function(s){return document.querySelector(s)}, $$=function(s){return [].slice.call(document.querySelectorAll(s))};
  var token=decodeURIComponent(location.pathname.split("/t/")[1]||"");
  var PHONE="+15555550123", cur=-1, info={};
  var STEPS=[
    {t:"You’re booked", sub:"Your time is reserved. We’ll text you when we’re on the way."},
    {t:"You’re booked",   sub:"Your time is reserved. We’ll text you when we’re on the way."},
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
      if(s.cancelled){
        cur=-2; $("#tk-title").textContent="Visit cancelled"; $("#tk-big").textContent=""; $("#tk-sub").textContent="No problem. Tap below if you’d like to rebook, or call us anytime.";
        $$("#tk-seg i").forEach(function(el){el.className=""}); $$("#tk-names span").forEach(function(el){el.className=""});
        $("#tk-act").style.display="none"; $("#tk-call").href="tel:"+PHONE; return;
      }
      $("#tk-act").style.display = s.step>=3 ? "none" : "";
      var rv=$("#tk-review"); if(s.step>=3 && s.review){rv.href=s.review; rv.style.display="block"}
      var stp=Math.max(s.step,1); if(stp!==cur) show(stp);
    }).catch(function(){});
  }
  /* ---- change time / cancel ---- */
  var WINS=["8–10 AM","10 AM–12 PM","12–2 PM","2–4 PM"], taken={};
  function pad(n){return (n<10?"0":"")+n}
  function isoOf(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
  var dt=$("#rs-date"), sel=$("#rs-slot"), msg=$("#rs-msg");
  var tmr=new Date(); tmr.setDate(tmr.getDate()+1); dt.min=isoOf(tmr);
  var far=new Date(); far.setDate(far.getDate()+60); dt.max=isoOf(far);
  function say(t,bad){msg.textContent=t; msg.className="msg"+(bad?" bad":"")}
  dt.addEventListener("change",function(){
    var v=dt.value; sel.innerHTML="<option value=''>Checking…</option>";
    if(!v) return;
    var dow=new Date(v+"T12:00:00").getDay();
    fetch("/api/availability?from="+v+"&to="+v).then(function(r){return r.json()}).then(function(j){
      var t=(j&&j.ok&&j.taken&&j.taken[v])||[], h="<option value=''>Pick a window</option>", n=0;
      WINS.forEach(function(w,i){ if(t.indexOf(i)<0 && dow!==0){h+="<option>"+w+"</option>"; n++} });
      sel.innerHTML = n ? h : "<option value=''>No windows open that day</option>";
    }).catch(function(){sel.innerHTML="<option value=''>Try again</option>"});
  });
  $("#rs-go").addEventListener("click",function(){
    if(!dt.value||!sel.value){say("Pick a day and a window.",true);return}
    say("Changing…");
    fetch("/api/track/"+encodeURIComponent(token)+"/reschedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date:dt.value,slot:sel.value})})
      .then(function(r){return r.json()}).then(function(j){
        if(j&&j.ok){ say("Done. Your new time is saved."); location.replace("/t/"+j.token); }
        else say((j&&j.error)||"Couldn’t change it. Please call us.",true);
      }).catch(function(){say("Couldn’t change it. Please call us.",true)});
  });
  $("#cx-go").addEventListener("click",function(){
    if(!confirm("Cancel this visit?")) return;
    fetch("/api/track/"+encodeURIComponent(token)+"/cancel",{method:"POST"}).then(function(r){return r.json()}).then(function(j){
      if(j&&j.ok) check(); else say("Couldn’t cancel. Please call us.",true);
    }).catch(function(){say("Couldn’t cancel. Please call us.",true)});
  });
  check(); setInterval(check,10000);
  document.addEventListener("visibilitychange",function(){ if(!document.hidden) check(); });
})();
