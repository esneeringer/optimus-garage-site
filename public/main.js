/* JOBBER INTEGRATION
   Paste your Jobber Work Request link here (Jobber > Settings > Work Request Settings).
   When set, "Lock it in" opens it with the choices carried along where possible.
   Leave empty to run the on-page demo confirmation. */
var JOBBER_REQUEST_URL = "";
var COMPANY_PHONE = "+15555550123";

/* BOOKING HOURS (prototype). Busy windows are simulated for now;
   real availability will come from Jobber. */
var BIZ = {
  days: [1,2,3,4,5,6],   /* open days: 0 = Sunday ... 6 = Saturday */
  windows: [{l:"8–10 AM",h:8},{l:"10 AM–12 PM",h:10},{l:"12–2 PM",h:12},{l:"2–4 PM",h:14}],
  ahead: 60,             /* how many days out people can book */
  lead: 2                /* hours of notice needed */
};
var MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];

var $ = function(s){return document.querySelector(s)};
var $$ = function(s){return Array.prototype.slice.call(document.querySelectorAll(s))};
var sheet=$("#sheet"), scrim=$("#scrim"), dust=$("#dust"), track=$("#track");
var service="Door repair", ctx=null, channel="text";
var req={service:"",name:"",phone:"",address:"",note:"",email:"",date:"",slot:"",when:""};
var pick={date:null,slot:null}, cal={y:0,m:0}, leadKey="";

function thud(){
  try{
    ctx = ctx || new (window.AudioContext||window.webkitAudioContext)();
    var o=ctx.createOscillator(), g=ctx.createGain(), t=ctx.currentTime;
    o.type="sine"; o.frequency.setValueAtTime(120,t); o.frequency.exponentialRampToValueAtTime(38,t+.18);
    g.gain.setValueAtTime(.7,t); g.gain.exponentialRampToValueAtTime(.001,t+.25);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t+.26);
  }catch(e){}
}
function slam(){
  if(navigator.vibrate){try{navigator.vibrate(35)}catch(e){}}
  thud();
  var pg=$("#page"); pg.classList.remove("shake"); void pg.offsetWidth; pg.classList.add("shake");
  dust.classList.remove("go"); void dust.offsetWidth; dust.classList.add("go");
  setTimeout(function(){pg.classList.remove("shake")},300);
}
document.addEventListener("pointerdown",function(e){
  var b=e.target.closest(".slam,.svc button,.chip,.day,#close,#tk-close");
  if(b) slam();
});

function lockScroll(on){document.documentElement.style.overflow = on ? "hidden" : ""}
function post(url,data){
  return fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}).catch(function(){});
}

/* ---------- field checks: say what each box needs, in plain words ---------- */
var MSG={
  nm:"Enter your name, like Jordan Smith.",
  ph:"Enter a 10-digit phone, like (443) 555-0123.",
  ad:"Enter the street address where we’re coming, like 412 Frederick Rd, Catonsville.",
  em:"Enter a valid email address, like name@example.com."
};
var CHECK={
  nm:function(v){return v.length>=2 && /[A-Za-z]{2}/.test(v) && !/\d/.test(v)},
  ph:function(v){return v.replace(/\D/g,"").length===10},
  ad:function(v){return v.length>=6 && /\d/.test(v) && /[A-Za-z]{2}/.test(v)},
  em:function(v){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)}
};
function showErr(el,msg){
  var e=$("#e-"+el.id);
  el.setAttribute("aria-invalid","true");
  if(e){e.textContent=msg; e.classList.add("on")}
}
function clearErr(el){
  var e=$("#e-"+el.id);
  el.removeAttribute("aria-invalid");
  if(e){e.textContent=""; e.classList.remove("on")}
}
/* Checks every listed field, shows all problems at once, focuses the first one. */
function validate(ids){
  var first=null;
  ids.forEach(function(id){
    var el=$("#"+id);
    if(CHECK[id](el.value.trim())) clearErr(el);
    else{ showErr(el,MSG[id]); if(!first) first=el; }
  });
  if(first) first.focus();
  return !first;
}
$$("input").forEach(function(i){i.addEventListener("input",function(){clearErr(i)})});

