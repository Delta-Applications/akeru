
(function(){'use strict';var loader=LazyLoader;var isHoldingArrowUp=true;var isHoldingArrowDown=true;loader.load("js/navigation_map.js",function(){NavigationMap.init();});window.addEventListener("keydown",function(evt){handleKeydown(evt);if(evt.key==='ArrowUp'){isHoldingArrowUp=false;}else if(evt.key==='ArrowDown'){isHoldingArrowDown=false;}});window.addEventListener("keyup",function(evt){if(evt.key==='ArrowUp'){isHoldingArrowUp=true;}else if(evt.key==='ArrowDown'){isHoldingArrowDown=true;}});window.addEventListener("menuEvent",function(event){NavigationMap&&(NavigationMap.optionMenuVisible=event.detail.menuVisible);});function handleKeydown(evt){var el=evt.target,bestElementToFocus;if(typeof NavigationMap!='undefined'&&NavigationMap&&(NavigationMap.currentActivatedLength>0||NavigationMap.lockNavigation)){return;}
if((document.activeElement.type==='select-one')||(document.activeElement.type==='date')){return;}
if(evt.key==='Enter'||evt.key==='Accept'){handleClick(evt);}else{if(!evt.target.classList){return;}
if(!evt.target.classList.contains('focus')){el=document.querySelector('.focus');}
bestElementToFocus=findElementFromNavProp(el,evt);if(bestElementToFocus!=null){if(evt.key==='ArrowDown'&&!isHoldingArrowDown&&bestElementToFocus.offsetTop<el.offsetTop){evt.preventDefault();return;}
if(evt.key==='ArrowUp'&&!isHoldingArrowUp&&bestElementToFocus.offsetTop>el.offsetTop){evt.preventDefault();return;}
var prevFocused=document.querySelectorAll(".focus");if(bestElementToFocus==prevFocused[0]){return;}
if(prevFocused.length>0){prevFocused[0].classList.remove('focus');}
if(NavigationMap.scrollToElement===undefined){bestElementToFocus.scrollIntoView(false);}else{NavigationMap.scrollToElement(bestElementToFocus,evt);}
bestElementToFocus.classList.add('focus');if(NavigationMap.ignoreFocus==null||!NavigationMap.ignoreFocus){bestElementToFocus.focus();evt.preventDefault();}
document.dispatchEvent(new CustomEvent("focusChanged",{detail:{focusedElement:bestElementToFocus}}));}}}
function findElementFromNavProp(currentlyFocused,evt){var elementID;if(currentlyFocused==null){return null;}
if(NavigationMap!=undefined&&NavigationMap.disableNav!=undefined&&NavigationMap.disableNav)
return null;var elmStyle=currentlyFocused.style;let isRtl=document.dir==='rtl';let key=evt.key;let keyMap={'ArrowLeft':'--nav-left','ArrowRight':'--nav-right','ArrowUp':'--nav-up','ArrowDown':'--nav-down','Home':'--nav-home','MozHomeScreen':'--nav-home'};switch(key){case'ArrowLeft':case'ArrowRight':if(isRtl){key=(key==='ArrowLeft')?'ArrowRight':'ArrowLeft';}
elementID=elmStyle.getPropertyValue(keyMap[key]);break;case'ArrowUp':case'ArrowDown':case'Home':case'MozHomeScreen':elementID=elmStyle.getPropertyValue(keyMap[key]);break;}
if(!elementID){return null;}
var selector="[data-nav-id=\""+elementID+"\"]";return document.querySelector(selector);}
function handleClick(evt){var el=document.querySelector('.focus');el&&el.focus();if(NavigationMap&&NavigationMap.optionMenuVisible&&!evt.target.classList.contains('menu-button')){var selectedMenuElement=document.querySelector('menu button.menu-button');selectedMenuElement&&selectedMenuElement.click&&selectedMenuElement.click();}else if(NavigationMap&&NavigationMap.handleClick){NavigationMap.handleClick(evt);}else{evt.target.click();for(var i=0;i<evt.target.children.length;i++){evt.target.children[i].click();}}}})();