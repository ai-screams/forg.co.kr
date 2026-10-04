document.querySelectorAll("select[data-goto]").forEach(function(s){
s.addEventListener("change",function(){var o=s.options[s.selectedIndex];
if(!o.hasAttribute("value"))return;
var t=s.getAttribute("data-goto");
if(t==="blank")window.open(o.value,"win1");else(t==="parent"?window.parent:window).location.href=o.value;});});