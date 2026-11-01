(function(){
if(location.search.indexOf("design")<0)return;
var T=[
["Current",null],
["Navy + orange",{ink:"#0B1F3A",blue:"#D6E2F0",at:"#1F4E8C",cta:"#F26A21",on:"#FFFFFF",gun:"#3A4655",sf:"#F4F6F9",red:"#C8372D",ban:"#E6EDF5",dk:"#0B1F3A"}],
["Charcoal + red",{ink:"#1B1F24",blue:"#E3E6EA",at:"#B3282D",cta:"#C8262C",on:"#FFFFFF",gun:"#3B4148",sf:"#F5F5F6",red:"#C8262C",ban:"#EDEEF0",dk:"#1B1F24"}],
["Forest + amber",{ink:"#12261F",blue:"#DCE9E2",at:"#1F6B4F",cta:"#E8B02F",on:"#12261F",gun:"#33433C",sf:"#F3F7F4",red:"#B8402F",ban:"#E4EEE8",dk:"#12261F"}],
["Black + gold",{ink:"#111111",blue:"#EFE9D8",at:"#8A6A12",cta:"#F2B705",on:"#111111",gun:"#2B2B2B",sf:"#F7F5EF",red:"#B3382C",ban:"#F1ECDD",dk:"#111111"}]];
var N=[["Optimus","Garage Company"],["Torsion","Garage Doors"],["Trackline","Garage Doors"],["Springline","Garage Co."],["Apex Overhead","Door Company"],["Liftwell","Garage Doors"],["Counterbalance","Garage Doors"],["Overhead","Garage Pros"],["Panelworks","Garage Doors"]];
function g(k,d){try{return +(localStorage.getItem(k)||d)}catch(e){return d}}
function s(k,v){try{localStorage.setItem(k,v)}catch(e){}}
var ti=g("dt",0),ni=g("dn",0);
var st=document.createElement("style");document.head.appendChild(st);
var box=document.createElement("div");
box.style.cssText="position:fixed;right:8px;top:78px;z-index:999;display:grid;gap:6px";
function mk(){var b=document.createElement("button");b.style.cssText="background:#F5CB45;color:#0A1A3A;border:3px solid #0A1A3A;font:800 13px system-ui;padding:7px 9px;text-align:left";box.appendChild(b);return b}
var bt=mk(),bn=mk();document.body.appendChild(box);
function paint(){
 var t=T[ti],c=t[1];
 if(!c){st.textContent="";}else{
  document.documentElement.setAttribute("data-theme","light");
  st.textContent=":root{--ink:"+c.ink+";--line:"+c.ink+";--blue:"+c.blue+";--on-blue:"+c.ink+";--accent-text:"+c.at+";--gold:"+c.cta+";--on-gold:"+c.on+";--gun:"+c.gun+";--surface:"+c.sf+";--red:"+c.red+";--red-text:"+c.red+";--muted:#4B5668}.banner{background-color:"+c.ban+"!important}.final{background-color:"+c.dk+"!important}.final::before{display:none}footer{background:"+c.gun+"}";
 }
 bt.textContent="Colors "+(ti+1)+"/"+T.length+": "+t[0];
 var n=N[ni],lg=document.querySelector("header .logo > span");
 if(lg)lg.innerHTML=n[0]+"<small>"+n[1]+"</small>";
 bn.textContent="Name "+(ni+1)+"/"+N.length+": "+n[0]+" "+n[1];
 s("dt",ti);s("dn",ni);
}
bt.onclick=function(){ti=(ti+1)%T.length;paint()};
bn.onclick=function(){ni=(ni+1)%N.length;paint()};
paint();
})();