/* Phone: numbers only, formatted as you type. Letters get a clear message. */
$("#ph").addEventListener("input",function(){
  var raw=this.value, d=raw.replace(/\D/g,"");
  if(d.length===11 && d.charAt(0)==="1") d=d.slice(1);
  d=d.slice(0,10);
  this.value = d.length>6 ? "("+d.slice(0,3)+") "+d.slice(3,6)+"-"+d.slice(6)
             : d.length>3 ? "("+d.slice(0,3)+") "+d.slice(3)
             : d.length>0 ? "("+d : "";
  if(/[A-Za-z]/.test(raw)) showErr(this,"Numbers only, like (443) 555-0123.");
});

/* ---------- booking sheet: details -> time -> confirmation ---------- */
function screen(n){
  ["form","when","ok"].forEach(function(id){$("#"+id).style.display = id===n ? "block" : "none"});
  sheet.scrollTop=0;
}
function setService(s){
  service=s;
  $("#f-nt").style.display = s==="Not sure, help me" ? "block" : "none";
  $$("#chips .chip").forEach(function(c){c.setAttribute("aria-pressed",c.textContent===s?"true":"false")});
}
function openSheet(s){
  if(s) setService(s);
  pick={date:null,slot:null}; leadKey="";
  $$(".fld input").forEach(clearErr);
  screen("form");
  scrim.classList.add("open"); sheet.classList.add("open");
  lockScroll(true);
}
function closeSheet(){scrim.classList.remove("open");sheet.classList.remove("open");lockScroll(false)}

$$("[data-book]").forEach(function(b){
  b.addEventListener("click",function(){openSheet(b.dataset.svc)});
});
$$("#chips .chip").forEach(function(c){
  c.addEventListener("click",function(){setService(c.textContent)});
});
$("#close").addEventListener("click",closeSheet);
scrim.addEventListener("click",closeSheet);

/* Step 1: details. Saved right away, so you have the lead even if they stop here. */
$("#send").addEventListener("click",function(){
  if(!validate(["nm","ph","ad"])) return;
  var n=$("#nm"), p=$("#ph"), a=$("#ad");
  req={service:service,name:n.value.trim(),phone:p.value.trim(),address:a.value.trim(),note:$("#nt").value.trim(),email:"",date:"",slot:"",when:""};
  var key=JSON.stringify([req.service,req.name,req.phone,req.address,req.note]);
  if(key!==leadKey){ post("/api/request",req); leadKey=key; }
  openWhen();
});

/* ---------- Step 2: calendar and arrival window ---------- */
function pad(n){return (n<10?"0":"")+n}
function iso(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
function parseIso(s){var p=s.split("-");return new Date(+p[0],+p[1]-1,+p[2])}
function label(d){return d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}
function today0(){var n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate())}
var AV=null; /* real availability from Jobber: {"2026-11-02":[0,2]} = windows taken. null = not loaded (demo mode). */
function loadAvail(cb){
  var t0=today0(), last=new Date(t0); last.setDate(last.getDate()+BIZ.ahead);
  fetch("/api/availability?from="+iso(t0)+"&to="+iso(last)).then(function(r){return r.json()}).then(function(j){
    AV = j&&j.ok ? j.taken : null; cb&&cb();
  }).catch(function(){AV=null; cb&&cb()});
}
function busy(d,i){
  if(AV) return (AV[iso(d)]||[]).indexOf(i)>-1;var n=d.getFullYear()*372+d.getMonth()*31+d.getDate();return (n*7+i*13)%10<2}
