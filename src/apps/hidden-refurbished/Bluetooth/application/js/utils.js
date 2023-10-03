
function getTruncated(oldName,options){var maxLine=options.maxLine||2;var node=options.node;var ellipsisIndex=options.ellipsisIndex||3;var ellipsisCharacter=options.ellipsisCharacter||'...';if(node===null){return oldName;}
function hitsNewline(oldHeight,newHeight){return oldHeight!==newHeight;}
var newName='';var oldHeight;var newHeight;var baseHeight;var currentLine;var ellipsisAt;var hasNewEllipsisPoint=true;var nameBeforeEllipsis=[];var nameBeforeEllipsisString;var nameAfterEllipsis=oldName.slice(-ellipsisIndex);var realVisibility=node.style.visibility;var realWordBreak=node.style.wordBreak;node.style.visibility='hidden';node.style.wordBreak='break-all';node.textContent='.';baseHeight=node.clientHeight;node.textContent='';var needEllipsis=oldName.split('').some(function(character,index){nameBeforeEllipsis.push(character);nameBeforeEllipsisString=nameBeforeEllipsis.join('');oldHeight=node.clientHeight;node.textContent=nameBeforeEllipsisString+
ellipsisCharacter+nameAfterEllipsis;newHeight=node.clientHeight;if(index===0){currentLine=Math.floor(newHeight/baseHeight);}
if(hitsNewline(oldHeight,newHeight)&&index!==0){var testHeight;node.textContent=nameBeforeEllipsisString;testHeight=node.clientHeight;if(hitsNewline(oldHeight,testHeight)){hasNewEllipsisPoint=true;currentLine+=1;}else{if(hasNewEllipsisPoint){ellipsisAt=index;hasNewEllipsisPoint=false;}}}
if(currentLine>maxLine){if(index===0){console.log('Your string is in a overflowed situation, '+'please check your options');}
nameBeforeEllipsis.pop();node.textContent='';return true;}});node.style.visibility=realVisibility;node.style.wordBreak=realWordBreak;if(!needEllipsis){newName=oldName;}else{newName+=nameBeforeEllipsis.join('').slice(0,ellipsisAt);newName+=ellipsisCharacter;newName+=nameAfterEllipsis;}
return newName;}
(function(exports){var rdashes=/-(.)/g;var Utils={camelCase:function ut_camelCase(str){return str.replace(rdashes,function(str,p1){return p1.toUpperCase();});}};exports.Utils=Utils;}(this));if(typeof window.debug!=='function'){window.DEBUG_LEVEL=1;window.log=function(){if(window.DEBUG_LEVEL>0)
console.log.apply(console,arguments);};window.debug=function(){if(window.DEBUG_LEVEL>1)
console.log.apply(console,arguments);};}
if(typeof window.$!=='function'){window.$=function(id){return(typeof id==='string')?document.getElementById(id):id;};}
if(typeof window.lget!=='function'){window.lget=function(l10nId){return navigator.mozL10n.get(l10nId);};}
if(typeof String.prototype.startsWith!=='function'){String.prototype.startsWith=function(prefix){return prefix===this.slice(0,prefix.length);};}
if(typeof String.prototype.endsWith!=='function'){String.prototype.endsWith=function(postfix){var index=this.length-postfix.length;var lastIndex=this.indexOf(postfix,index);return lastIndex!==-1&&lastIndex===index;};}
if(typeof String.prototype.contains!=='function'){String.prototype.contains=function(substr){return-1!==this.indexOf(substr);};}
if(typeof Array.prototype.contains!=='function'){Array.prototype.contains=function(item){return-1!==this.indexOf(item);};}
if(typeof Object.prototype.setVisible!=='function'){Object.prototype.setVisible=function(visible){if(this.classList){if(visible){this.classList.remove('hidden');}else{this.classList.add('hidden');}}};}
var Message={show:function(l10nId,argValue){var args=undefined!==argValue?{n:argValue}:{};this.showEx(l10nId,args);},showEx:function(l10nId,args){var options={messageL10nId:l10nId,messageL10nArgs:args,latency:2000,useTransition:false};if(typeof Toaster==='undefined'){LazyLoader.load(['shared/js/toaster.js','shared/style/toaster.css'],()=>{Toaster.showToast(options);});}else{Toaster.showToast(options);}},};