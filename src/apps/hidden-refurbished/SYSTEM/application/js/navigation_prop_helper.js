
(function(exports){if(exports.NavigationPropHelper)
return;var _attrNavId="data-nav-id";var _styleNavU="--nav-up";var _styleNavD="--nav-down";var _styleNavL="--nav-left";var _styleNavR="--nav-right";var _nav_focus="nav-focus";var _nav_focus_selector=".nav-focus";var _NAV_ID=0;var _RegistrarPool=[];var _deactivedInstance=false;function generateNavId(){return'-'+_NAV_ID++;};function initNavProperty(elem,instanceId){elem.style.setProperty(_styleNavU,-1);elem.style.setProperty(_styleNavD,-1);elem.style.setProperty(_styleNavL,-1);elem.style.setProperty(_styleNavR,-1);elem.setAttribute(_attrNavId,instanceId+generateNavId());};function getInstanceId(elem){var navId=elem.getAttribute(_attrNavId);var index=navId.lastIndexOf("-");if(-1!==index){return navId.substr(0,index);}};function setNavLeftProperty(elem,left){if(typeof(left)==='object')
elem.style.setProperty(_styleNavL,left.getAttribute(_attrNavId));else
elem.style.setProperty(_styleNavL,left);};function setNavRightProperty(elem,right){if(typeof(right)==='object')
elem.style.setProperty(_styleNavR,right.getAttribute(_attrNavId));else
elem.style.setProperty(_styleNavR,right);};function setNavDownProperty(elem,down){if(typeof(down)==='object')
elem.style.setProperty(_styleNavD,down.getAttribute(_attrNavId));else
elem.style.setProperty(_styleNavD,down);};function setNavUpProperty(elem,up){if(typeof(up)==='object')
elem.style.setProperty(_styleNavU,up.getAttribute(_attrNavId));else
elem.style.setProperty(_styleNavU,up);};function handkeyEvent(evt){var property=translateKeyToNavProperty(evt.key?evt.key:evt.keyIdentifier);if(property){var focusNode=queryFocus();if(focusNode){var targetId=focusNode.style.getPropertyValue(property);if(targetId){var selector="[data-nav-id=\""+targetId+"\"]";var target=document.querySelector(selector);if(target){var instance=getInstanceId(focusNode);if(instance===_deactivedInstance)
return;focusNode.classList.remove(_nav_focus);target.classList.add(_nav_focus);instance=getInstanceId(target);if(typeof _RegistrarPool[instance]==='function')
_RegistrarPool[instance]({status:'focusedChanged',old_focus:focusNode,new_focus:target});}}}}}
function translateKeyToNavProperty(key){var property=null;switch(key){case'ArrowLeft':case'Left':property=_styleNavL;break;case'ArrowRight':case'Right':property=_styleNavR;break;case'ArrowUp':case'Up':property=_styleNavU;break;case'ArrowDown':case'Down':property=_styleNavD;break;default:break;}
return property;}
function queryFocus(){var node=document.querySelectorAll(_nav_focus_selector);if(node&&node.length){if(node.length>1){console.error(" Nav can only has one focused node!!!");return null;}
else{return node[0];}}
return null;}
var NavigationPropHelper={addHorzNavProperty:function(elements,instanceId,focusChangedCB){if(!elements||!instanceId){return;}
initNavProperty(elements[0],instanceId);var number=elements.length;for(var i=1;i<number;++i){initNavProperty(elements[i],instanceId);setNavLeftProperty(elements[i],elements[i-1]);setNavRightProperty(elements[i-1],elements[i]);}
setNavLeftProperty(elements[0],elements[number-1]);setNavRightProperty(elements[number-1],elements[0]);if(typeof focusChangedCB==='function'){_RegistrarPool[instanceId]=focusChangedCB;}},addVertNavProperty:function(elements,instanceId,focusChangedCB){if(!elements||!instanceId){return;}
initNavProperty(elements[0],instanceId);var number=elements.length;for(var i=1;i<number;++i){initNavProperty(elements[i],instanceId);setNavUpProperty(elements[i],elements[i-1]);setNavDownProperty(elements[i-1],elements[i]);}
setNavUpProperty(elements[0],elements[number-1]);setNavDownProperty(elements[number-1],elements[0]);if(typeof focusChangedCB==='function'){_RegistrarPool[instanceId]=focusChangedCB;}},setFocus:function(elem){this.clearFocus();elem.classList.add(_nav_focus);},clearFocus:function(){var nodes=document.querySelectorAll(_nav_focus_selector);var length=nodes.length;for(var i=0;i<length;++i){nodes[i].classList.remove(_nav_focus);}},getFocused:function(){return queryFocus();},active:function(name,bActived){if(arguments[0]===undefined){return;}
if(arguments[1]===undefined)
bActived=true;if(bActived){if(name!==_deactivedInstance)
return;else
_deactivedInstance=false;}
else{_deactivedInstance=name;}},};if(document.activeElement.getAttribute('mozbrowser')){window.addEventListener('keydown',handkeyEvent);}else{window.addEventListener('mozbrowserbeforekeydown',handkeyEvent);}
exports.NavigationPropHelper=NavigationPropHelper;})(window);