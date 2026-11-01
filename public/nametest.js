(function(){
if(location.search.indexOf("names")<0)return;
var N=[["Patapsco", "Spring & Door"], ["Patapsco", "Garage Doors"], ["Patapsco Valley", "Overhead Doors"], ["Rolling Road", "Garage Doors"], ["Relay", "Spring & Door"], ["Viaduct", "Garage Doors"], ["Herbert Run", "Spring & Door"], ["Gwynns Falls", "Garage Doors"], ["Soapstone", "Spring & Door"], ["Ellicott Mills", "Garage Doors"], ["Oella Mill", "Spring & Door"], ["Frederick Road", "Garage Doors"], ["Springline", "Garage Co."]];
var i=0;try{i=+(localStorage.getItem("nn")||0)}catch(e){}
var b=document.createElement("button");
b.style.cssText="position:fixed;right:8px;top:78px;z-index:999;background:#E8B02F;color:#12261F;border:2px solid #12261F;border-radius:8px;font:600 13px system-ui;padding:8px 10px";
document.body.appendChild(b);
function paint(){var n=N[i],lg=document.querySelector("header .logo > span");
if(lg)lg.innerHTML=n[0]+"<small>"+n[1]+"</small>";
var f=document.querySelector("footer strong");if(f)f.textContent=n[0]+" "+n[1];
b.textContent="Name "+(i+1)+"/"+N.length+": "+n[0]+" "+n[1];
try{localStorage.setItem("nn",i)}catch(e){}}
b.onclick=function(){i=(i+1)%N.length;paint()};paint();
})();
