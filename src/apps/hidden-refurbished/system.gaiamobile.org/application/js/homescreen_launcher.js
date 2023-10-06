'use strict';(function(exports){var HomescreenLauncher=function(){};HomescreenLauncher.prototype={_currentManifestURL:'',_instance:undefined,_started:false,_ready:false,get ready(){return this._ready;},get origin(){return'homescreen';},get manifestURL(){return this._currentManifestURL;},_fetchSettings:function hl_fetchSettings(){var that=this;SettingsListener.observe('homescreen.manifestURL','',function onRetrievingHomescreenManifestURL(value){var previousManifestURL=that._currentManifestURL;that._currentManifestURL=value;if(typeof(that._instance)!=='undefined'){if(previousManifestURL!==''&&previousManifestURL!==that._currentManifestURL){that._instance.kill();that._instance=new HomescreenWindow(value);window.dispatchEvent(new CustomEvent('homescreen-changed'));}else{that._instance.ensure();}}
that._ready=true;window.dispatchEvent(new CustomEvent('homescreen-ready'));},{forceClose:true});},_onAppReady:function hl_onAppReady(){window.removeEventListener('applicationready',this._onAppReady);this._fetchSettings();},start:function hl_start(){if(this._started){return;}
this._started=true;if(applications.ready){this._fetchSettings();}else{window.addEventListener('applicationready',this._onAppReady.bind(this));}
window.addEventListener('appopening',this);window.addEventListener('keyboardchange',this);},stop:function hl_stop(){if(typeof(this._instance)!=='undefined'){this._instance.kill();this._instance=undefined;}
this._currentManifestURL='';window.removeEventListener('appopening',this);window.removeEventListener('applicationready',this._onAppReady);this._started=false;},handleEvent:function hl_handleEvent(evt){switch(evt.type){case'appopening':if(evt.detail.rotatingDegree===90||evt.detail.rotatingDegree===270){this.getHomescreen().fadeOut();}
break;case'keyboardchange':this.getHomescreen().fadeOut();break;}},getHomescreen:function hl_getHomescreen(ensure){if(this._currentManifestURL===''){console.warn('HomescreenLauncher: not ready right now.');return null;}
if(typeof this._instance=='undefined'){this._instance=new HomescreenWindow(this._currentManifestURL);return this._instance;}else{if(ensure){this._instance.ensure();}
return this._instance;}}};exports.HomescreenLauncher=HomescreenLauncher;}(window));