function winOpen(d,i){
  var start=new Date(d.getFullYear(),d.getMonth(),d.getDate(),BIZ.windows[i].h);
  return (start-new Date())>=BIZ.lead*36e5 && !busy(d,i);
}
function dayOpen(d){
  var t0=today0(), last=new Date(t0); last.setDate(last.getDate()+BIZ.ahead);
  if(d<t0||d>last) return false;
  if(BIZ.days.indexOf(d.getDay())<0) return false;
  return BIZ.windows.some(function(w,i){return winOpen(d,i)});
}
function firstOpenDay(){
  var t0=today0();
  for(var i=0;i<=BIZ.ahead;i++){var d=new Date(t0);d.setDate(t0.getDate()+i);if(dayOpen(d)) return d}
  return t0;
}
function renderCal(){
  var first=new Date(cal.y,cal.m,1), lead=first.getDay(), count=new Date(cal.y,cal.m+1,0).getDate();
  var todayIso=iso(new Date()), h="", i;
  $("#cal-month").textContent=MONTHS[cal.m]+" "+cal.y;
  for(i=0;i<lead;i++) h+="<span></span>";
  for(i=1;i<=count;i++){
    var dt=new Date(cal.y,cal.m,i), k=iso(dt);
    h+='<button class="day'+(k===todayIso?" today":"")+'" data-d="'+k+'" aria-pressed="'+(pick.date===k)+'" aria-label="'+label(dt)+'"'+(dayOpen(dt)?"":" disabled")+">"+i+"</button>";
  }
  $("#cal-grid").innerHTML=h;
  var t0=today0(), last=new Date(t0), idx=cal.y*12+cal.m;
  last.setDate(last.getDate()+BIZ.ahead);
  $("#cal-prev").disabled = idx <= t0.getFullYear()*12+t0.getMonth();
  $("#cal-next").disabled = idx >= last.getFullYear()*12+last.getMonth();
}
function renderSlots(){
  var h="";
  if(pick.date){
    var d=parseIso(pick.date);
    BIZ.windows.forEach(function(w,i){
      h+='<button class="chip" data-i="'+i+'" aria-pressed="'+(pick.slot===w.l)+'"'+(winOpen(d,i)?"":" disabled")+">"+w.l+"</button>";
    });
  }
  $("#slots").innerHTML=h;
}
function updatePick(){
  var d=pick.date?parseIso(pick.date):null;
  $("#pick").textContent = !d ? "Pick a day" : (pick.slot ? label(d)+" · "+pick.slot : label(d)+" · pick a window");
  $("#lock").disabled = !pick.slot;
}
function openWhen(){
  if(!pick.date){
    var f=firstOpenDay();
    pick={date:iso(f),slot:null};
    cal={y:f.getFullYear(),m:f.getMonth()};
  }
  $("#when-sum").textContent=req.service+" · "+req.address;
  renderCal(); renderSlots(); updatePick();
  screen("when");
  loadAvail(function(){
    if(pick.date && !dayOpen(parseIso(pick.date))){ var f=firstOpenDay(); pick={date:iso(f),slot:null}; cal={y:f.getFullYear(),m:f.getMonth()}; }
    renderCal(); renderSlots(); updatePick();
  });
}
$("#back").addEventListener("click",function(){screen("form")});
$("#cal-prev").addEventListener("click",function(){cal.m--; if(cal.m<0){cal.m=11;cal.y--} renderCal()});
$("#cal-next").addEventListener("click",function(){cal.m++; if(cal.m>11){cal.m=0;cal.y++} renderCal()});
$("#cal-grid").addEventListener("click",function(e){
  var b=e.target.closest(".day"); if(!b||b.disabled) return;
  pick.date=b.dataset.d; pick.slot=null;
  renderCal(); renderSlots(); updatePick();
  $("#slots").scrollIntoView({block:"nearest",behavior:"smooth"});
});
$("#slots").addEventListener("click",function(e){
  var b=e.target.closest(".chip"); if(!b||b.disabled) return;
  pick.slot=BIZ.windows[+b.dataset.i].l;
  renderSlots(); updatePick();
});

/* Step 3: lock it in */
$("#lock").addEventListener("click",function(){
  if(!pick.slot) return;
  req.date=pick.date; req.slot=pick.slot; req.when=label(parseIso(pick.date))+" · "+pick.slot;
  req.track="";
  req.saving=fetch("/api/schedule",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:req.phone,date:req.date,slot:req.slot,photos:photoIds.join(",")})})
    .then(function(r){return r.json()}).then(function(j){req.track=(j&&j.track)||""}).catch(function(){});
  if(JOBBER_REQUEST_URL){
    var u=JOBBER_REQUEST_URL+(JOBBER_REQUEST_URL.indexOf("?")>-1?"&":"?")+"service="+encodeURIComponent(service)+"&date="+encodeURIComponent(req.date)+"&window="+encodeURIComponent(req.slot);
    window.open(u,"_blank","noopener");
  }
  $("#ok-p").textContent=req.when+". Where should we send updates?";
  screen("ok");
});

