(function(){
var root=document.documentElement,doc=document.getElementById("forg-doc");
var narrow=window.matchMedia("(max-width:799px)"),queued=false,width=-1;
function size(img){return Number(img.getAttribute("width"))||img.naturalWidth;}
function crushed(){var imgs=doc.querySelectorAll("img[data-forg-big]");
for(var i=0;i<imgs.length;i++){var w=size(imgs[i]),shown=imgs[i].getBoundingClientRect().width;
if(w<=300&&shown<w*0.6)return true;}return false;}
function lines(td,range){var walk=document.createTreeWalker(td,NodeFilter.SHOW_TEXT),top=Infinity,bottom=-Infinity,node,box;
while((node=walk.nextNode())){range.selectNodeContents(node);box=range.getBoundingClientRect();
if(box.height){top=Math.min(top,box.top);bottom=Math.max(bottom,box.bottom);}}return bottom-top;}
function stack(){var tds=doc.getElementsByTagName("td"),range=document.createRange();
for(var pass=0,added=true;added&&pass<4;pass++){added=false;
for(var i=0;i<tds.length;i++){var td=tds[i],w=td.getBoundingClientRect().width;
if(w>=90||(td.innerText||"").trim().length<20||lines(td,range)<=2*w)continue;
var cells=td.parentNode.children;
for(var j=0;j<cells.length;j++)if(cells[j].getBoundingClientRect().width>=150){td.closest("table").setAttribute("data-forg-stack","");added=true;break;}}}}
function fit(){queued=false;width=root.clientWidth;
root.classList.remove("forg-fit-shrink");doc.style.removeProperty("zoom");doc.style.display="contents";
var stacked=doc.querySelectorAll("table[data-forg-stack]");
for(var i=0;i<stacked.length;i++)stacked[i].removeAttribute("data-forg-stack");
if(!narrow.matches)return;
stack();
if(root.scrollWidth<=width)return;
var imgs=doc.getElementsByTagName("img");
for(var i=0;i<imgs.length;i++)if(size(imgs[i])>120)imgs[i].setAttribute("data-forg-big","");
root.classList.add("forg-fit-shrink");
if(crushed())root.classList.remove("forg-fit-shrink");
for(var n=0;n<3&&root.scrollWidth>width;n++){doc.style.display="block";
var z=(Number(doc.style.zoom)||1)*(width-16)/(root.scrollWidth-8);
doc.style.zoom=String(Math.floor(z*1000)/1000);}}
function queue(){if(!queued){queued=true;window.requestAnimationFrame(fit);}}
queue();
window.addEventListener("load",queue);
window.addEventListener("resize",function(){if(root.clientWidth!==width)queue();});
})();
