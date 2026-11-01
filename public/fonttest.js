(function(){
if(location.search.indexOf("fonts")<0)return;
var P=[["Bebas Neue","Roboto","Bebas+Neue&family=Roboto:wght@500;700"],
["Bebas Neue","Manrope","Bebas+Neue&family=Manrope:wght@500;600;700"],
["Bebas Neue","Plus Jakarta Sans","Bebas+Neue&family=Plus+Jakarta+Sans:wght@500;600;700"],
["Bebas Neue","DM Sans","Bebas+Neue&family=DM+Sans:wght@500;600;700"],
["Bebas Neue","Outfit","Bebas+Neue&family=Outfit:wght@500;600;700"],
["Bebas Neue","Figtree","Bebas+Neue&family=Figtree:wght@500;600;700"],
["Bebas Neue","Barlow","Bebas+Neue&family=Barlow:wght@500;600;700"]];
var i=0;try{i=+(localStorage.getItem("fi")||0)}catch(e){}
var st=document.createElement("style");document.head.appendChild(st);
var b=document.createElement("button");
b.style.cssText="position:fixed;right:10px;top:84px;z-index:999;background:#F5CB45;color:#0A1A3A;border:3px solid #0A1A3A;font:800 14px system-ui;padding:8px 10px;max-width:70vw";
document.body.appendChild(b);
function go(){var p=P[i%P.length];
var l=document.createElement("link");l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?family="+p[2]+"&display=swap";document.head.appendChild(l);
st.textContent=":root{--fd:'"+p[0]+"';--fb:'"+p[1]+"'}";
b.textContent="Aa "+(i%P.length+1)+"/"+P.length+": "+p[0]+" + "+p[1]+" (tap)";
try{localStorage.setItem("fi",i%P.length)}catch(e){}}
b.onclick=function(){i=(i+1)%P.length;go()};go();
})();
