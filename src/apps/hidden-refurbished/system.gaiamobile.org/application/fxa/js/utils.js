'use strict'
if(typeof window.$!=='function'){window.$=function(id){return(typeof id==='string')?document.getElementById(id):id;};}
if(typeof window.lget!=='function'){window.lget=function(l10nId){return navigator.mozL10n.get(l10nId);};}
if(typeof String.prototype.contains!=='function'){String.prototype.contains=function(substr){return-1!==this.indexOf(substr);};}
if(typeof Array.prototype.contains!=='function'){Array.prototype.contains=function(item){return-1!==this.indexOf(item);};}
var Message={show:function(id){var toast={messageL10nId:id,latency:2000,useTransition:true};if(!SystemToaster.isInitialized())
SystemToaster.initialize($('fxa-toaster'));SystemToaster.showToast(toast);}};