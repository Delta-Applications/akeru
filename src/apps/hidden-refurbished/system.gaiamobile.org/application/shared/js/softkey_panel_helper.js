'use strict';(function(exports){var softkey=new SoftkeyPanel({menuClassName:'menu-button',items:[{name:'create',priority:1,method:function(){}}]});var backCallBack=[];var softkey_enabled=false;var HelperEvent=function(e){switch(e.type){case'screenchange':if(!e.detail.screenEnabled){softkey.hide();}
break;case'lockscreen-appopened':softkey.hide();break;case'lockscreen-appclosed':case'wake':if(softkey_enabled){softkey.show();}
break;case'keydown':if(e.key==='Backspace'||e.key==='BrowserBack'){if(softkey_enabled){backCallBack.apply(null,[]);e.preventDefault();}}}};window.addEventListener('keydown',HelperEvent);window.addEventListener('lockscreen-appopened',HelperEvent);window.addEventListener('lockscreen-appclosed',HelperEvent);window.addEventListener('screenchange',HelperEvent);window.addEventListener('wake',HelperEvent);var SoftkeyHelper={applist:[],init:function(params,callback){softkey.initSoftKeyPanel(params);softkey.show();backCallBack=callback||function(){};softkey_enabled=true;},updateSoftkey:function(params,keyStyle,name){switch(keyStyle){case'1':params.items[0].l10nId=name;break;case'3':params.items[1].l10nId=name;break;default:break;}
softkey.initSoftKeyPanel(params);},show:function(){softkey.show();},onlyHide:function(){softkey.hide();},hide:function(name){softkey.hide();backCallBack=function(){};softkey_enabled=false;for(var i=0;i<this.applist.length;i++){if(this.applist[i].name==name){this.applist.splice(i,1);if(i==0&&this.applist.length>0&&this.applist[0].appliacation.front!=undefined){this.applist[0].appliacation.front();}
break;}}},getSoftkey:function(){return softkey;},register:function(app,name){for(var i=0;i<this.applist.length;i++){if(this.applist[i].name==name){return;}}
var applicationData={appliacation:app,name:name,};if(this.applist.length>0&&this.applist[0].appliacation.back!=undefined){this.applist[0].appliacation.back();}
this.applist.unshift(applicationData);},};exports.SoftkeyHelper=SoftkeyHelper;})(this);