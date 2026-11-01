(function(){
if(location.search.indexOf("accent")<0)return;
var A=[["Current amber","#E8B02F","#12261F"],["Copper","#C2652D","#FFFFFF"],["Brick red","#B8402F","#FFFFFF"],["Steel blue","#2E7FB8","#FFFFFF"],["Terracotta","#D9694A","#FFFFFF"],["Warm sand","#D9C7A0","#12261F"],["Soft white","#E8EEEA","#12261F"],["Bright teal","#1FA39A","#FFFFFF"]];
var i=0;try{i=+(localStorage.getItem("ac")||0)}catch(e){}
var st=document.createElement("style");document.head.appendChild(st);
var b=document.createElement("button");
b.style.cssText="position:fixed;right:8px;top:78px;z-index:999;background:#fff;color:#12261F;border:2px solid #12261F;border-radius:8px;font:600 13px system-ui;padding:8px 10px";
document.body.appendChild(b);
function paint(){var a=A[i];
st.textContent=":root,:root:not([data-theme=\"light\"]),:root[data-theme=\"dark\"]{--gold:"+a[1]+"!important;--on-gold:"+a[2]+"!important}";
b.innerHTML="<span style='display:inline-block;width:12px;height:12px;border-radius:50%;background:"+a[1]+";border:1px solid #12261F;margin-right:6px;vertical-align:-1px'></span>Accent "+(i+1)+"/"+A.length+": "+a[0];
try{localStorage.setItem("ac",i)}catch(e){}}
b.onclick=function(){i=(i+1)%A.length;paint()};paint();
})();