/* ---------- how should we send updates ---------- */
$$("#chan .chip").forEach(function(c){
  c.addEventListener("click",function(){
    channel=c.dataset.ch;
    $$("#chan .chip").forEach(function(x){x.setAttribute("aria-pressed",x===c?"true":"false")});
    $("#f-em").style.display = channel==="email" ? "block" : "none";
    if(channel==="email") $("#em").focus();
  });
});
$("#seeupd").addEventListener("click",function(){
  var em=$("#em");
  if(channel==="email" && !validate(["em"])) return;
  req.email = channel==="email" ? em.value.trim() : "";
  var btn=$("#seeupd"); btn.disabled=true;
  Promise.resolve(req.saving).then(function(){
    return post("/api/prefs",{phone:req.phone,channel:channel,email:req.email,t:(req.track.split("/t/")[1]||"")});
  }).then(function(){
    if(req.track){ location.href=req.track; return; } /* the customer's own live tracking page */
    btn.disabled=false; closeSheet(); openTrack(0); startPoll();
  });
});

/* ---------- customer tracker (what the update link opens) ---------- */
function whenText(){return req.when||"Tomorrow · 2–4 PM"}
var STEPS=[
  {t:"Request received", big:function(){return whenText()}, sub:function(v){return "We’ll "+v+" you to confirm within 15 minutes."}},
  {t:"Time confirmed",   big:function(){return whenText()}, sub:function(v){return "We’ll "+v+" you when we’re on the way."}},
  {t:"We’re on the way", big:function(){return "About 20 min away"}, sub:function(){return "Arriving in your "+(req.slot||"2–4 PM")+" window. Tap call if you need us."}},
  {t:"All done",         big:function(){return "Visit complete"}, sub:function(){return "Thanks for choosing us. Tap call if you need anything."}}
];
function showStep(i){
  var s=STEPS[i];
  $("#tk-title").textContent=s.t;
  $("#tk-big").textContent=s.big();
  $("#tk-sub").textContent=s.sub(channel==="email"?"email":"text");
  $$("#tk-seg i").forEach(function(el,k){el.className = k<i ? "done" : (k===i ? "now" : "")});
  $$("#tk-names span").forEach(function(el,k){el.className = k<=i ? "on" : ""});
  $$("#tk-demo .chip").forEach(function(el,k){el.setAttribute("aria-pressed",k===i?"true":"false")});
  $("#tk-addr").textContent=req.address||"123 Frederick Rd, Catonsville";
  $("#tk-svc").textContent=(req.service||"Spring replacement")+" · "+whenText();
  var to = channel==="email" ? (req.email||"your email") : (req.phone||"your phone");
  $("#tk-via").textContent="Updates go to "+to+" by "+(channel==="email"?"email":"text")+".";
  $("#tk-call").href="tel:"+COMPANY_PHONE;
}
function openTrack(i){
  showStep(i||0);
  track.classList.add("open"); track.setAttribute("aria-hidden","false");
  track.scrollTop=0; lockScroll(true);
}
var poller=null;
function stopPoll(){if(poller){clearInterval(poller);poller=null}}
/* Ask the server (which asks Jobber) where the appointment stands, and move the progress bar to match. */
function pollStatus(){
  if(!req.phone) return;
  fetch("/api/status?phone="+encodeURIComponent(req.phone)).then(function(r){return r.json()}).then(function(s){
    if(!s||!s.known||!track.classList.contains("open")) return;
    if(s.step>live) { live=s.step; showStep(live); }
  }).catch(function(){});
}
var live=0;
function startPoll(){ stopPoll(); live=0; pollStatus(); poller=setInterval(pollStatus,15000); }
function closeTrack(){stopPoll();track.classList.remove("open");track.setAttribute("aria-hidden","true");lockScroll(false)}
$("#tk-close").addEventListener("click",closeTrack);
$$("#tk-demo .chip").forEach(function(c,k){c.addEventListener("click",function(){showStep(k)})});

