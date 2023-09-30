'use strict';if(typeof window.debug!=='function'){window.DEBUG_LEVEL=0;window.log=function(){if(window.DEBUG_LEVEL>0)
console.log.apply(console,arguments);};window.debug=function(){if(window.DEBUG_LEVEL>1)
console.log.apply(console,arguments);};}
if(typeof window.$!=='function'){window.$=function(id){return(typeof id==='string')?document.getElementById(id):id;};}
if(typeof window.lget!=='function'){window.lget=function(l10nId){return navigator.mozL10n.get(l10nId);};}
if(typeof String.prototype.startsWith!=='function'){String.prototype.startsWith=function(prefix){return prefix===this.slice(0,prefix.length);};}
if(typeof String.prototype.contains!=='function'){String.prototype.contains=function(substr){return-1!==this.indexOf(substr);};}
if(typeof Array.prototype.contains!=='function'){Array.prototype.contains=function(item){return-1!==this.indexOf(item);};}
if(typeof Array.prototype.bsearch!=='function'){Array.prototype.bsearch=function(key,cmp){var low=0;var high=this.length-1;while(low<=high){var mid=low+high>>1;var result=cmp(key,this[mid]);if(result<0)high=mid-1;else if(result>0)low=mid+1;else return mid;}
return-1;}}
if(typeof Object.prototype.setVisible!=='function'){Object.prototype.setVisible=function(visible){if(this.classList){if(visible){if(this.classList.contains('hidden'))
this.classList.remove('hidden');}else{if(!this.classList.contains('hidden'))
this.classList.add('hidden');}}};}
if(typeof Object.prototype.clone!=='function'){Object.prototype.clone=function(){return JSON.parse(JSON.stringify(this));}}
var Utilities={bindClick:function(prefix,postfix,func,idParams,bindObj){if(undefined===bindObj)bindObj=null;for(var idParam of idParams){$(prefix+idParam[0]+postfix).onclick=func.bind(bindObj,idParam[1]);}},getLoopNum:function(min,max,num,increase,delta){var newNum;if(undefined===delta)delta=1;if(increase){if(num>=max){newNum=min;}else{num+=delta;newNum=(num>max?max:num);}}else{if(num<=min){newNum=max;}else{num-=delta;newNum=(num<min?min:num);}}
return newNum;},};var Message={show:function(l10nId,argValue){var args=undefined!==argValue?{n:argValue}:{};this.showEx(l10nId,args);},showEx:function(l10nId,args){var options={messageL10nId:l10nId,messageL10nArgs:args,latency:2000,useTransition:false};Toaster.showToast(options);},};var confirmDialog=function(dialogConfig){if(typeof ConfirmDialogHelper==='undefined'){LazyLoader.load('js/shared/confirm_dialog_helper.js',()=>{var dialog=new ConfirmDialogHelper(dialogConfig);dialog.show(document.getElementById('app-dialog'));});}else{var dialog=new ConfirmDialogHelper(dialogConfig);dialog.show(document.getElementById('app-dialog'));}}