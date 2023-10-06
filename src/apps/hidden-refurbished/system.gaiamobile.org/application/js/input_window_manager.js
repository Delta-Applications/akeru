'use strict';(function(exports){var InputWindowManager=function(){this.isOutOfProcessEnabled=false;this._totalMemory=0;this._getMemory();this._oopSettingCallbackBind=null;this._inputWindows={};this._currentWindow=null;this._lastWindow=null;this._onDebug=false;};InputWindowManager.prototype._debug=function iwm__debug(msg){if(this._onDebug){console.log('[InputWindowManager] '+msg);}};InputWindowManager.prototype.name='InputWindowManager';InputWindowManager.prototype.kill=function(){this._currentWindow&&this._currentWindow.kill();};InputWindowManager.prototype.start=function iwm_start(){Service.registerState('isActivated',this);Service.register('kill',this);this._oopSettingCallbackBind=this._oopSettingCallback.bind(this);SettingsListener.observe('keyboard.3rd-party-app.enabled',true,this._oopSettingCallbackBind);window.addEventListener('input-appopened',this);window.addEventListener('input-appclosing',this);window.addEventListener('input-appclosed',this);window.addEventListener('input-apprequestclose',this);window.addEventListener('input-appready',this);window.addEventListener('input-appheightchanged',this);window.addEventListener('input-appterminated',this);window.addEventListener('activityrequesting',this);window.addEventListener('activityopening',this);window.addEventListener('activityclosing',this);window.addEventListener('attentionrequestopen',this);window.addEventListener('attentionrecovering',this);window.addEventListener('attentionopening',this);window.addEventListener('attentionopened',this);window.addEventListener('notification-clicked',this);window.addEventListener('applicationsetupdialogshow',this);window.addEventListener('lockscreen-appopened',this);};InputWindowManager.prototype.stop=function iwm_stop(){SettingsListener.unobserve('keyboard.3rd-party-app.enabled',this._oopSettingCallbackBind);this._oopSettingCallbackBind=null;window.removeEventListener('input-appopened',this);window.removeEventListener('input-appclosing',this);window.removeEventListener('input-appclosed',this);window.removeEventListener('input-apprequestclose',this);window.removeEventListener('input-appready',this);window.removeEventListener('input-appheightchanged',this);window.removeEventListener('input-appterminated',this);window.removeEventListener('activityrequesting',this);window.removeEventListener('activityopening',this);window.removeEventListener('activityclosing',this);window.removeEventListener('attentionrequestopen',this);window.removeEventListener('attentionrecovering',this);window.removeEventListener('attentionopening',this);window.removeEventListener('attentionopened',this);window.removeEventListener('notification-clicked',this);window.removeEventListener('applicationsetupdialogshow',this);window.removeEventListener('lockscreen-appopened',this);};InputWindowManager.prototype.handleEvent=function iwm_handleEvent(evt){var inputWindow;var manifestURL;if(evt.type.startsWith('input-app')){inputWindow=evt.detail;}
this._debug('handleEvent: '+evt.type);switch(evt.type){case'input-appopened':case'input-appheightchanged':if(inputWindow===this._currentWindow){this._kbPublish('keyboardchange',inputWindow.height);}
break;case'input-appready':if(this._lastWindow){if(!this._lastWindow.isDead()){this._lastWindow.close('immediate');}
this._lastWindow=null;}
break;case'input-appclosing':if(!this._currentWindow){this._kbPublish('keyboardhide',undefined);}
break;case'input-appclosed':this._debug('inputWindow pendingReady: '+inputWindow._pendingReady);if(inputWindow._pendingReady){return;}
inputWindow._setAsActiveInput(false);if(!this._currentWindow){this._kbPublish('keyboardhidden',undefined);}
break;case'input-appterminated':manifestURL=inputWindow.manifestURL;this._removeInputApp(manifestURL);if(!this._currentWindow||(this._currentWindow&&this._currentWindow.manifestURL===manifestURL)){KeyboardManager._onKeyboardKilled(manifestURL);}
break;case'activityrequesting':case'activityopening':case'activityclosing':case'attentionrequestopen':case'attentionrecovering':case'attentionopening':case'attentionopened':case'notification-clicked':case'applicationsetupdialogshow':this.hideInputWindowImmediately();break;case'lockscreen-appopened':if(this._hasActiveInputApp()){var app=Service.currentApp;app&&app.blur();navigator.mozInputMethod.removeFocus();}
break;}};InputWindowManager.prototype._getMemory=function iwm_getMemory(){if('getFeature'in navigator){navigator.getFeature('hardware.memory').then(mem=>{this._totalMemory=mem;},()=>{console.error('InputWindowManager: '+'Failed to retrieve total memory of the device.');});}};InputWindowManager.prototype._oopSettingCallback=function iwm_oopSettingCallback(value){this.isOutOfProcessEnabled=value;};InputWindowManager.prototype._onInputLayoutsRemoved=function iwm_onInputLayoutsRemoved(manifestURLs){var currentWindowRemoved=false;manifestURLs.forEach(manifestURL=>{if(this._currentWindow&&this._currentWindow.manifestURL===manifestURL){this.hideInputWindow();currentWindowRemoved=true;}
this._removeInputApp(manifestURL);});return currentWindowRemoved;};InputWindowManager.prototype._removeInputApp=function iwm_removeInputApp(manifestURL){if(!this._inputWindows[manifestURL]){return;}
for(var pathInitial in this._inputWindows[manifestURL]){this._inputWindows[manifestURL][pathInitial].destroy();delete this._inputWindows[manifestURL][pathInitial];}
delete this._inputWindows[manifestURL];};InputWindowManager.prototype.getHeight=function iwm_getHeight(){return this._currentWindow?this._currentWindow.height:0;};InputWindowManager.prototype._hasActiveInputApp=function iwm_hasActiveInputApp(){return!!this._currentWindow;};InputWindowManager.prototype.isActivated=function(){return!!this._hasActiveInputApp();};InputWindowManager.prototype._extractLayoutConfigs=function iwm_extractLayoutConfigs(layout){var manifestURL=layout.manifestURL;var path=layout.path;var id=layout.id;var origin=layout.origin;var pathInitial;var hash;if(path.indexOf('#')===-1){pathInitial=path;hash='';}else{pathInitial=path.substring(0,path.indexOf('#'));hash=path.substring(path.indexOf('#'));}
var app=applications.getByManifestURL(manifestURL);return{manifest:app.manifest,manifestURL:manifestURL,path:path,id:id,pathInitial:pathInitial,hash:hash,origin:origin};};InputWindowManager.prototype._makeInputWindow=function iwm_makeInputWindow(configs){var isCertifiedApp=(configs.manifest.type==='certified');if(0===this._totalMemory){console.warn('InputWindowManager: totalMemory is 0');}
if(this.isOutOfProcessEnabled&&(!isCertifiedApp||this._totalMemory>=512)){this._debug('=== Enable keyboard: '+
configs.origin+' run as OOP ===');configs.oop=true;}else{configs.oop=false;}
var inputWindow=new InputWindow(configs);this._inputWindows[configs.manifestURL]=this._inputWindows[configs.manifestURL]||{};this._inputWindows[configs.manifestURL][configs.pathInitial]=inputWindow;return inputWindow;};InputWindowManager.prototype.preloadInputWindow=function iwm_preloadInputWindow(layout){var configs=this._extractLayoutConfigs(layout);configs.stayBackground=true;this._makeInputWindow(configs);};InputWindowManager.prototype.showInputWindow=function iwm_showInputWindow(layout){var configs=this._extractLayoutConfigs(layout);var nextWindow=this._inputWindows[configs.manifestURL]?this._inputWindows[configs.manifestURL][configs.pathInitial]:undefined;if(!nextWindow){nextWindow=this._makeInputWindow(configs);}
if(this._currentWindow&&nextWindow!==this._currentWindow){this._lastWindow=this._currentWindow;configs.immediateOpen=true;nextWindow.open(configs);}else{nextWindow.open(configs);}
this._currentWindow=nextWindow;this._kbPublish('keyboard-activated',undefined);};InputWindowManager.prototype.hideInputWindow=function iwm_hideInputWindow(){if(!this._currentWindow){return;}
this._currentWindow._setAsActiveInput(false);var windowToClose=this._currentWindow;this._currentWindow=null;windowToClose.close();this._kbPublish('keyboard-deactivated',undefined);};InputWindowManager.prototype.hideInputWindowImmediately=function iwm_hideInputWindowImmediately(){if(!this._currentWindow){return;}
this._currentWindow._setAsActiveInput(false);var windowToClose=this._currentWindow;this._currentWindow=null;this._kbPublish('keyboardhide',undefined);this._kbPublish('keyboard-deactivated',undefined);windowToClose.close('immediate');};InputWindowManager.prototype.getLoadedManifestURLs=function iwm_getLoadedManifestURLs(){return Object.keys(this._inputWindows);};InputWindowManager.prototype._kbPublish=function iwm_kbPublish(type,height){var eventInitDict={bubbles:true,cancelable:true,detail:{height:height}};var evt=new CustomEvent(type,eventInitDict);document.body.dispatchEvent(evt);};exports.InputWindowManager=InputWindowManager;})(window);