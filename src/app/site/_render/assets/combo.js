(function(){var c=document.getElementById("combos"),m=document.getElementById("myDIV");
c.tabIndex=0;m.tabIndex=-1;c.setAttribute("role","button");c.setAttribute("aria-controls","myDIV");c.setAttribute("aria-expanded","false");
function show(){var r=c.getBoundingClientRect();m.style.left="0px";m.style.top="0px";var o=m.getBoundingClientRect();
m.style.left=(r.left-o.left)+"px";m.style.top=(r.bottom-o.top)+"px";m.classList.add("forg-open");c.setAttribute("aria-expanded","true");}
function hide(){m.classList.remove("forg-open");c.setAttribute("aria-expanded","false");}
[c,m].forEach(function(e){
e.addEventListener("pointerenter",show);
e.addEventListener("pointerleave",function(v){if(v.pointerType==="mouse"&&!document.querySelector("#combos:focus-visible,#myDIV :focus-visible"))hide();});
e.addEventListener("focusin",show);
e.addEventListener("focusout",function(v){if(!m.contains(v.relatedTarget))hide();});});
document.addEventListener("pointerdown",function(v){if(!c.contains(v.target)&&!m.contains(v.target))hide();});
document.addEventListener("keydown",function(v){if(v.key!=="Escape")return;if(m.contains(document.activeElement))c.focus();hide();});
window.addEventListener("resize",function(){if(m.classList.contains("forg-open"))show();});})();