document.addEventListener("keydown",function(e){
  if(e.key==="Escape"){ if(track.classList.contains("open")) closeTrack(); else closeSheet(); }
});

/* Direct link for previews: yoursite/#track, or #track3 to jump to step 3 */
var m=/^#track([1-4])?$/.exec(location.hash||"");
if(m) openTrack(m[1]?parseInt(m[1],10)-1:0);


/* ---------- photos: shrink on the phone, then upload ---------- */
var photoIds=[];
function shrink(file,cb){
  var img=new Image(), url=URL.createObjectURL(file);
  img.onload=function(){
    var s=Math.min(1,1280/Math.max(img.width,img.height)), c=document.createElement("canvas");
    c.width=Math.round(img.width*s); c.height=Math.round(img.height*s);
    c.getContext("2d").drawImage(img,0,0,c.width,c.height);
    URL.revokeObjectURL(url); cb(c.toDataURL("image/jpeg",0.72));
  };
  img.onerror=function(){URL.revokeObjectURL(url); cb(null)};
  img.src=url;
}
$("#ph-in").addEventListener("change",function(e){
  var files=[].slice.call(e.target.files).slice(0,3-photoIds.length); e.target.value="";
  files.forEach(function(f){
    shrink(f,function(data){
      if(!data) return;
      var th=document.createElement("span"); th.className="up"; th.style.backgroundImage="url("+data+")";
      $("#ph-th").appendChild(th);
      fetch("/api/photo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data:data})})
        .then(function(r){return r.json()}).then(function(j){
          if(!j||!j.id){th.remove();return}
          photoIds.push(j.id); th.className="";
          var x=document.createElement("b"); x.textContent="×"; x.setAttribute("aria-label","Remove photo");
          x.onclick=function(){photoIds=photoIds.filter(function(i){return i!==j.id}); th.remove()};
          th.appendChild(x);
        }).catch(function(){th.remove()});
    });
  });
});

/* ---------- service area check (we still take the request either way) ---------- */
var ZIPS=["21228","21250","21227","21229","21207","21244","21043","21042","21075","21133","21223","21216","21215"];
$("#ad").addEventListener("input",function(){
  var z=(/\b(\d{5})\b/.exec(this.value)||[])[1], n=$("#zipnote");
  if(z && ZIPS.indexOf(z)<0){ n.textContent="That ZIP looks a little outside our usual area. You can still book and we’ll call to confirm."; n.className="zipnote on"; }
  else if(z){ n.textContent="Great, you’re in our service area."; n.className="zipnote on"; }
  else n.className="zipnote";
});

/* ---------- price estimator ---------- */
var EST={
  door:[[1099,1399,1799],[1499,1899,2499]],   /* [size][style] installed, old door hauled away */
  opener:[299,379,449]
};
var est={w:"door",size:0,style:0,drive:0};
function money(n){return "$"+n.toString().replace(/\B(?=(\d{3})+(?!\d))/g,",")}
function paintEst(){
  var p = est.w==="door" ? EST.door[est.size][est.style] : EST.opener[est.drive];
  $("#est-price").textContent=money(p);
  $("#est-note").textContent = est.w==="door" ? "installed, old door hauled away" : "installed, remotes and keypad set up";
  $("#est-door").style.display = est.w==="door" ? "" : "none";
  $("#est-opener").style.display = est.w==="opener" ? "" : "none";
}
function pickGroup(id,key,num){
  $$(id+" .chip").forEach(function(c){c.addEventListener("click",function(){
    est[key] = num ? +c.dataset.i : c.dataset.w;
    $$(id+" .chip").forEach(function(x){x.setAttribute("aria-pressed",x===c?"true":"false")});
    paintEst();
  })});
}
pickGroup("#est-what","w",false); pickGroup("#est-size","size",true); pickGroup("#est-style","style",true); pickGroup("#est-drive","drive",true);
$("#est-book").addEventListener("click",function(){openSheet(est.w==="door"?"New door install":"Opener install")});
