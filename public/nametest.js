(function(){
if(location.search.indexOf("names")<0)return;
var N=[["Patapsco", "Garage Door Co."], ["Catonsville", "Garage Door Company"], ["Mainspring", "Garage Door Co."], ["Steadfast", "Garage Door Co."], ["Hometown", "Garage Door Service"], ["Springhouse", "Garage Doors"], ["Dependable", "Door & Opener"], ["Trusted", "Garage Door Co."], ["Baltimore County", "Garage Door Co."], ["Old Frederick Road", "Garage Doors"], ["Clearspring", "Garage Doors"], ["Cornerstone", "Garage Door Co."], ["Landmark", "Garage Door Co."], ["Patriot", "Garage Door Co."]];
var i=0;try{i=+(localStorage.getItem("nn3")||0)}catch(e){}
var b=document.createElement("button");
b.style.cssText="position:fixed;right:8px;top:78px;z-index:999;background:#E8B02F;color:#12261F;border:2px solid #12261F;border-radius:8px;font:600 13px system-ui;padding:8px 10px";
document.body.appendChild(b);
function paint(){var n=N[i],lg=document.querySelector("header .logo > span");
if(lg)lg.innerHTML=n[0]+"<small>"+n[1].replace("&","&amp;")+"</small>";
var f=document.querySelector("footer strong");if(f)f.textContent=n[0]+" "+n[1];
b.textContent="Name "+(i+1)+"/"+N.length+": "+n[0]+" "+n[1];
try{localStorage.setItem("nn3",i)}catch(e){}}
b.onclick=function(){i=(i+1)%N.length;paint()};paint();
})();
