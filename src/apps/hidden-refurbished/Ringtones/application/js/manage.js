'use strict';let tonePlayer=new TonePlayer();function ManagerToneList(...args){ToneList.apply(this,args);}
ManagerToneList.prototype=Object.create(ToneList.prototype);ManagerToneList.prototype.constructor=ManagerToneList;ManagerToneList.prototype.makeItem=(tone)=>{let item=ToneList.prototype.makeItem.call(this,tone);item.querySelector('.desc').addEventListener('click',()=>{if(!ManageActivity.addToneState&&!ManageActivity.shareState&&!ManageActivity.isPaused&&!ManageActivity.setRingtone){ManageActivity.currentPlayingTone=tone;tonePlayer.setTone(tone,(playing)=>{item.dataset.playing=playing;ManageActivity.createOptions();});}else{tonePlayer.stop();}});item.addEventListener("focus",()=>{ManageActivity.focusItem=tone;ManageActivity.createOptions();});return item;};navigator.mozSetMessageHandler('activity',function(activity){if(ManageActivity.initialized){return;};ManageActivity.initialized=true;ManageActivity.launchType=activity.source.data.toneType;document.body.classList.toggle('large-text',navigator.largeTextEnabled);let listParent=document.getElementById('list-parent');ManageActivity.toneList=new ManagerToneList('title-'+self.launchType,listParent);ManageActivity.checkLowMemoryDevice();ManageActivity.eventListener(activity);ManageActivity.getTones();ManageActivity.setHeaderTitle();ManageActivity.lazyLoadSoftkeyFiles();ManageActivity.lazyLoadFiles();});let ManageActivity={initialized:false,launchType:null,currentPlayingTone:null,focusItem:null,toneList:null,option:null,shareState:false,addToneState:false,isPaused:false,tones:null,createCustomTonesCount:0,setRingtone:false,lazyLoadSoftkeyFiles:function(){let self=this;let lazyFiles=["shared/style/softkey.css","shared/js/softkey_panel.js",];LazyLoader.load(lazyFiles,()=>{if(self.launchType!=="myRingtones"){self.createOptions();};});},lazyLoadFiles:function(){let self=this;let lazyFiles=["shared/style/action_menu.css","shared/style/confirm.css","shared/style/status.css","shared/style/switches.css","shared/style/lists.css","shared/style/navigation.css","shared/style/option_menu.css","shared/elements/gaia-icons/gaia-icons.css","shared/elements/gaia-theme/gaia-font.css","shared/elements/config.js","shared/js/component_utils.js","shared/js/custom_dialog.js","shared/js/toaster.js","shared/js/device_storage/enumerate_all.js","shared/js/option_menu.js","shared/js/homescreens/confirm_dialog_helper.js",];LazyLoader.load(lazyFiles,()=>{self.initManageListers();});},setHeaderTitle:function(){let headerTitle=document.getElementById('header-title');let headerTitleL10nId=null;if(this.launchType==="systemRingtones"){headerTitleL10nId="system-ringtones";}else if(this.launchType==="systemAlerts"){headerTitleL10nId="notice-alerts";}else if(this.launchType==="myRingtones"){headerTitleL10nId="my-ringtones";};headerTitle.setAttribute('data-l10n-id',headerTitleL10nId);},getTones:function(){if(this.launchType==="myRingtones"){this.getCustomTones();}else{this.getBuiltTones();};},getCustomTones:function(){let self=this;window.addEventListener('getcustomtonescount',(data)=>{self.createCustomTonesCount=data.detail.tonescount;self.createOptions();self.checkToneListLength();});this.tones=window.customRingtones.getCustomFiles("ringtone");},getBuiltTones:function(){if(this.launchType==="systemAlerts"){this.tones=window.builtInRingtones.getBuiltFiles("alerttone");}else if(this.launchType==="systemRingtones"){this.tones=window.builtInRingtones.getBuiltFiles("ringtone");};},createBuiltin:function(type){let self=this;window.addEventListener('builttonescreated',()=>{self.tonesListReady();});window.builtInRingtones.list(this.tones,type,this.toneList);},createCustome:function(type){let self=this;window.addEventListener('customtonescreated',()=>{self.tonesListReady();});window.customRingtones.list(this.tones,type,this.toneList);},tonesListReady:function(){document.querySelector('body').dataset.ready=true;this.sendNavigationResetEvent('listReady');},initManageListers:function(){let self=this;navigator.mozL10n.once(()=>{let type=null;switch(self.launchType){case'systemRingtones':type='ringtone';self.createBuiltin(type);break;case'systemAlerts':type='alerttone';self.createBuiltin(type);break;case'myRingtones':type='ringtone';self.createCustome(type);break;default:break;};});},sendNavigationResetEvent:function(name,detail){let event=document.createEvent('CustomEvent');event.initCustomEvent(name,false,true,detail);window.dispatchEvent(event);},checkToneListLength:function(){let hasNoTones=document.querySelector(".hasNoTones");hasNoTones.hidden=!(("myRingtones"===this.launchType)&&this.toneList&&(0===this.createCustomTonesCount));},checkLowMemoryDevice:function(){if(!localStorage.getItem('isLowMemoryDevice')){navigator.getFeature('hardware.memory').then((value)=>{if(value<=256){localStorage.setItem('isLowMemoryDevice',true);}else{localStorage.setItem('isLowMemoryDevice',false);}});};},eventListener:function(activity){window.addEventListener('keydown',(e)=>{if((!document.querySelector('.group-menu'))&&(!document.querySelector('#dialog-screen'))&&(!this.shareState)&&e.key==='Backspace'){tonePlayer.stop();activity.postError('cancelled');e.preventDefault();};});window.addEventListener('visibilitychange',()=>{if(this.addToneState||this.shareState||this.setRingtone){return;};if((!document.hidden)&&(!document.querySelector('.group-menu'))){this.sendNavigationResetEvent('listReady',{restoreFocus:true});};});window.addEventListener('largetextenabledchanged',()=>{document.body.classList.toggle('large-text',navigator.largeTextEnabled);});},addNewTone:function(){this.addToneState=true;tonePlayer.stop();const pickActivity=new MozActivity({name:'pick',data:{type:'audio/*'}});pickActivity.onsuccess=()=>{this.addToneState=false;const{result}=pickActivity;if(JSON.stringify(result)==='{}'){return;}
this.setRingtone=true;const setActivity=new MozActivity({name:'setringtone',data:{type:result.type,number:1,blobs:[result.blob],metadata:[result.metadata],filenames:[result.name]}});setActivity.onsuccess=(e)=>{this.setRingtone=false;const data=e.target.result;window.customRingtones.get(data.details.toneID).then((tone)=>{this.createCustomTonesCount++;this.toneList.add(tone);this.checkToneListLength();this.createOptions();this.sendNavigationResetEvent('listReady',{addNewTone:true,newToneName:tone._name});});}
setActivity.onerror=()=>{this.setRingtone=false;console.error('add ringtones error');}};pickActivity.onerror=()=>{this.addToneState=false;};},showShareDialog:function(){let self=this;tonePlayer.stop();this.shareState=true;setTimeout(()=>{self.option.hide()},100);self.focusItem.getBlob().then((blob)=>{let shareActivity=new MozActivity({name:'share',data:{type:'audio/*',__bug1015513_hide_from_self__:true,number:1,blobs:[blob],filenames:[self.focusItem.filename],metadata:[{title:self.focusItem.name}]}});shareActivity.onsuccess=(e)=>{self.shareState=false;self.option.show();self.sendNavigationResetEvent('listReady',{restoreFocus:true});};shareActivity.onerror=(e)=>{self.shareState=false;self.option.show();self.sendNavigationResetEvent('listReady',{restoreFocus:true});};});},showToast:function(msgId){let toast={messageL10nId:msgId,useTransition:true};Toaster.showToast(toast);},fromListDeleteTone:function(){let self=this;tonePlayer.stop();let descKey='delete-desc';window.systemTones.isInUse(self.focusItem).then((arrayList)=>{let paraLength=arrayList.length;if(paraLength){descKey+='-default-'+arrayList[0];};});let dialogConfig={title:{id:'confirmation',args:{}},body:{id:descKey,args:{tone:self.focusItem.name}},cancel:{name:'Cancel',l10nId:'delete-cancel',priority:1,callback:()=>{setTimeout(()=>{self.option.show()},500);},},confirm:{name:'Delete',l10nId:'delete-confirm',priority:3,callback:()=>{self.showToast('deleted-ringtone');self.focusItem.remove();window.systemTones.isInUse(self.focusItem).then((inUseAs)=>{self.createCustomTonesCount--;self.toneList.remove(self.focusItem);inUseAs.forEach((toneType)=>{window.systemTones.getDefault(toneType).then((tone)=>{window.systemTones.set(toneType,tone);});});self.checkToneListLength();self.createOptions();self.sendNavigationResetEvent('listReady');});},}};let dialog=new ConfirmDialogHelper(dialogConfig);dialog.show(document.getElementById('app-confirmation-dialog'));setTimeout(()=>{self.option.hide()},5);setTimeout(()=>{document.activeElement&&document.activeElement.blur();},500);},createOptions:function(){let self=this;let softkeyName=(tonePlayer.getPaused()||(this.focusItem!==this.currentPlayingTone))?'Play':'Stop';let playAction={name:softkeyName,l10nId:softkeyName.toLowerCase(),priority:2,method:()=>{self.isPaused=softkeyName==='Stop';}};let params=null;switch(this.launchType){case'systemRingtones':case'systemAlerts':if(localStorage.getItem('isLowMemoryDevice')==='true'){params={menuClassName:'menu-button',header:{l10nId:'message'},items:[playAction]};}else{params={menuClassName:'menu-button',header:{l10nId:'message'},items:[playAction,{name:'Share',l10nId:'share',priority:3,method:this.showShareDialog.bind(this)}]};}
break;case'myRingtones':if(this.createCustomTonesCount>0){params={header:{l10nId:'options'},items:[{name:'Add',l10nId:'add',priority:1,method:this.addNewTone.bind(this)},playAction,{name:'Add',l10nId:'add-ringtone',priority:10,method:this.addNewTone.bind(this)},{name:'Share',l10nId:'share',priority:10,method:this.showShareDialog.bind(this)},{name:'Delete',l10nId:'delete',priority:10,method:this.fromListDeleteTone.bind(this)}]};}else{params={menuClassName:'menu-button',header:{l10nId:'message'},items:[{name:'Add',l10nId:'add',priority:1,method:this.addNewTone.bind(this)}]};}
break;default:break;}
if(this.option){this.option.initSoftKeyPanel(params);}else{this.option=new SoftkeyPanel(params);}
this.option.show();}};